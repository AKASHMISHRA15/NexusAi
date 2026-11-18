import asyncio
import time
from typing import Dict, Any, Tuple
from loguru import logger
from plyer import notification
from api.websocket import active_connections

# Track last seen notification IDs to prevent duplicate readings
_seen_notifications = set()
_outgoing_notifications: Dict[Tuple[str, str], float] = {}
_incoming_notifications: Dict[Tuple[str, str, str], float] = {}
_listener = None
_access_granted = False

async def send_notification(title: str, message: str) -> Dict[str, Any]:
    """
    Push a custom Windows notification to the screen.
    """
    try:
        _remember_outgoing_notification(title, message)
        notification.notify(
            title=title,
            message=message,
            app_name="NexusAI",
            timeout=10
        )
        return {"success": True, "output": f"Sent notification: {title}"}
    except Exception as e:
        logger.error(f"Failed to send notification: {e}")
        return {"success": False, "output": "Something went wrong sending the notification. Please try again."}


def _normalize_text(value: str) -> str:
    return " ".join((value or "").lower().split())


def _remember_outgoing_notification(title: str, body: str):
    _outgoing_notifications[(_normalize_text(title), _normalize_text(body))] = time.time()


def _is_recent_outgoing_notification(title: str, body: str) -> bool:
    now = time.time()
    expired = [key for key, created_at in _outgoing_notifications.items() if now - created_at > 120]
    for key in expired:
        _outgoing_notifications.pop(key, None)

    return (_normalize_text(title), _normalize_text(body)) in _outgoing_notifications


def _is_recent_incoming_notification(app_name: str, title: str, body: str) -> bool:
    now = time.time()
    expired = [key for key, created_at in _incoming_notifications.items() if now - created_at > 20]
    for key in expired:
        _incoming_notifications.pop(key, None)

    key = (_notification_key(app_name), _normalize_text(title), _normalize_text(body))
    if key in _incoming_notifications:
        return True

    _incoming_notifications[key] = now
    return False


def _notification_key(value: str) -> str:
    return _normalize_text(value).replace(".", "").replace(" desktop", "")


def _format_notification_summary(app_name: str, title: str, body: str) -> str:
    app = app_name.strip() or "an app"
    clean_title = " ".join((title or "").split())
    clean_body = " ".join((body or "").split())

    app_l = app.lower()
    title_l = clean_title.lower()

    if "whatsapp" in app_l:
        if clean_title and clean_body:
            return f"WhatsApp message from {clean_title} saying {clean_body}"
        if clean_title:
            return f"WhatsApp notification from {clean_title}"
        return f"WhatsApp notification: {clean_body}"

    if clean_title and clean_body:
        if title_l.startswith(app_l):
            return f"{clean_title}: {clean_body}"
        return f"{app} notification from {clean_title}: {clean_body}"
    if clean_title:
        return f"{app} notification: {clean_title}"
    return f"{app} notification: {clean_body}"


async def init_notification_listener():
    """Request access to Windows notifications and setup listener."""
    global _listener, _access_granted
    
    try:
        from winsdk.windows.ui.notifications.management import UserNotificationListener
        _listener = UserNotificationListener.current
        access_status = await _listener.request_access_async()
        
        # 1 = Allowed, 2 = Denied, 3 = Unspecified
        if access_status == 1:
            _access_granted = True
            logger.info("Notification listener access granted.")
        else:
            logger.warning(f"Notification listener access denied (status: {access_status}). Go to Windows Settings -> Privacy -> Notifications and allow apps to access notifications.")
    except ImportError:
        logger.error("winsdk is not installed. Notification reader disabled.")
    except Exception as e:
        logger.error(f"Failed to init notification listener: {e}")

async def start_notification_polling():
    """Background task to poll for new Windows notifications."""
    await init_notification_listener()
    
    if not _access_granted:
        return
        
    logger.info("Starting background notification polling...")
    
    from winsdk.windows.ui.notifications import NotificationKinds
    
    while True:
        try:
            from config.skills_config import get_notification_prefs
            
            # Get current notifications
            notifications = await _listener.get_notifications_async(NotificationKinds.TOAST)
            
            # If this is the very first time we are polling, just record all existing IDs and do NOT announce them
            if not _seen_notifications:
                for notif in notifications:
                    _seen_notifications.add(notif.id)
                await asyncio.sleep(3)
                continue
            
            prefs = get_notification_prefs()
            global_enabled = prefs.get("global_notifications_enabled", False)
            mode = prefs.get("notification_mode", "listed_apps_only")
            app_prefs = prefs.get("app_preferences", {})
            skill_state = {}
            skill_notification_keys = {}
            if mode == "listed_apps_only":
                from config.skills_config import SKILL_NOTIFICATION_KEYS, get_skills_state, normalize_notification_app
                skill_state = get_skills_state()
                skill_notification_keys = {
                    skill_id: {normalize_notification_app(key) for key in keys}
                    for skill_id, keys in SKILL_NOTIFICATION_KEYS.items()
                }
            
            for notif in notifications:
                notif_id = notif.id
                
                if notif_id not in _seen_notifications:
                    _seen_notifications.add(notif_id)
                    
                    app_name = notif.app_info.display_info.display_name if notif.app_info else "Unknown App"

                    text_nodes = notif.notification.visual.bindings[0].get_text_elements()
                    texts = [t.text for t in text_nodes]
                    title = texts[0] if texts else ""
                    body = "\n".join(texts[1:]) if len(texts) > 1 else ""

                    # 1. Never read our own generated notifications. Plyer can surface
                    # these as "Python" on Windows, so also match by recent title/body.
                    if app_name.lower() in {"nexusai", "python"} and _is_recent_outgoing_notification(title, body):
                        continue

                    # Windows can expose the same app notification more than once with
                    # different IDs as toast contents update. De-dupe by content too.
                    if _is_recent_incoming_notification(app_name, title, body):
                        continue

                    # 2. Check global setting
                    if not global_enabled:
                        continue

                    # 3. Check per-app logic
                    app_key = _notification_key(app_name)
                    is_enabled_for_app = app_prefs.get(app_key, True)

                    if mode == "listed_apps_only":
                        matching_skill = next(
                            (
                                skill_id
                                for skill_id, keys in skill_notification_keys.items()
                                if app_key in keys
                            ),
                            None,
                        )
                        if not matching_skill:
                            continue
                        if not skill_state.get(matching_skill, True) or not is_enabled_for_app:
                            continue

                    if mode == "all_apps" and app_key in app_prefs and not is_enabled_for_app:
                        continue

                    if title or body:
                        await _process_incoming_notification(app_name, title, body)
            
        except Exception as e:
            logger.error(f"Error in notification loop: {e}")
            
        await asyncio.sleep(3)  # Poll every 3 seconds

async def _process_incoming_notification(app_name: str, title: str, body: str):
    """Send incoming OS notifications to the UI without invoking the agent loop."""
    logger.info(f"New Notification from {app_name}: {title} - {body}")

    summary = _format_notification_summary(app_name, title, body)

    for session_id, ws in list(active_connections.items()):
        try:
            await ws.send_json({
                "type": "notification",
                "app_name": app_name,
                "title": title,
                "body": body,
                "summary": summary,
            })
        except Exception as e:
            logger.error(f"Failed to process notification for session {session_id}: {e}")
