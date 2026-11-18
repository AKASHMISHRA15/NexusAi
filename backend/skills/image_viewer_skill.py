"""
Image Viewer Skill
==================
Opens the Windows Photos app, optionally viewing a specific image file.
Uses os.startfile for individual files (invokes the system default viewer)
and the ms-photos: URI scheme to launch Photos without a specific file.
"""

import subprocess
import os
from typing import Dict, Any, Optional

from loguru import logger


async def open_image(file_path: Optional[str] = None) -> Dict:
    """
    Open an image file or launch the Windows Photos app.

    Args:
        file_path: Absolute path to an image file to open.
                   If None, the Windows Photos app is launched.

    Returns:
        Dict with 'success' (bool) and 'output' (str) keys.
    """
    try:
        if file_path:
            if not os.path.isfile(file_path):
                return {
                    "success": False,
                    "output": f"Image file not found: {file_path}",
                }
            logger.info(f"Opening image file: {file_path}")
            # os.startfile uses the Windows default image viewer association
            os.startfile(file_path)
            return {
                "success": True,
                "output": f"Opening image: {file_path}",
                "data": {"file_path": file_path},
            }
        else:
            logger.info("Opening Windows Photos app.")
            subprocess.Popen(
                ["cmd", "/c", "start", "ms-photos:"],
                shell=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return {
                "success": True,
                "output": "Opening Windows Photos app.",
            }
    except OSError as exc:
        logger.error(f"OS error while opening image viewer: {exc}")
        return {"success": False, "output": f"OS error: {exc}"}
    except Exception as exc:
        logger.error(f"Failed to open image viewer: {exc}")
        return {"success": False, "output": f"Error opening image viewer: {exc}"}
