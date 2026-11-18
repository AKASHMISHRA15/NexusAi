"""
NexusAI — System Context Collector
Gathers real-time OS information to give the agent situational awareness.
"""
import psutil
import subprocess
import os
import platform
from typing import Dict, Any, List
from loguru import logger
from datetime import datetime


def get_running_applications() -> List[str]:
    """Returns a list of currently running application names."""
    try:
        apps = []
        for proc in psutil.process_iter(['name', 'status']):
            try:
                if proc.info['status'] == 'running':
                    name = proc.info['name']
                    if name and name not in apps and not name.endswith('svchost.exe'):
                        apps.append(name)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        # Filter to user-facing apps
        gui_apps = [a for a in apps if any(
            kw in a.lower() for kw in [
                'chrome', 'firefox', 'edge', 'whatsapp', 'word', 'excel',
                'powerpoint', 'notepad', 'explorer', 'code', 'acrobat',
                'vlc', 'spotify', 'discord', 'teams', 'outlook', 'zoom', 'lm'
            ]
        )]
        return gui_apps[:15]  # Return top 15 relevant apps
    except Exception as e:
        logger.warning(f"Could not get running apps: {e}")
        return []


def get_connected_printers() -> List[Dict[str, str]]:
    """Returns list of connected printers using PowerShell."""
    try:
        result = subprocess.run(
            ["powershell", "-Command",
             "Get-Printer | Select-Object Name,DriverName,PortName | ConvertTo-Json"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            import json
            data = json.loads(result.stdout)
            if isinstance(data, dict):
                data = [data]
            return [{"name": p.get("Name", ""), "driver": p.get("DriverName", "")} 
                    for p in data]
    except Exception as e:
        logger.warning(f"Could not get printers: {e}")
    return []


def get_recent_files(count: int = 5) -> List[str]:
    """Returns list of recently modified files in Desktop/Documents."""
    try:
        import os
        from pathlib import Path
        
        home = Path.home()
        dirs_to_check = [home / "Desktop", home / "Documents", home / "Downloads"]
        
        files = []
        for loc in dirs_to_check:
            if os.path.exists(loc):
                for f in os.listdir(loc):
                    fp = os.path.join(loc, f)
                    if os.path.isfile(fp):
                        files.append((os.path.getmtime(fp), fp))
        files.sort(reverse=True)
        return [f[1] for f in files[:count]]
    except Exception as e:
        logger.warning(f"Could not get recent files: {e}")
        return []


def get_system_info() -> Dict[str, Any]:
    """Returns a live resource snapshot for the agent and dashboard."""
    try:
        os_name = platform.system()
        if os_name == "Windows":
            release = platform.release()
            os_name = f"Windows {release}"
            
        memory = psutil.virtual_memory()
        system_drive = os.environ.get("SystemDrive", "C:") + "\\"
        disk = psutil.disk_usage(system_drive)
        battery = psutil.sensors_battery()
        network = psutil.net_io_counters()
        return {
            "os": os_name,
            "os_version": platform.version()[:50],
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "memory_percent": memory.percent,
            "memory_used_gb": round(memory.used / (1024**3), 1),
            "memory_total_gb": round(memory.total / (1024**3), 1),
            "disk_percent": disk.percent,
            "disk_used_gb": round(disk.used / (1024**3), 1),
            "disk_total_gb": round(disk.total / (1024**3), 1),
            "disk_free_gb": round(disk.free / (1024**3), 1),
            "battery_percent": round(battery.percent, 0) if battery else None,
            "battery_plugged": battery.power_plugged if battery else None,
            "network_bytes_sent": network.bytes_sent,
            "network_bytes_recv": network.bytes_recv,
        }
    except Exception as e:
        logger.warning(f"Could not get system info: {e}")
        return {}


def collect_system_context() -> Dict[str, Any]:
    """
    Full system context snapshot. Called at the start of each agent run.
    Gives the agent situational awareness of what's running on the user's PC.
    """
    return {
        "timestamp": datetime.now().isoformat(),
        "running_apps": get_running_applications(),
        "printers": get_connected_printers(),
        "recent_files": get_recent_files(),
        "system": get_system_info(),
        "username": os.environ.get("USERNAME", "User"),
    }
