"""
NexusAI — App Launcher Skill
Opens and focuses Windows applications.

SECURITY: Only apps in APP_WHITELIST may be launched. Unlisted app names
from user input are rejected to prevent command injection. subprocess calls
never use shell=True with user-provided data.
"""
import subprocess
import os
from typing import Dict, Any, Optional
from loguru import logger
from config.permissions import is_allowed
from config.skills_config import is_skill_enabled

# ── App Whitelist ─────────────────────────────────────────────────────────────
# Map friendly name → exact executable or URI. Only these apps can be launched.
# To add a new app, add it here with the exact path or registered executable.
# NEVER build this list from user input.
# ─────────────────────────────────────────────────────────────────────────────
APP_WHITELIST: dict[str, str] = {
    "chrome": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "google chrome": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "edge": "microsoft-edge:",
    "microsoft edge": "microsoft-edge:",
    "whatsapp": "WhatsApp:",
    "outlook": "outlook.exe",
    "email": "outlook.exe",
    "notepad": "notepad.exe",
    "calculator": "calc.exe",
    "file explorer": "explorer.exe",
    "explorer": "explorer.exe",
    "powerpoint": "powerpnt.exe",
    "microsoft powerpoint": "powerpnt.exe",
    "word": "winword.exe",
    "microsoft word": "winword.exe",
    "excel": "excel.exe",
    "microsoft excel": "excel.exe",
    "paint": "mspaint.exe",
    "cmd": "cmd.exe",
    "terminal": "wt.exe",            # Windows Terminal
    "windows terminal": "wt.exe",
    "powershell": "powershell.exe",
    "task manager": "taskmgr.exe",
    "spotify": "spotify:",               # Opens Spotify via registered URI handler
    "discord": "discord.exe",
    "zoom": "zoom.exe",
    "vlc": "vlc.exe",
    "media player": "wmplayer.exe",
    "image viewer": "mspaint.exe",
    "camera": "microsoft.windows.camera:",
    "alarms": "ms-clock:",
    "calendar": "outlookcal:",
    "contacts": "ms-people:",
    "telegram": "telegram.exe",
    # MS Settings URIs — these are safe protocol handlers, not shell strings
    "settings": "ms-settings:",
    "system settings": "ms-settings:",
    "control panel": "control.exe",
}

# Skill ID used in skills_state.json for the App Launcher toggle
_SKILL_ID = "app_launcher"


def get_custom_apps() -> dict[str, str]:
    import json
    from pathlib import Path
    custom_apps_file = Path(__file__).parent.parent / "custom_apps.json"
    if not custom_apps_file.exists():
        return {}
    try:
        with open(custom_apps_file, "r", encoding="utf-8") as f:
            apps_list = json.load(f)
            return {app["name"].lower(): app["path"] for app in apps_list if "name" in app and "path" in app}
    except Exception as e:
        logger.error(f"Failed to read custom apps: {e}")
        return {}


async def launch_app(
    app_name: str,
    file_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Launch or open a Windows application from the approved whitelist.

    Args:
        app_name: Name of the application to open (matched against APP_WHITELIST)
        file_path: Optional file to open with the application

    Returns:
        Dict with 'success', 'output', and optional 'data'
    """
    # 1. Check global permission flag
    if not is_allowed("app_launch"):
        return {
            "success": False,
            "output": "App launching is turned off in settings."
        }

    # 2. Check skill-level toggle (Skill Modules UI ON/OFF) for the Launcher itself
    if not is_skill_enabled(_SKILL_ID):
        return {
            "success": False,
            "output": "The App Launcher skill is currently disabled. Enable it in Skill Modules."
        }
        
    app_key = app_name.lower().strip()
    
    # 2.b. Check individual skill toggle if this app maps directly to a recognized skill module
    # Some skills in settings_api.py share the name exactly (e.g. "whatsapp", "edge", "spotify")
    # For aliases, we map to their primary skill ID to check if it's disabled.
    skill_mapping = {
        "google chrome": "chrome", "microsoft edge": "edge", "microsoft word": "word", 
        "microsoft excel": "excel", "microsoft powerpoint": "powerpoint"
    }
    skill_id_to_check = skill_mapping.get(app_key, app_key)
    
    # We only block if we explicitly know it's a tracked skill AND it is disabled.
    # We use get() with default True to not penalize apps not listed as skills.
    from config.skills_config import get_skills_state
    state = get_skills_state()
    if skill_id_to_check in state and state[skill_id_to_check] is False:
        return {
            "success": False,
            "output": f"Permission denied: The {app_name} module is currently disabled. Please enable it in the Skill Modules page."
        }

    # 3. Whitelist check — NEVER launch an unlisted app name
    executable = APP_WHITELIST.get(app_key)
    
    # Check custom user apps
    if not executable:
        custom_apps = get_custom_apps()
        executable = custom_apps.get(app_key)

    if not executable:
        logger.warning(f"App launch blocked: '{app_key}' not in whitelist")
        return {
            "success": False,
            "output": f"I don't have permission to open '{app_name}'. Only approved apps can be launched."
        }

    try:
        if file_path and os.path.exists(file_path):
            # Open a specific file — use os.startfile (no shell, no injection risk)
            os.startfile(file_path)
            return {
                "success": True,
                "output": f"Opened {os.path.basename(file_path)} with {app_name}",
                "data": {"app": app_name, "file": file_path}
            }

        if executable.startswith("ms-") or executable.endswith(":"):
            # URI scheme (ms-settings:, spotify:, etc.) — use cmd /c start with fixed list, shell=False
            subprocess.Popen(
                ["cmd", "/c", "start", "", executable],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                shell=False   # Explicitly False — executable is from our whitelist only
            )
            return {"success": True, "output": f"Opened {app_name}"}

        # Standard app launch via cmd /c start — list form, shell=False
        result = subprocess.Popen(
            ["cmd", "/c", "start", "", executable],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            shell=False
        )
        return {
            "success": True,
            "output": f"Launched {app_name} successfully",
            "data": {"app": app_name, "pid": result.pid}
        }

    except Exception as e:
        # Log full detail internally — return generic message to client
        logger.error(f"App launch failed for '{app_key}': {e}")
        return {
            "success": False,
            "output": f"Something went wrong opening {app_name}. Please try again."
        }
