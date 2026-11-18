"""
NexusAI — WhatsApp Skill
Open WhatsApp Desktop and optionally initiate a chat with a contact.
Uses the whatsapp:// URI scheme for deep linking.
"""
import subprocess
import urllib.parse
import tkinter as tk
from typing import Dict, Any, Optional
from loguru import logger


def _copy_to_clipboard(text: str):
    root = tk.Tk()
    root.withdraw()
    root.clipboard_clear()
    root.clipboard_append(text)
    root.update()
    root.destroy()


async def _paste_and_send_message(message: str):
    import asyncio
    import pyautogui

    _copy_to_clipboard(message)
    width, height = pyautogui.size()
    pyautogui.click(width // 2, max(100, height - 90))
    await asyncio.sleep(0.2)
    pyautogui.hotkey('ctrl', 'v')
    await asyncio.sleep(0.3)
    pyautogui.press('enter')


async def open_whatsapp(contact: Optional[str] = None, message: Optional[str] = None) -> Dict[str, Any]:
    """
    Open WhatsApp Desktop, optionally opening a specific contact chat.

    Args:
        contact: Contact name or phone number (e.g. '+919876543210').
        message: Pre-filled message text to load in the chat input.

    Returns:
        Dict with 'success' and 'output'.
    """
    try:
        import asyncio
        import pyautogui
        
        if contact and contact.startswith('+'):
            # International phone number — use wa.me deep link
            phone = contact.replace('+', '').replace(' ', '').replace('-', '')
            if message:
                encoded_msg = urllib.parse.quote(message)
                uri = f"https://wa.me/{phone}?text={encoded_msg}"
                subprocess.Popen(['cmd', '/c', 'start', '', uri], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=False)
                
                # Wait for app to load and press Enter to send
                await asyncio.sleep(5)
                await _paste_and_send_message(message)
                
                return {
                    "success": True,
                    "output": f"Opened WhatsApp and sent message to {contact}.",
                    "data": {"contact": contact, "message": message}
                }
            else:
                uri = f"https://wa.me/{phone}"
                subprocess.Popen(['cmd', '/c', 'start', '', uri], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=False)
                return {
                    "success": True,
                    "output": f"Opened WhatsApp chat with {contact}.",
                    "data": {"contact": contact}
                }
        else:
            # Open WhatsApp Desktop App
            subprocess.Popen(['cmd', '/c', 'start', '', 'WhatsApp:'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=False)
            
            if contact:
                # WhatsApp's UI can return several people with the same name. This
                # local skill cannot read those results safely, so it must never
                # select the first one or send a message to an ambiguous name.
                await asyncio.sleep(4) # Wait for WhatsApp to open fully
                pyautogui.hotkey('ctrl', 'n')
                await asyncio.sleep(0.5)
                _copy_to_clipboard(contact)
                pyautogui.hotkey('ctrl', 'v')
                await asyncio.sleep(1) # Wait for search results
                return {
                    "success": True,
                    "output": (
                        f"Opened WhatsApp and searched for '{contact}'. Select the correct contact in WhatsApp "
                        "before sending anything; provide an international phone number to let NexusAI open a specific chat."
                    ),
                    "data": {"contact": contact, "message": message}
                }
            else:
                return {
                    "success": True,
                    "output": "Opened WhatsApp Desktop.",
                    "data": {"contact": contact}
                }
    except Exception as e:
        logger.error(f"WhatsApp skill error: {e}")
        # Fallback: launch via app_launcher
        try:
            from skills.app_launcher import launch_app
            return await launch_app("WhatsApp")
        except Exception:
            return {"success": False, "output": "Something went wrong opening WhatsApp. Please try again."}


async def send_whatsapp_message(phone_number: str, message: str) -> Dict[str, Any]:
    """
    Open a WhatsApp chat with a phone number and pre-fill a message.

    Args:
        phone_number: Full international number e.g. '+919876543210'.
        message: Message text to pre-fill.

    Returns:
        Dict with 'success' and 'output'.
    """
    return await open_whatsapp(contact=phone_number, message=message)
