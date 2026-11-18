"""
Zoom Skill
==========
Opens the Zoom application or joins a specific meeting using the
zoommtg:// URI scheme. Searches common installation paths for Zoom.exe.
"""

import subprocess
import os
from typing import Dict, Any, Optional

from loguru import logger


def _get_zoom_paths() -> list:
    """Build list of common Zoom.exe paths, resolving the current user's home dir."""
    home = os.path.expanduser("~")
    return [
        os.path.join(home, "AppData", "Roaming", "Zoom", "bin", "Zoom.exe"),
        r"C:\Program Files\Zoom\bin\Zoom.exe",
        r"C:\Program Files (x86)\Zoom\bin\Zoom.exe",
        os.path.join(home, "AppData", "Local", "Zoom", "bin", "Zoom.exe"),
    ]


def _find_zoom_exe() -> Optional[str]:
    """Search known paths for Zoom.exe and return the first found path."""
    for path in _get_zoom_paths():
        if os.path.isfile(path):
            return path
    return None


async def open_zoom(
    meeting_id: Optional[str] = None,
    meeting_password: Optional[str] = None,
) -> Dict:
    """
    Open the Zoom application or join a specific Zoom meeting.

    Args:
        meeting_id: Zoom meeting ID (numbers only). If provided, attempts
                    to join that meeting via the zoommtg:// URI scheme.
        meeting_password: Optional meeting password / passcode.

    Returns:
        Dict with 'success' (bool) and 'output' (str) keys.
    """
    try:
        if meeting_id:
            # Sanitize meeting_id — strip spaces/dashes
            clean_id = meeting_id.replace(" ", "").replace("-", "")
            pwd_param = meeting_password or ""
            uri = f"zoommtg://zoom.us/join?confno={clean_id}&pwd={pwd_param}"
            logger.info(f"Joining Zoom meeting: {clean_id}")
            subprocess.Popen(
                ["cmd", "/c", "start", "", uri],
                shell=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return {
                "success": True,
                "output": f"Joining Zoom meeting ID: {clean_id}.",
                "data": {
                    "meeting_id": clean_id,
                    "password_provided": bool(meeting_password),
                    "uri": uri,
                },
            }

        # No meeting ID — just launch Zoom
        zoom_exe = _find_zoom_exe()
        if zoom_exe:
            logger.info(f"Launching Zoom from: {zoom_exe}")
            subprocess.Popen(
                [zoom_exe],
                shell=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return {
                "success": True,
                "output": "Opening Zoom.",
                "data": {"exe_path": zoom_exe},
            }

        # Fallback: shell start
        logger.warning("Zoom.exe not found at known paths. Trying shell fallback.")
        subprocess.Popen(
            ["cmd", "/c", "start", "Zoom.exe"],
            shell=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return {
            "success": True,
            "output": "Opening Zoom via shell fallback.",
        }

    except FileNotFoundError as exc:
        logger.error(f"Zoom executable not found: {exc}")
        return {"success": False, "output": f"Zoom not found: {exc}"}
    except Exception as exc:
        logger.error(f"Failed to open Zoom: {exc}")
        return {"success": False, "output": f"Error opening Zoom: {exc}"}
