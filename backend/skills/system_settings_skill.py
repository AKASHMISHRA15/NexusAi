"""
System Settings Skill
=====================
Opens the Windows Settings app or a specific settings page using the
ms-settings: URI scheme. Supports a wide range of settings categories.
"""

import subprocess
import os
from typing import Dict, Any, Optional

from loguru import logger


# Mapping of friendly names to ms-settings: URIs
SETTINGS_MAP: Dict[str, str] = {
    "display": "ms-settings:display",
    "bluetooth": "ms-settings:bluetooth",
    "wifi": "ms-settings:network-wifi",
    "network": "ms-settings:network",
    "sound": "ms-settings:sound",
    "notifications": "ms-settings:notifications",
    "apps": "ms-settings:appsfeatures",
    "privacy": "ms-settings:privacy",
    "updates": "ms-settings:windowsupdate",
    "update": "ms-settings:windowsupdate",
    "storage": "ms-settings:storagesense",
    "theme": "ms-settings:personalization",
    "personalization": "ms-settings:personalization",
    "power": "ms-settings:powersleep",
    "sleep": "ms-settings:powersleep",
    "accounts": "ms-settings:accounts",
    "taskbar": "ms-settings:taskbar",
    "clock": "ms-settings:dateandtime",
    "time": "ms-settings:dateandtime",
    "date": "ms-settings:dateandtime",
    "language": "ms-settings:regionlanguage",
    "region": "ms-settings:regionlanguage",
    "accessibility": "ms-settings:easeofaccess",
    "ease": "ms-settings:easeofaccess",
    "mouse": "ms-settings:mousetouchpad",
    "touchpad": "ms-settings:mousetouchpad",
    "keyboard": "ms-settings:keyboard",
    "camera": "ms-settings:privacy-webcam",
    "microphone": "ms-settings:privacy-microphone",
    "vpn": "ms-settings:network-vpn",
    "proxy": "ms-settings:network-proxy",
    "firewall": "ms-settings:windowsdefender",
    "defender": "ms-settings:windowsdefender",
    "battery": "ms-settings:batterysaver",
    "backup": "ms-settings:backup",
    "recovery": "ms-settings:recovery",
    "about": "ms-settings:about",
    "startup": "ms-settings:startupapps",
}


async def open_settings(page: Optional[str] = None) -> Dict:
    """
    Open Windows Settings, optionally navigating to a specific settings page.

    Args:
        page: A friendly name for the settings page (e.g., 'display',
              'bluetooth', 'wifi', 'sound'). Case-insensitive. If None or
              unrecognized, opens the general Settings home page.

    Returns:
        Dict with 'success' (bool), 'output' (str), and 'data' (dict) keys.

    Available pages:
        display, bluetooth, wifi, network, sound, notifications, apps,
        privacy, updates, storage, theme, personalization, power, sleep,
        accounts, taskbar, clock, time, date, language, region,
        accessibility, mouse, touchpad, keyboard, camera, microphone,
        vpn, proxy, firewall, defender, battery, backup, recovery,
        about, startup
    """
    try:
        uri = "ms-settings:"  # Default: Settings home

        if page:
            page_key = page.lower().strip()
            if page_key in SETTINGS_MAP:
                uri = SETTINGS_MAP[page_key]
                logger.info(f"Opening Settings page '{page_key}': {uri}")
            else:
                logger.warning(
                    f"Unknown settings page '{page}'. Opening general settings."
                )

        subprocess.Popen(
            ["cmd", "/c", "start", "", uri],
            shell=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        page_label = page if page else "home"
        return {
            "success": True,
            "output": f"Opening Windows Settings ({page_label}).",
            "data": {
                "requested_page": page,
                "uri": uri,
                "available_pages": list(SETTINGS_MAP.keys()),
            },
        }

    except FileNotFoundError as exc:
        logger.error(f"Settings URI launch failed: {exc}")
        return {"success": False, "output": f"Settings not found: {exc}"}
    except Exception as exc:
        logger.error(f"Failed to open Settings: {exc}")
        return {"success": False, "output": f"Error opening Settings: {exc}"}
