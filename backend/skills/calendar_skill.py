"""
NexusAI — Calendar Skill
Open Windows Calendar app and create events via URI scheme.
"""
import subprocess
from typing import Dict, Any, Optional
from loguru import logger
import urllib.parse


async def open_calendar() -> Dict[str, Any]:
    """Open the Windows Calendar app."""
    try:
        subprocess.Popen(
            ['cmd', '/c', 'start', 'outlookcal:'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            shell=False
        )
        return {"success": True, "output": "Opened Windows Calendar."}
    except Exception as e:
        logger.error(f"Calendar open error: {e}")
        return {"success": False, "output": f"Failed to open Calendar: {str(e)}"}


async def create_calendar_event(
    title: str,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    location: Optional[str] = None,
    description: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a calendar event by opening the Windows Calendar new event dialog.

    Args:
        title: Event title/subject.
        start_time: Event start time (e.g. '2024-07-20T10:00:00').
        end_time: Event end time (e.g. '2024-07-20T11:00:00').
        location: Optional event location.
        description: Optional event description/notes.

    Returns:
        Dict with 'success' and 'output'.
    """
    try:
        # Build the outlookcal URI for creating new events
        params = {"subject": title}
        if start_time:
            params["startdt"] = start_time
        if end_time:
            params["enddt"] = end_time
        if location:
            params["location"] = location
        if description:
            params["body"] = description

        query = urllib.parse.urlencode(params)
        uri = f"outlookcal:?cmd=new&{query}"

        subprocess.Popen(
            ['cmd', '/c', 'start', '', uri],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            shell=False
        )

        return {
            "success": True,
            "output": f"Opened Calendar to create event: '{title}'.",
            "data": {"title": title, "start": start_time, "end": end_time, "location": location}
        }
    except Exception as e:
        logger.error(f"Calendar event creation error: {e}")
        return {"success": False, "output": f"Failed to create calendar event: {str(e)}"}
