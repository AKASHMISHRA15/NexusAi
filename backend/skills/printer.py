"""
NexusAI — Printer Skill
Lists printers and sends print jobs via Windows.
"""
import subprocess
import os
from typing import Dict, Any, Optional, List
from loguru import logger


async def get_printers() -> List[Dict[str, str]]:
    """Get list of installed printers via PowerShell."""
    try:
        result = subprocess.run(
            ["powershell", "-Command",
             "Get-Printer | Select-Object Name,DriverName,PrinterStatus | ConvertTo-Json -Compress"],
            capture_output=True, text=True, timeout=8
        )
        if result.returncode == 0 and result.stdout.strip():
            import json
            data = json.loads(result.stdout)
            if isinstance(data, dict):
                data = [data]
            return [
                {
                    "name": p.get("Name", ""),
                    "driver": p.get("DriverName", ""),
                    "status": str(p.get("PrinterStatus", ""))
                }
                for p in data if p.get("Name")
            ]
    except Exception as e:
        logger.warning(f"Could not list printers: {e}")
    return []


async def print_file(
    file_path: str,
    printer_name: Optional[str] = None,
    copies: int = 1
) -> Dict[str, Any]:
    """
    Send a file to the printer.
    
    Args:
        file_path: Full path to the file to print
        printer_name: Optional specific printer name
        copies: Number of copies
        
    Returns:
        Dict with success, output
    """
    if not os.path.exists(file_path):
        return {
            "success": False,
            "output": f"File not found: {file_path}"
        }
    
    filename = os.path.basename(file_path)
    ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if printer_name:
            # Print to specific printer using PowerShell
            ps_cmd = f'Start-Process -FilePath "{file_path}" -Verb Print -WindowStyle Hidden'
            result = subprocess.run(
                ["powershell", "-Command", ps_cmd],
                capture_output=True, text=True, timeout=15
            )
            if result.returncode == 0:
                return {
                    "success": True,
                    "output": f"Print job sent: {filename} → {printer_name}",
                    "data": {"file": file_path, "printer": printer_name, "copies": copies}
                }
        
        # Default: use Windows shell print verb
        if ext in ['.pdf', '.docx', '.doc', '.txt', '.xlsx', '.xls', '.pptx', '.ppt']:
            os.startfile(file_path, 'print')
            return {
                "success": True,
                "output": f"Print job sent: {filename} → default printer",
                "data": {"file": file_path, "printer": "default", "copies": copies}
            }
        else:
            # Use PowerShell for other file types
            ps_cmd = f'Start-Process -FilePath "{file_path}" -Verb Print'
            subprocess.Popen(["powershell", "-Command", ps_cmd])
            return {
                "success": True,
                "output": f"Sent {filename} to printer",
                "data": {"file": file_path}
            }
    except Exception as e:
        logger.error(f"Print error: {e}")
        return {
            "success": False,
            "output": f"Print failed: {str(e)}"
        }
