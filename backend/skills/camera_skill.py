"""
NexusAI — Camera Skill
Open Windows Camera app.
"""
import subprocess
from typing import Dict, Any
from loguru import logger


async def open_camera() -> Dict[str, Any]:
    """
    Open the Windows Camera application.

    Returns:
        Dict with 'success' and 'output'.
    """
    try:
        subprocess.Popen(
            ['cmd', '/c', 'start', 'microsoft.windows.camera:'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            shell=False
        )
        return {
            "success": True,
            "output": "Opened Windows Camera.",
            "data": {"app": "Windows Camera"}
        }
    except Exception as e:
        logger.error(f"Camera skill error: {e}")
        return {"success": False, "output": f"Failed to open Camera: {str(e)}"}


async def open_camera_video() -> Dict[str, Any]:
    """Open Windows Camera directly in video mode."""
    try:
        subprocess.Popen(
            ['cmd', '/c', 'start', 'microsoft.windows.camera:/?Mode=Video'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            shell=False
        )
        return {"success": True, "output": "Opened Windows Camera in Video mode."}
    except Exception as e:
        return {"success": False, "output": f"Failed to open Camera in video mode: {str(e)}"}
