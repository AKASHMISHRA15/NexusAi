"""
Telegram Skill
==============
Opens Telegram Desktop app or navigates to a specific chat/user by username
using the tg:// URI scheme.
"""

import subprocess
import os
from typing import Dict, Any, Optional

from loguru import logger


async def open_telegram(username: Optional[str] = None) -> Dict:
    """
    Open Telegram Desktop application, optionally opening a specific chat.

    Args:
        username: Telegram username (without @) to open a specific chat.
                  If None, opens the main Telegram window.

    Returns:
        Dict with 'success' (bool) and 'output' (str) keys.
    """
    try:
        if username:
            # Strip leading @ if user included it
            clean_username = username.lstrip("@")
            uri = f"tg://resolve?domain={clean_username}"
            logger.info(f"Opening Telegram chat for user: {clean_username}")
            subprocess.Popen(
                ["cmd", "/c", "start", "", uri],
                shell=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return {
                "success": True,
                "output": f"Opening Telegram chat with @{clean_username}.",
                "data": {"username": clean_username, "uri": uri},
            }
        else:
            logger.info("Opening Telegram Desktop.")
            subprocess.Popen(
                ["cmd", "/c", "start", "Telegram.exe"],
                shell=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return {
                "success": True,
                "output": "Opening Telegram Desktop.",
            }
    except FileNotFoundError as exc:
        logger.error(f"Telegram executable not found: {exc}")
        return {"success": False, "output": f"Telegram not found: {exc}"}
    except Exception as exc:
        logger.error(f"Failed to open Telegram: {exc}")
        return {"success": False, "output": f"Error opening Telegram: {exc}"}
