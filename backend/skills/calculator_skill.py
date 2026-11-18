"""
Calculator Skill
================
Opens the Windows Calculator application (calc.exe).
"""

import subprocess
import os
from typing import Dict, Any, Optional

from loguru import logger


async def open_calculator() -> Dict:
    """
    Open the Windows Calculator application.

    Returns:
        Dict with 'success' (bool) and 'output' (str) keys.
    """
    try:
        logger.info("Opening Windows Calculator.")
        subprocess.Popen(
            ["cmd", "/c", "start", "calc.exe"],
            shell=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return {
            "success": True,
            "output": "Opening Windows Calculator.",
        }
    except FileNotFoundError as exc:
        logger.error(f"Calculator executable not found: {exc}")
        return {"success": False, "output": f"Calculator not found: {exc}"}
    except Exception as exc:
        logger.error(f"Failed to open Calculator: {exc}")
        return {"success": False, "output": f"Error opening Calculator: {exc}"}
