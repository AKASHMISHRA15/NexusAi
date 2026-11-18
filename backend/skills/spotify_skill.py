"""
NexusAI — Spotify Skill
Open Spotify and play music using spotify: URI schemes.
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


async def open_spotify(search_query: Optional[str] = None) -> Dict[str, Any]:
    """
    Open Spotify, optionally searching for a specific track, artist, or album.

    Args:
        search_query: Optional search query.

    Returns:
        Dict with 'success' and 'output'.
    """
    try:
        if search_query:
            encoded_query = urllib.parse.quote(search_query)
            uri = f"spotify:search:{encoded_query}"
        else:
            uri = "spotify:"

        subprocess.Popen(
            ['cmd', '/c', 'start', '', uri],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=False
        )

        # Wait for Spotify to open and process the URI, then press Play using Media Keys
        import asyncio
        import ctypes
        
        await asyncio.sleep(4)
        
        if search_query:
            # If we just searched, we might need to hit enter on the top result
            try:
                import pyautogui
                width, height = pyautogui.size()
                pyautogui.click(width // 2, height // 2)
                await asyncio.sleep(0.2)
                pyautogui.hotkey('ctrl', 'l')
                await asyncio.sleep(0.1)
                _copy_to_clipboard(search_query)
                pyautogui.hotkey('ctrl', 'v')
                await asyncio.sleep(0.7)
                pyautogui.press('enter')
                await asyncio.sleep(1.2)
                pyautogui.press('tab', presses=2, interval=0.1)
                pyautogui.press('enter')
                await asyncio.sleep(1.2)
            except Exception as e:
                logger.warning(f"PyAutoGUI not available for Spotify search select: {e}")
                
        # Send Media Play/Pause (VK_MEDIA_PLAY_PAUSE = 0xB3)
        ctypes.windll.user32.keybd_event(0xB3, 0, 0, 0) # Key down
        ctypes.windll.user32.keybd_event(0xB3, 0, 2, 0) # Key up

        output = f"Opened Spotify, searched for '{search_query}', and pressed Play." if search_query else "Opened Spotify and pressed Play."
        return {
            "success": True,
            "output": output,
            "data": {"search": search_query}
        }
    except Exception as e:
        logger.error(f"Spotify skill error: {e}")
        return {"success": False, "output": "Something went wrong opening Spotify. Please try again."}
