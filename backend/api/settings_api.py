"""
NexusAI — Settings & Status REST API
"""
import os
import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from config.settings import settings
from llm.client import test_connection
from agent.nodes.system_context import collect_system_context
from skills.printer import get_printers

router = APIRouter(prefix="/api")
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"


class SettingsUpdate(BaseModel):
    llm_provider: Optional[str] = None
    lm_studio_base_url: Optional[str] = None
    lm_studio_model: Optional[str] = None
    ngrok_base_url: Optional[str] = None


class LaunchRequest(BaseModel):
    """A fixed, local action issued by a workspace button."""
    app_name: str


class OpenPathRequest(BaseModel):
    path: str
    is_folder: bool = False


@router.get("/status")
async def get_status():
    """Returns backend health and current configuration."""
    return {
        "status": "running",
        "app_name": settings.app_name,
        "llm_provider": settings.llm_provider,
        "llm_model": settings.get_llm_model(),
        "llm_base_url": settings.get_llm_base_url(),
    }


@router.get("/llm/test")
async def test_llm_connection():
    """Tests the current LLM connection and returns result."""
    result = await test_connection()
    return result


@router.get("/system")
async def get_system_context():
    """Returns current system context (running apps, printers, etc.)."""
    context = collect_system_context()
    return context


@router.get("/files")
async def list_local_files(location: str = Query("desktop", pattern="^(desktop|documents|downloads|pictures|music|videos)$")):
    """Return a safe, read-only view of common user folders for the workspace."""
    home = Path.home()
    candidates = {
        "desktop": [home / "OneDrive" / "Desktop", home / "Desktop"],
        "documents": [home / "OneDrive" / "Documents", home / "Documents"],
        "downloads": [home / "Downloads"],
        "pictures": [home / "OneDrive" / "Pictures", home / "Pictures"],
        "music": [home / "OneDrive" / "Music", home / "Music"],
        "videos": [home / "OneDrive" / "Videos", home / "Videos"],
    }
    target = next((folder for folder in candidates[location] if folder.exists()), candidates[location][-1])
    if not target.exists():
        return {"location": location, "items": []}
    try:
        entries = sorted(target.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower()))[:80]
        return {"location": location, "items": [{
            "name": entry.name,
            "path": str(entry),
            "is_dir": entry.is_dir(),
            "size": "—" if entry.is_dir() else f"{entry.stat().st_size / 1024:.1f} KB",
            "modified": entry.stat().st_mtime,
        } for entry in entries]}
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not read folder: {exc}") from exc


@router.post("/launch")
async def launch_workspace_app(request: LaunchRequest):
    """Launch an allowlisted Windows app without routing a UI click through the chat model."""
    from skills.app_launcher import launch_app
    return await launch_app(request.app_name)


@router.post("/open-path")
async def open_workspace_path(request: OpenPathRequest):
    """Open a path selected from the read-only File Explorer workspace."""
    from skills.file_manager import open_file, open_folder
    return await (open_folder(request.path) if request.is_folder else open_file(request.path))


@router.get("/web-search")
async def web_search(q: str = Query(..., min_length=1, max_length=300)):
    """Expose the same live web search used by the agent to the browser workspace."""
    from skills.web_search_skill import search_web
    result = await search_web(q)
    return result.get("data", {"query": q, "results": []})


@router.get("/printers")
async def list_printers():
    """Returns list of connected printers."""
    printers = await get_printers()
    return {"printers": printers, "count": len(printers)}


@router.get("/skills")
async def list_skills():
    """Returns list of available skill modules and their status."""
    from config.skills_config import SKILL_NOTIFICATION_KEYS, get_skills_state, normalize_notification_app
    
    state = get_skills_state()
    
    skills = [
        # ── System & Files ──────────────────────────────────────────────
        {
            "id": "file_manager",
            "name": "File Explorer",
            "description": "Search, open, move, and find files and folders across your Windows file system.",
            "icon": "folder",
            "status": "active",
            "category": "System"
        },
        {
            "id": "app_launcher",
            "name": "App Launcher",
            "description": "Launch and switch between any installed Windows application instantly.",
            "icon": "layout-grid",
            "status": "active",
            "category": "System"
        },
        {
            "id": "app_closer",
            "name": "App Closer",
            "description": "Close or terminate any running Windows application by name.",
            "icon": "x-circle",
            "status": "active",
            "category": "System"
        },
        {
            "id": "system_settings",
            "name": "System Settings",
            "description": "Open Windows Settings like display, bluetooth, wifi, sound, and more.",
            "icon": "settings",
            "status": "active",
            "category": "System"
        },
        # ── Productivity ────────────────────────────────────────────────
        {
            "id": "notepad",
            "name": "Notepad",
            "description": "Open Notepad, create new text files, and write content to files instantly.",
            "icon": "file-text",
            "status": "active",
            "category": "Productivity"
        },
        {
            "id": "powerpoint",
            "name": "Microsoft PowerPoint",
            "description": "Open and present PowerPoint files. Launch slideshows directly from chat.",
            "icon": "presentation",
            "status": "active",
            "category": "Productivity"
        },
        {
            "id": "pdf_reader",
            "name": "PDF Reader",
            "description": "Open any PDF file using your system's default viewer (Edge, Adobe, etc.).",
            "icon": "book-open",
            "status": "active",
            "category": "Productivity"
        },
        {
            "id": "calendar",
            "name": "Calendar",
            "description": "Open Windows Calendar and create events with title, time, and location.",
            "icon": "calendar",
            "status": "active",
            "category": "Productivity"
        },
        {
            "id": "word",
            "name": "Microsoft Word",
            "description": "Open Microsoft Word and view or edit documents.",
            "icon": "file-text",
            "status": "active",
            "category": "Productivity"
        },
        {
            "id": "excel",
            "name": "Microsoft Excel",
            "description": "Open Microsoft Excel and work with spreadsheets.",
            "icon": "table",
            "status": "active",
            "category": "Productivity"
        },
        {
            "id": "calculator",
            "name": "Calculator",
            "description": "Open the Windows Calculator app.",
            "icon": "calculator",
            "status": "active",
            "category": "Productivity"
        },
        {
            "id": "alarms",
            "name": "Alarms & Timers",
            "description": "Open Windows Clock to set alarms and timers.",
            "icon": "clock",
            "status": "active",
            "category": "Productivity"
        },
        # ── Communication ────────────────────────────────────────────────
        {
            "id": "whatsapp",
            "name": "WhatsApp Desktop",
            "description": "Open WhatsApp Desktop and start chats by contact name or phone number.",
            "icon": "message-circle",
            "status": "active",
            "category": "Communication"
        },
        {
            "id": "email",
            "name": "Email",
            "description": "Compose emails with recipient, subject, and body using your default mail app.",
            "icon": "mail",
            "status": "active",
            "category": "Communication"
        },
        {
            "id": "contacts",
            "name": "Contacts",
            "description": "Open Windows People app and search for contacts by name or number.",
            "icon": "users",
            "status": "active",
            "category": "Communication"
        },
        {
            "id": "telegram",
            "name": "Telegram",
            "description": "Open Telegram Desktop and start chats by username.",
            "icon": "send",
            "status": "active",
            "category": "Communication"
        },
        {
            "id": "zoom",
            "name": "Zoom",
            "description": "Launch Zoom or join video meetings by meeting ID.",
            "icon": "video",
            "status": "active",
            "category": "Communication"
        },
        # ── Browser ──────────────────────────────────────────────────────
        {
            "id": "chrome",
            "name": "Google Chrome",
            "description": "Open Chrome, search the web, and navigate to any URL.",
            "icon": "globe",
            "status": "active",
            "category": "Browser"
        },
        {
            "id": "edge",
            "name": "Microsoft Edge",
            "description": "Open Microsoft Edge, search the web, and navigate to any URL.",
            "icon": "compass",
            "status": "active",
            "category": "Browser"
        },
        # ── Devices ──────────────────────────────────────────────────────
        {
            "id": "printer",
            "name": "Printer Control",
            "description": "Discover printers and send print jobs for any file on your computer.",
            "icon": "printer",
            "status": "active",
            "category": "Devices"
        },
        {
            "id": "camera",
            "name": "Camera",
            "description": "Open the Windows Camera app to take photos or record videos.",
            "icon": "camera",
            "status": "active",
            "category": "Devices"
        },
        # ── Media ────────────────────────────────────────────────────────
        {
            "id": "media_player",
            "name": "Media Player",
            "description": "Open VLC or Windows Media Player to play video or audio.",
            "icon": "play-circle",
            "status": "active",
            "category": "Media"
        },
        {
            "id": "image_viewer",
            "name": "Image Viewer",
            "description": "Open Windows Photos to view images.",
            "icon": "image",
            "status": "active",
            "category": "Media"
        },
        {
            "id": "spotify",
            "name": "Spotify",
            "description": "Open Spotify and search for tracks or artists.",
            "icon": "music",
            "status": "active",
            "category": "Media"
        }
    ]
    
    # Inject enabled state
    for skill in skills:
        skill["enabled"] = state.get(skill["id"], True)
        skill["notification_keys"] = [
            normalize_notification_app(key)
            for key in SKILL_NOTIFICATION_KEYS.get(skill["id"], [skill["name"]])
        ]
        
    return {"skills": skills}


class ToggleRequest(BaseModel):
    enabled: bool

@router.post("/skills/{skill_id}/toggle")
async def toggle_skill(skill_id: str, request: ToggleRequest):
    """Enable or disable a specific skill."""
    from config.skills_config import set_skill_enabled
    set_skill_enabled(skill_id, request.enabled)
    return {"success": True, "skill_id": skill_id, "enabled": request.enabled}

class NotificationPrefsUpdate(BaseModel):
    global_notifications_enabled: Optional[bool] = None
    notification_mode: Optional[str] = None
    app_preferences: Optional[dict] = None

@router.get("/notifications/prefs")
async def get_notif_prefs():
    from config.skills_config import get_notification_prefs
    return get_notification_prefs()

@router.post("/notifications/prefs")
async def update_notif_prefs(request: NotificationPrefsUpdate):
    from config.skills_config import get_notification_prefs, normalize_notification_app, save_notification_prefs
    prefs = get_notification_prefs()
    
    if request.global_notifications_enabled is not None:
        prefs["global_notifications_enabled"] = request.global_notifications_enabled
    if request.notification_mode is not None:
        prefs["notification_mode"] = request.notification_mode
    if request.app_preferences is not None:
        # Merge app preferences
        for app, enabled in request.app_preferences.items():
            prefs.setdefault("app_preferences", {})[normalize_notification_app(app)] = enabled
            
    save_notification_prefs(prefs)
    return prefs


@router.post("/uploads")
async def upload_attachment(file: UploadFile = File(...)):
    """Save a chat attachment and return a local path the agent can use."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file name provided")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename).name
    target = UPLOAD_DIR / safe_name

    counter = 1
    while target.exists():
        target = UPLOAD_DIR / f"{Path(safe_name).stem}_{counter}{Path(safe_name).suffix}"
        counter += 1

    try:
        with target.open("wb") as out:
            shutil.copyfileobj(file.file, out)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not save upload: {exc}") from exc

    return {
        "success": True,
        "filename": safe_name,
        "path": str(target),
        "content_type": file.content_type,
    }


class CustomApp(BaseModel):
    name: str
    path: str
    category: Optional[str] = None

@router.post("/custom-apps")
async def save_custom_apps(apps: list[CustomApp]):
    """Save custom native apps from the frontend."""
    custom_apps_file = Path(__file__).parent.parent / "custom_apps.json"
    try:
        with open(custom_apps_file, "w", encoding="utf-8") as f:
            f.write(json.dumps([app.dict() for app in apps], indent=4))
        return {"success": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not save custom apps: {exc}") from exc
