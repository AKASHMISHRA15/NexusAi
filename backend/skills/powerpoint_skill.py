"""
NexusAI — PowerPoint Skill
Open, create, and present PowerPoint files.
"""
import subprocess
import os
from typing import Dict, Any, Optional
from loguru import logger


POWERPOINT_PATHS = [
    r"C:\Program Files\Microsoft Office\root\Office16\POWERPNT.EXE",
    r"C:\Program Files (x86)\Microsoft Office\root\Office16\POWERPNT.EXE",
    r"C:\Program Files\Microsoft Office\Office16\POWERPNT.EXE",
    r"C:\Program Files (x86)\Microsoft Office\Office16\POWERPNT.EXE",
]


def _find_powerpoint() -> Optional[str]:
    """Find the PowerPoint executable on this machine."""
    for path in POWERPOINT_PATHS:
        if os.path.exists(path):
            return path
    return None


async def open_powerpoint(file_path: Optional[str] = None, present: bool = False) -> Dict[str, Any]:
    """
    Open PowerPoint, optionally with a specific file or in presentation mode.

    Args:
        file_path: Path to .pptx/.ppt file to open.
        present: If True, open directly in slideshow/presentation mode.

    Returns:
        Dict with 'success' and 'output'.
    """
    try:
        ppt_exe = _find_powerpoint()

        if file_path:
            if not os.path.exists(file_path):
                return {"success": False, "output": f"File not found: {file_path}"}

            if present:
                # /S flag starts in slideshow mode
                if ppt_exe:
                    subprocess.Popen([ppt_exe, '/S', file_path],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                else:
                    os.startfile(file_path)
                return {
                    "success": True,
                    "output": f"Started presentation: '{os.path.basename(file_path)}'.",
                    "data": {"file": file_path, "mode": "slideshow"}
                }
            else:
                os.startfile(file_path)
                return {
                    "success": True,
                    "output": f"Opened '{os.path.basename(file_path)}' in PowerPoint.",
                    "data": {"file": file_path}
                }
        else:
            # Open PowerPoint with a new blank presentation
            if ppt_exe:
                subprocess.Popen([ppt_exe],
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                subprocess.Popen(
                    ['cmd', '/c', 'start', '', 'powerpnt.exe'],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=False
                )
            return {"success": True, "output": "Opened Microsoft PowerPoint."}

    except Exception as e:
        logger.error(f"PowerPoint skill error: {e}")
        return {"success": False, "output": f"Failed to open PowerPoint: {str(e)}"}
