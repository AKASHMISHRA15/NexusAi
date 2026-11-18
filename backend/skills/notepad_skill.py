"""
NexusAI — Notepad Skill
Open Notepad, create new files, and write text content to files.
"""
import subprocess
import os
import tempfile
from typing import Dict, Any, Optional
from loguru import logger


async def open_notepad(file_path: Optional[str] = None, content: Optional[str] = None) -> Dict[str, Any]:
    """
    Open Notepad, optionally with a file or with specific content written to a temp file.

    Args:
        file_path: Optional path to an existing file to open in Notepad.
        content: Optional text content to write to a new temp file and open.

    Returns:
        Dict with 'success' and 'output'.
    """
    try:
        if content:
            # Write content to a temp .txt file and open it
            tmp = tempfile.NamedTemporaryFile(
                mode='w', suffix='.txt', delete=False, encoding='utf-8'
            )
            tmp.write(content)
            tmp.close()
            subprocess.Popen(['notepad.exe', tmp.name])
            return {
                "success": True,
                "output": f"Opened Notepad with the provided content.",
                "data": {"file": tmp.name}
            }
        elif file_path:
            if not os.path.exists(file_path):
                return {"success": False, "output": f"File not found: {file_path}"}
            subprocess.Popen(['notepad.exe', file_path])
            return {
                "success": True,
                "output": f"Opened '{os.path.basename(file_path)}' in Notepad.",
                "data": {"file": file_path}
            }
        else:
            # Just open a blank Notepad
            subprocess.Popen(['notepad.exe'])
            return {"success": True, "output": "Opened a new blank Notepad window."}
    except Exception as e:
        logger.error(f"Notepad skill error: {e}")
        return {"success": False, "output": f"Failed to open Notepad: {str(e)}"}


async def create_text_file(file_path: str, content: str) -> Dict[str, Any]:
    """Write content to a text file and open it in Notepad."""
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True) if os.path.dirname(file_path) else None
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        subprocess.Popen(['notepad.exe', file_path])
        return {
            "success": True,
            "output": f"Created and opened '{os.path.basename(file_path)}' in Notepad.",
            "data": {"file": file_path}
        }
    except Exception as e:
        logger.error(f"Create text file error: {e}")
        return {"success": False, "output": f"Failed to create file: {str(e)}"}
