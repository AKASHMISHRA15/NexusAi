"""
NexusAI — Alarms & Timers Skill
Open Windows Clock app for alarms and timers.
"""
import subprocess
from typing import Dict, Any, Optional
from loguru import logger

async def open_clock() -> Dict[str, Any]:
    """Open Windows Clock app."""
    try:
        subprocess.Popen(
            ['cmd', '/c', 'start', 'ms-clock:'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=False
        )
        return {"success": True, "output": "Opened Windows Clock."}
    except Exception as e:
        logger.error(f"Clock skill error: {e}")
        return {"success": False, "output": f"Failed to open Clock: {str(e)}"}

async def set_alarm(time_str: Optional[str] = None, label: Optional[str] = None) -> Dict[str, Any]:
    """Open Windows Clock alarms page."""
    try:
        subprocess.Popen(
            ['cmd', '/c', 'start', 'ms-clock:alarm'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=False
        )
        return {"success": True, "output": "Opened Windows Alarms. Please set your specific alarm manually in the app."}
    except Exception as e:
        return {"success": False, "output": f"Failed to open Alarms: {str(e)}"}

async def open_timer() -> Dict[str, Any]:
    """Open Windows Clock timer page."""
    try:
        subprocess.Popen(
            ['cmd', '/c', 'start', 'ms-clock:timer'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=False
        )
        return {"success": True, "output": "Opened Windows Timers."}
    except Exception as e:
        return {"success": False, "output": f"Failed to open Timer: {str(e)}"}
