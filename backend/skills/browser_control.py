"""
NexusAI — Browser Control Skill
Opens Chrome, navigates URLs, performs searches.
"""
import subprocess
import webbrowser
import urllib.parse
from typing import Dict, Any, Optional
from loguru import logger

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Users\{username}\AppData\Local\Google\Chrome\Application\chrome.exe",
]

EDGE_PATHS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

async def open_url(
    url: Optional[str] = None,
    search_query: Optional[str] = None,
    browser: str = "chrome"  # 'chrome', 'edge', or 'default'
) -> Dict[str, Any]:
    """
    Open a URL or search query in Chrome, Edge, or default browser.
    """
    if search_query and not url:
        encoded = urllib.parse.quote_plus(search_query)
        url = f"https://www.google.com/search?q={encoded}"
    
    if not url:
        return {"success": False, "output": "No URL or search query provided"}
    
    # Ensure URL has scheme
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    
    try:
        import os
        username = os.environ.get("USERNAME", "")
        
        target_path = None
        used_browser = browser
        
        if browser.lower() == "edge":
            for path in EDGE_PATHS:
                if os.path.exists(path):
                    target_path = path
                    break
        elif browser.lower() == "chrome":
            for path in CHROME_PATHS:
                expanded = path.replace("{username}", username)
                if os.path.exists(expanded):
                    target_path = expanded
                    break
        
        if target_path:
            subprocess.Popen([target_path, url])
            action = "Searched for" if search_query else "Opened"
            target = f"'{search_query}'" if search_query else url
            return {
                "success": True,
                "output": f"{action} {target} in {used_browser.title()}",
                "data": {"url": url, "browser": used_browser}
            }
        else:
            # Fallback to default browser
            webbrowser.open(url)
            return {
                "success": True,
                "output": f"Opened {url} in default browser",
                "data": {"url": url, "browser": "default"}
            }
    except Exception as e:
        logger.error(f"Browser control error: {e}")
        # Last resort fallback
        try:
            webbrowser.open(url)
            return {"success": True, "output": f"Opened {url} in browser"}
        except Exception as e2:
            return {"success": False, "output": f"Could not open browser: {str(e2)}"}

async def open_chrome(url: Optional[str] = None, search_query: Optional[str] = None) -> Dict[str, Any]:
    return await open_url(url, search_query, browser="chrome")

async def open_edge(url: Optional[str] = None, search_query: Optional[str] = None) -> Dict[str, Any]:
    # If no URL or search, just open Edge to its default new tab
    if not url and not search_query:
        import os
        for path in EDGE_PATHS:
            if os.path.exists(path):
                import subprocess
                subprocess.Popen([path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return {"success": True, "output": "Microsoft Edge has been opened successfully."}
        # Fallback: use the registered msedge.exe
        import subprocess
        subprocess.Popen(["cmd", "/c", "start", "", "msedge.exe"], shell=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"success": True, "output": "Microsoft Edge has been opened successfully."}
    return await open_url(url, search_query, browser="edge")
