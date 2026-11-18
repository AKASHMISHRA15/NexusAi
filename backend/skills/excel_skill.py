"""
Microsoft Excel Skill
=====================
Opens Microsoft Excel, searching common Office installation paths.
Optionally opens a specific spreadsheet file.
"""

import subprocess
import os
from typing import Dict, Any, Optional

from loguru import logger


EXCEL_PATHS = [
    r"C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE",
    r"C:\Program Files (x86)\Microsoft Office\root\Office16\EXCEL.EXE",
    r"C:\Program Files\Microsoft Office\Office16\EXCEL.EXE",
    r"C:\Program Files (x86)\Microsoft Office\Office16\EXCEL.EXE",
    r"C:\Program Files\Microsoft Office\Office15\EXCEL.EXE",
    r"C:\Program Files (x86)\Microsoft Office\Office15\EXCEL.EXE",
]


def _find_excel_exe() -> Optional[str]:
    """Search common paths for EXCEL.EXE and return the first found path."""
    for path in EXCEL_PATHS:
        if os.path.isfile(path):
            return path
    return None


async def open_excel(file_path: Optional[str] = None) -> Dict:
    """
    Open Microsoft Excel, optionally opening a specific spreadsheet.

    Args:
        file_path: Absolute path to a .xlsx/.xls/.csv file to open.
                   If None, Excel opens to its start screen.

    Returns:
        Dict with 'success' (bool) and 'output' (str) keys.
    """
    try:
        excel_exe = _find_excel_exe()

        if excel_exe:
            cmd = [excel_exe]
            if file_path:
                if not os.path.isfile(file_path):
                    return {
                        "success": False,
                        "output": f"File not found: {file_path}",
                    }
                cmd.append(file_path)
            logger.info(f"Launching Excel from: {excel_exe}")
            subprocess.Popen(
                cmd,
                shell=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            msg = (
                f"Opening Excel with file: {file_path}"
                if file_path
                else "Opening Microsoft Excel."
            )
            return {
                "success": True,
                "output": msg,
                "data": {"exe_path": excel_exe, "file_path": file_path},
            }
        else:
            # Fallback: try via shell start
            logger.warning("EXCEL.EXE not found at known paths. Trying fallback.")
            if file_path:
                subprocess.Popen(
                    ["cmd", "/c", "start", "excel.exe", file_path],
                    shell=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                return {
                    "success": True,
                    "output": f"Opening Excel via fallback with file: {file_path}.",
                }
            else:
                subprocess.Popen(
                    ["cmd", "/c", "start", "excel.exe"],
                    shell=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                return {
                    "success": True,
                    "output": "Opening Microsoft Excel via fallback.",
                }
    except FileNotFoundError as exc:
        logger.error(f"Excel executable not found: {exc}")
        return {"success": False, "output": f"Microsoft Excel not found: {exc}"}
    except Exception as exc:
        logger.error(f"Failed to open Microsoft Excel: {exc}")
        return {"success": False, "output": f"Error opening Microsoft Excel: {exc}"}
