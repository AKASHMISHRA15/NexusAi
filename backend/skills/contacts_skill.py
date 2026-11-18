"""
NexusAI — Contacts / Phone Skill
Open Windows People app and search contacts via ms-people: URI.
"""
import subprocess
import urllib.parse
from typing import Dict, Any, Optional
from loguru import logger


async def open_contacts(search_query: Optional[str] = None) -> Dict[str, Any]:
    """
    Open the Windows People (Contacts) app, optionally searching for a contact.

    Args:
        search_query: Optional name/phone to search for.

    Returns:
        Dict with 'success' and 'output'.
    """
    try:
        if search_query:
            encoded = urllib.parse.quote(search_query)
            uri = f"ms-people:search?SearchString={encoded}"
        else:
            uri = "ms-people:"

        subprocess.Popen(
            ['cmd', '/c', 'start', '', uri],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            shell=False
        )

        msg = f"Searched contacts for '{search_query}'." if search_query else "Opened Contacts app."
        return {
            "success": True,
            "output": msg,
            "data": {"search": search_query}
        }
    except Exception as e:
        logger.error(f"Contacts skill error: {e}")
        return {"success": False, "output": f"Failed to open Contacts: {str(e)}"}


async def open_phone_dialer(phone_number: Optional[str] = None) -> Dict[str, Any]:
    """
    Open the Windows phone dialer (Your Phone / Phone Link) or dial a number.

    Args:
        phone_number: Phone number to dial (optional).

    Returns:
        Dict with 'success' and 'output'.
    """
    try:
        if phone_number:
            # Use tel: URI scheme — opens Your Phone / Phone Link
            uri = f"tel:{phone_number}"
            subprocess.Popen(
                ['cmd', '/c', 'start', '', uri],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                shell=False
            )
            return {
                "success": True,
                "output": f"Dialing {phone_number} via Phone Link.",
                "data": {"number": phone_number}
            }
        else:
            # Open Phone Link app directly
            subprocess.Popen(
                ['cmd', '/c', 'start', 'ms-yourphone:'],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                shell=False
            )
            return {"success": True, "output": "Opened Phone Link app."}
    except Exception as e:
        logger.error(f"Phone skill error: {e}")
        return {"success": False, "output": f"Failed to open Phone app: {str(e)}"}
