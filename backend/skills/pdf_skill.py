"""
NexusAI — PDF Skill
Open PDF files with the system default viewer.
"""
import os
import subprocess
from typing import Dict, Any, Optional
from loguru import logger


async def open_pdf(file_path: str) -> Dict[str, Any]:
    """
    Open a PDF file using the system default viewer (Edge, Adobe, etc.).

    Args:
        file_path: Full path to the PDF file.

    Returns:
        Dict with 'success' and 'output'.
    """
    try:
        if not file_path:
            return {"success": False, "output": "No PDF file path provided."}

        if not os.path.exists(file_path):
            return {
                "success": False,
                "output": f"PDF file not found at: {file_path}"
            }

        if not file_path.lower().endswith('.pdf'):
            return {
                "success": False,
                "output": f"The file '{os.path.basename(file_path)}' is not a PDF."
            }

        # os.startfile uses the Windows default app association
        os.startfile(file_path)
        return {
            "success": True,
            "output": f"Opened '{os.path.basename(file_path)}' in the default PDF viewer.",
            "data": {"file": file_path}
        }
    except Exception as e:
        logger.error(f"PDF open error: {e}")
        return {"success": False, "output": f"Failed to open PDF: {str(e)}"}


async def open_pdf_in_browser(file_path: str) -> Dict[str, Any]:
    """Open PDF in Chrome/Edge browser as a fallback."""
    try:
        subprocess.Popen(
            ['cmd', '/c', 'start', 'chrome', file_path],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        return {
            "success": True,
            "output": f"Opened '{os.path.basename(file_path)}' in Chrome.",
        }
    except Exception as e:
        return {"success": False, "output": f"Could not open PDF in browser: {str(e)}"}
