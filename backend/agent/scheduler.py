import asyncio
from loguru import logger
from api.websocket import active_connections
from skills.notification_skill import send_notification

async def _delayed_task_execution(session_id: str, delay_seconds: int, instruction: str):
    logger.info(f"Task scheduled for {delay_seconds} seconds from now (session {session_id}).")
    await asyncio.sleep(delay_seconds)
    
    logger.info(f"Executing scheduled task for session {session_id}: {instruction}")
    reminder_text = instruction.strip()

    try:
        await send_notification("NexusAI Reminder", reminder_text)
    except Exception as e:
        logger.error(f"Failed to send scheduled reminder notification: {e}")
    
    # Check if websocket is still active
    ws = active_connections.get(session_id)
    if not ws:
        logger.warning(f"Session {session_id} is no longer active. Reminder toast was sent; agent follow-up aborted.")
        return

    try:
        await ws.send_json({
            "type": "notification",
            "app_name": "NexusAI",
            "title": "Reminder",
            "body": reminder_text,
            "summary": f"Reminder: {reminder_text}",
        })
    except Exception as e:
        logger.error(f"Failed to send scheduled reminder notification: {e}")

def schedule_agent_task(session_id: str, delay_minutes: float, instruction: str):
    """Schedules a task to run in the background."""
    delay_seconds = int(delay_minutes * 60)
    asyncio.create_task(_delayed_task_execution(session_id, delay_seconds, instruction))
