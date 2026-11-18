"""
Clipboard Skill
===============
Manage and interact with the Windows clipboard using pyperclip (read/write)
and pyautogui (open clipboard history overlay via Win+V).
"""

import subprocess
import os
from typing import Dict, Any, Optional

from loguru import logger

try:
    import pyperclip
except ImportError:
    pyperclip = None  # type: ignore

try:
    import pyautogui
except ImportError:
    pyautogui = None  # type: ignore


async def open_clipboard_history() -> Dict:
    """
    Open the Windows Clipboard History overlay using the Win+V keyboard shortcut.

    Requires Windows 10 1809+ and Clipboard History enabled in Settings.

    Returns:
        Dict with 'success' (bool) and 'output' (str) keys.
    """
    try:
        if pyautogui is None:
            return {
                "success": False,
                "output": "pyautogui is not installed. Run: pip install pyautogui",
            }
        logger.info("Opening Windows Clipboard History with Win+V.")
        pyautogui.hotkey("win", "v")
        return {
            "success": True,
            "output": "Opened Windows Clipboard History (Win+V).",
        }
    except Exception as exc:
        logger.error(f"Failed to open Clipboard History: {exc}")
        return {"success": False, "output": f"Error opening Clipboard History: {exc}"}


async def get_clipboard_text() -> Dict:
    """
    Retrieve the current text content of the clipboard.

    Returns:
        Dict with 'success' (bool), 'output' (str), and 'data' (dict) keys.
        'data' contains {'text': <clipboard_text>}.
    """
    try:
        if pyperclip is None:
            return {
                "success": False,
                "output": "pyperclip is not installed. Run: pip install pyperclip",
            }
        text = pyperclip.paste()
        if text:
            logger.info(f"Clipboard text retrieved ({len(text)} characters).")
            return {
                "success": True,
                "output": f"Clipboard contains: {text}",
                "data": {"text": text, "length": len(text)},
            }
        else:
            return {
                "success": True,
                "output": "Clipboard is empty.",
                "data": {"text": "", "length": 0},
            }
    except Exception as exc:
        logger.error(f"Failed to get clipboard text: {exc}")
        return {"success": False, "output": f"Error reading clipboard: {exc}"}


async def set_clipboard_text(text: str) -> Dict:
    """
    Copy the given text to the clipboard.

    Args:
        text: The string to write to the clipboard.

    Returns:
        Dict with 'success' (bool) and 'output' (str) keys.
    """
    try:
        if pyperclip is None:
            return {
                "success": False,
                "output": "pyperclip is not installed. Run: pip install pyperclip",
            }
        if not isinstance(text, str):
            return {
                "success": False,
                "output": "Provided text must be a string.",
            }
        pyperclip.copy(text)
        preview = text[:80] + ("..." if len(text) > 80 else "")
        logger.info(f"Clipboard set ({len(text)} characters).")
        return {
            "success": True,
            "output": f"Copied to clipboard: {preview}",
            "data": {"length": len(text)},
        }
    except Exception as exc:
        logger.error(f"Failed to set clipboard text: {exc}")
        return {"success": False, "output": f"Error writing to clipboard: {exc}"}
