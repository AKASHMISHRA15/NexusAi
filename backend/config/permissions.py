"""
NexusAI — Permission Guard
Checks config/permissions.json to see if a given action is allowed.
This is separate from skills_state.json (which tracks whether a skill UI card is ON/OFF).

permissions.json controls broad action categories (file_create, app_launch, etc.)
skills_state.json controls individual skill cards (whatsapp, spotify, etc.)

Both must be True for an action to run.
"""
import json
import os
from pathlib import Path
from loguru import logger

_PERMISSIONS_FILE = Path(__file__).parent / "permissions.json"

# Default permissions — used if file is missing or unreadable
_DEFAULTS = {
    "file_create": True,
    "file_open": True,
    "app_launch": True,
    "app_close": True,
    "system_settings": True,
    "browser_control": True,
    "notification_read": True,
}


def _load_permissions() -> dict:
    """Load permissions from config/permissions.json."""
    if not _PERMISSIONS_FILE.exists():
        logger.warning("permissions.json not found — using all-enabled defaults")
        return _DEFAULTS.copy()
    try:
        with open(_PERMISSIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        perms = data.get("permissions", {})
        # Merge with defaults so missing keys are permissive
        merged = {**_DEFAULTS, **perms}
        return merged
    except Exception as e:
        logger.error(f"Could not read permissions.json: {e}")
        return _DEFAULTS.copy()


def is_allowed(action: str) -> bool:
    """
    Check if a given action permission is enabled.

    Args:
        action: Permission key, e.g. 'app_launch', 'file_create'

    Returns:
        True if allowed, False if explicitly disabled in permissions.json
    """
    perms = _load_permissions()
    allowed = perms.get(action, True)  # Default permissive for unknown keys
    if not allowed:
        logger.warning(f"Permission denied for action: '{action}' (disabled in permissions.json)")
    return allowed


def save_permission(action: str, enabled: bool):
    """Update a single permission flag and save to disk."""
    try:
        if _PERMISSIONS_FILE.exists():
            with open(_PERMISSIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = {"permissions": {}}

        data.setdefault("permissions", {})[action] = enabled

        with open(_PERMISSIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        logger.error(f"Could not save permissions.json: {e}")
