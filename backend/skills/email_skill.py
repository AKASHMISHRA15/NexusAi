"""
NexusAI — Email Skill
Compose and open emails using the default mail client via mailto: URI.
"""
import subprocess
import urllib.parse
from typing import Dict, Any, Optional, List
from loguru import logger


async def compose_email(
    to: Optional[str] = None,
    subject: Optional[str] = None,
    body: Optional[str] = None,
    cc: Optional[str] = None
) -> Dict[str, Any]:
    """
    Open the default email client with a pre-filled compose window.

    Args:
        to: Recipient email address(es), comma-separated.
        subject: Email subject line.
        body: Email body text.
        cc: CC recipients, comma-separated.

    Returns:
        Dict with 'success' and 'output'.
    """
    try:
        params = {}
        if subject:
            params["subject"] = subject
        if body:
            params["body"] = body
        if cc:
            params["cc"] = cc

        recipient = to or ""
        query = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
        mailto_uri = f"mailto:{recipient}"
        if query:
            mailto_uri += f"?{query}"

        subprocess.Popen(
            ['cmd', '/c', 'start', '', mailto_uri],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            shell=False
        )

        parts = []
        if to:
            parts.append(f"To: {to}")
        if subject:
            parts.append(f"Subject: '{subject}'")

        summary = "Opened email compose window" + (f" — {', '.join(parts)}" if parts else ".")
        return {
            "success": True,
            "output": summary,
            "data": {"to": to, "subject": subject, "cc": cc}
        }
    except Exception as e:
        logger.error(f"Email compose error: {e}")
        return {"success": False, "output": f"Failed to open email client: {str(e)}"}


async def open_email_client() -> Dict[str, Any]:
    """Open the default email client inbox."""
    try:
        subprocess.Popen(
            ['cmd', '/c', 'start', '', 'mailto:'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            shell=False
        )
        return {"success": True, "output": "Opened default email client."}
    except Exception as e:
        return {"success": False, "output": f"Failed to open email client: {str(e)}"}
