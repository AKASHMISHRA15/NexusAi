"""
NexusAI — App Closer Skill
Terminates running Windows applications by name.
"""
import psutil
from typing import Dict, Any, Optional
from loguru import logger

# Map common friendly names → process executable names
PROCESS_MAP = {
    "whatsapp": ["WhatsApp.exe", "WhatsApp"],
    "chrome": ["chrome.exe"],
    "google chrome": ["chrome.exe"],
    "spotify": ["Spotify.exe", "SpotifyLauncher.exe"],
    "notepad": ["notepad.exe"],
    "calculator": ["CalculatorApp.exe", "calc.exe"],
    "word": ["WINWORD.EXE"],
    "microsoft word": ["WINWORD.EXE"],
    "excel": ["EXCEL.EXE"],
    "microsoft excel": ["EXCEL.EXE"],
    "powerpoint": ["POWERPNT.EXE"],
    "microsoft powerpoint": ["POWERPNT.EXE"],
    "paint": ["mspaint.exe"],
    "task manager": ["Taskmgr.exe"],
    "edge": ["msedge.exe"],
    "microsoft edge": ["msedge.exe"],
    "vlc": ["vlc.exe"],
    "discord": ["Discord.exe"],
    "slack": ["slack.exe"],
    "zoom": ["Zoom.exe"],
    "teams": ["Teams.exe", "ms-teams.exe"],
    "microsoft teams": ["Teams.exe"],
    "file explorer": ["explorer.exe"],
    "explorer": ["explorer.exe"],
}

# DO NOT kill these processes under any circumstances to prevent crashing the OS or our app
EXCLUDED_PROCESSES = [
    "msedgewebview2.exe", 
    "svchost.exe", 
    "csrss.exe", 
    "wininit.exe", 
    "smss.exe", 
    "services.exe", 
    "lsass.exe",
    "winlogon.exe"
]

async def close_app(app_name: str, force: bool = True) -> Dict[str, Any]:
    """
    Close / terminate a running Windows application by friendly name.

    Args:
        app_name: Friendly name of the application (e.g. 'WhatsApp', 'Chrome')
        force: If True, kills the process immediately. If False, tries graceful close first.

    Returns:
        Dict with 'success', 'output', and optional 'data'
    """
    app_key = app_name.lower().strip()
    target_exes = PROCESS_MAP.get(app_key)

    # If not in our map, try matching by substring against running process names
    if not target_exes:
        target_exes = [app_name]  # Try as-is

    killed = []
    not_found = True

    try:
        for proc in psutil.process_iter(["pid", "name"]):
            proc_name = proc.info["name"] or ""
            proc_lower = proc_name.lower()
            
            # Protect vital system and WebView processes
            if proc_lower in EXCLUDED_PROCESSES:
                continue
                
            # Match against known executables OR substring match on app_name
            is_match = (
                proc_name in target_exes
                or proc_lower in [e.lower() for e in target_exes]
                or app_key in proc_lower
            )
            if is_match:
                not_found = False
                try:
                    if force:
                        proc.kill()
                    else:
                        proc.terminate()
                    killed.append(proc_name)
                    logger.info(f"Terminated process: {proc_name} (PID {proc.info['pid']})")
                except psutil.NoSuchProcess:
                    pass  # Already gone
                except psutil.AccessDenied:
                    logger.warning(f"Access denied when closing {proc_name}")
                    return {
                        "success": False,
                        "output": f"Permission denied: cannot close '{app_name}'. It may require administrator rights."
                    }

        if not_found:
            return {
                "success": False,
                "output": f"'{app_name}' does not appear to be running.",
                "data": {"app": app_name, "running": False}
            }

        if killed:
            unique = list(set(killed))
            return {
                "success": True,
                "output": f"Successfully closed {app_name} ({', '.join(unique)}).",
                "data": {"app": app_name, "processes_killed": unique}
            }

        return {
            "success": False,
            "output": f"Could not close '{app_name}'. Try again or use Task Manager."
        }

    except psutil.AccessDenied as e:
        logger.error(f"Access denied closing '{app_name}': {e}")
        return {
            "success": False,
            "output": f"Permission denied: cannot close '{app_name}'. It may require administrator rights."
        }
    except Exception as e:
        logger.error(f"close_app error for '{app_name}': {e}")
        return {"success": False, "output": f"Something went wrong closing {app_name}. Please try again."}
