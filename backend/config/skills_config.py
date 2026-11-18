import json
import os
from pathlib import Path
from loguru import logger

CONFIG_FILE = Path(__file__).parent.parent / "skills_state.json"

def get_skills_state() -> dict:
    """Read the current enabled/disabled state of skills."""
    if not CONFIG_FILE.exists():
        return {}
    
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read skills_state.json: {e}")
        return {}

def save_skills_state(state: dict):
    """Save the skills state to disk."""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(state, f, indent=4)
    except Exception as e:
        logger.error(f"Failed to save skills_state.json: {e}")

def set_skill_enabled(skill_id: str, enabled: bool):
    """Enable or disable a specific skill."""
    state = get_skills_state()
    state[skill_id] = enabled
    save_skills_state(state)

def is_skill_enabled(skill_id: str) -> bool:
    """Check if a skill is enabled. Defaults to True."""
    state = get_skills_state()
    return state.get(skill_id, True)

NOTIFS_FILE = Path(__file__).parent.parent / "notification_prefs.json"

SKILL_NOTIFICATION_KEYS = {
    "whatsapp": ["whatsapp", "whatsapp desktop"],
    "telegram": ["telegram", "telegram desktop"],
    "email": ["mail", "email", "outlook"],
    "chrome": ["chrome", "google chrome"],
    "edge": ["edge", "microsoft edge"],
    "spotify": ["spotify"],
    "zoom": ["zoom"],
}

def normalize_notification_app(value: str) -> str:
    return " ".join((value or "").lower().replace(".", "").replace(" desktop", "").split())

def get_notification_prefs() -> dict:
    if not NOTIFS_FILE.exists():
        return {
            "global_notifications_enabled": False,
            "notification_mode": "listed_apps_only",
            "app_preferences": {}
        }
    try:
        with open(NOTIFS_FILE, 'r', encoding='utf-8') as f:
            prefs = json.load(f)
            prefs.setdefault("global_notifications_enabled", False)
            prefs.setdefault("notification_mode", "listed_apps_only")
            prefs.setdefault("app_preferences", {})
            prefs["app_preferences"] = {
                normalize_notification_app(app): enabled
                for app, enabled in prefs["app_preferences"].items()
            }
            return prefs
    except Exception as e:
        logger.error(f"Failed to read notification_prefs.json: {e}")
        return {
            "global_notifications_enabled": False,
            "notification_mode": "listed_apps_only",
            "app_preferences": {}
        }

def save_notification_prefs(prefs: dict):
    try:
        with open(NOTIFS_FILE, 'w', encoding='utf-8') as f:
            json.dump(prefs, f, indent=4)
    except Exception as e:
        logger.error(f"Failed to save notification_prefs.json: {e}")
