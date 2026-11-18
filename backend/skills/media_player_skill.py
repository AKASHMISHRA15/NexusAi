"""
Media Player Skill
==================
Opens VLC or Windows Media Player, optionally playing a specific media file.
Falls back from VLC -> Windows Media Player -> Windows Media app URI scheme.
"""

import subprocess
import os
from typing import Dict, Any, Optional

from loguru import logger


VLC_PATHS = [
    r"C:\Program Files\VideoLAN\VLC\vlc.exe",
    r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe",
]

WMP_PATHS = [
    r"C:\Program Files\Windows Media Player\wmplayer.exe",
    r"C:\Program Files (x86)\Windows Media Player\wmplayer.exe",
]


def _find_exe(paths: list) -> Optional[str]:
    """Return the first existing executable from a list of candidate paths."""
    for path in paths:
        if os.path.isfile(path):
            return path
    return None


async def open_media_player(file_path: Optional[str] = None) -> Dict:
    """
    Open a media player application, optionally playing a specific file.

    Priority order:
      1. VLC (vlc.exe)
      2. Windows Media Player (wmplayer.exe)
      3. Windows Media app via ms-windows-music: URI scheme

    Args:
        file_path: Absolute path to a media file to open/play.
                   If None, the player opens to its default view.

    Returns:
        Dict with 'success' (bool), 'output' (str), and optional 'data' (dict).
    """
    try:
        # --- Try VLC ---
        vlc_exe = _find_exe(VLC_PATHS)
        if vlc_exe:
            cmd = [vlc_exe]
            if file_path:
                if not os.path.isfile(file_path):
                    return {
                        "success": False,
                        "output": f"Media file not found: {file_path}",
                    }
                cmd.append(file_path)
            logger.info(f"Launching VLC from: {vlc_exe}")
            subprocess.Popen(
                cmd,
                shell=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            msg = (
                f"Playing '{file_path}' in VLC."
                if file_path
                else "Opening VLC Media Player."
            )
            return {
                "success": True,
                "output": msg,
                "data": {"player": "VLC", "exe_path": vlc_exe, "file_path": file_path},
            }

        # --- Try Windows Media Player ---
        wmp_exe = _find_exe(WMP_PATHS)
        if wmp_exe:
            cmd = [wmp_exe]
            if file_path:
                if not os.path.isfile(file_path):
                    return {
                        "success": False,
                        "output": f"Media file not found: {file_path}",
                    }
                cmd.append(file_path)
            logger.info(f"Launching Windows Media Player from: {wmp_exe}")
            subprocess.Popen(
                cmd,
                shell=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            msg = (
                f"Playing '{file_path}' in Windows Media Player."
                if file_path
                else "Opening Windows Media Player."
            )
            return {
                "success": True,
                "output": msg,
                "data": {
                    "player": "Windows Media Player",
                    "exe_path": wmp_exe,
                    "file_path": file_path,
                },
            }

        # --- Fallback: Windows Media Player via shell start ---
        logger.warning("Known media player paths not found. Trying shell fallbacks.")
        if file_path:
            if not os.path.isfile(file_path):
                return {
                    "success": False,
                    "output": f"Media file not found: {file_path}",
                }
            subprocess.Popen(
                ["cmd", "/c", "start", "wmplayer.exe", file_path],
                shell=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return {
                "success": True,
                "output": f"Opening Windows Media Player (shell) with file: {file_path}.",
                "data": {"player": "wmplayer (shell)", "file_path": file_path},
            }

        # --- Fallback 2: Windows Media app URI ---
        subprocess.Popen(
            ["cmd", "/c", "start", "mswindowsmusic:"],
            shell=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return {
            "success": True,
            "output": "Opening Windows Groove Music / Media app.",
            "data": {"player": "mswindowsmusic:", "file_path": None},
        }

    except FileNotFoundError as exc:
        logger.error(f"Media player executable not found: {exc}")
        return {"success": False, "output": f"Media player not found: {exc}"}
    except Exception as exc:
        logger.error(f"Failed to open media player: {exc}")
        return {"success": False, "output": f"Error opening media player: {exc}"}
