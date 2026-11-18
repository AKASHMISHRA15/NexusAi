"""
Microsoft Word Skill
====================
Opens Microsoft Word, searching common Office installation paths.
Optionally opens a specific document file.
"""

import subprocess
import os
from typing import Dict, Any, Optional

from loguru import logger


WORD_PATHS = [
    r"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE",
    r"C:\Program Files (x86)\Microsoft Office\root\Office16\WINWORD.EXE",
    r"C:\Program Files\Microsoft Office\Office16\WINWORD.EXE",
    r"C:\Program Files (x86)\Microsoft Office\Office16\WINWORD.EXE",
    r"C:\Program Files\Microsoft Office\Office15\WINWORD.EXE",
    r"C:\Program Files (x86)\Microsoft Office\Office15\WINWORD.EXE",
]


def _find_word_exe() -> Optional[str]:
    """Search common paths for WINWORD.EXE and return the first found path."""
    for path in WORD_PATHS:
        if os.path.isfile(path):
            return path
    return None


async def open_word(file_path: Optional[str] = None) -> Dict:
    """
    Open Microsoft Word, optionally opening a specific document.

    Args:
        file_path: Absolute path to a .docx/.doc file to open.
                   If None, Word opens to its start screen.

    Returns:
        Dict with 'success' (bool) and 'output' (str) keys.
    """
    try:
        word_exe = _find_word_exe()

        if word_exe:
            cmd = [word_exe]
            if file_path:
                if not os.path.isfile(file_path):
                    return {
                        "success": False,
                        "output": f"File not found: {file_path}",
                    }
                cmd.append(file_path)
            logger.info(f"Launching Word from: {word_exe}")
            subprocess.Popen(
                cmd,
                shell=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            msg = (
                f"Opening Word with file: {file_path}"
                if file_path
                else "Opening Microsoft Word."
            )
            return {
                "success": True,
                "output": msg,
                "data": {"exe_path": word_exe, "file_path": file_path},
            }
        else:
            # Fallback: try via shell start
            logger.warning("WINWORD.EXE not found at known paths. Trying fallback.")
            if file_path:
                subprocess.Popen(
                    ["cmd", "/c", "start", "winword.exe", file_path],
                    shell=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                return {
                    "success": True,
                    "output": f"Opening Word via fallback with file: {file_path}.",
                }
            else:
                subprocess.Popen(
                    ["cmd", "/c", "start", "winword.exe"],
                    shell=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                return {
                    "success": True,
                    "output": "Opening Microsoft Word via fallback.",
                }
    except FileNotFoundError as exc:
        logger.error(f"Word executable not found: {exc}")
        return {"success": False, "output": f"Microsoft Word not found: {exc}"}
    except Exception as exc:
        logger.error(f"Failed to open Microsoft Word: {exc}")
        return {"success": False, "output": f"Error opening Microsoft Word: {exc}"}
