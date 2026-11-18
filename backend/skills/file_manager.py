"""
NexusAI — File Manager Skill
Search, open, and manage files on Windows.

SECURITY:
- All file operations are confined to user's home directory via _safe_resolve_path().
- create_file() validates location against an allowlist and filename against
  path-traversal characters.
- open_file() and open_folder() canonicalize paths with os.path.realpath()
  before proceeding.
- Error messages returned to the AI/user are always generic (full detail is logged).
"""
import os
import glob
import re
import subprocess
from typing import Dict, Any, List, Optional
from pathlib import Path
from loguru import logger
from config.permissions import is_allowed


# ── Allowed search/create locations ──────────────────────────────────────────
SEARCH_LOCATIONS = {
    "downloads": os.path.join(os.environ.get("USERPROFILE", "C:\\Users"), "Downloads"),
    "documents": os.path.join(os.environ.get("USERPROFILE", "C:\\Users"), "Documents"),
    "desktop": os.path.join(os.environ.get("USERPROFILE", "C:\\Users"), "Desktop"),
    "pictures": os.path.join(os.environ.get("USERPROFILE", "C:\\Users"), "Pictures"),
    "videos": os.path.join(os.environ.get("USERPROFILE", "C:\\Users"), "Videos"),
    "music": os.path.join(os.environ.get("USERPROFILE", "C:\\Users"), "Music"),
}

# Only Desktop and Documents are allowed as create_file destinations
FILE_CREATE_LOCATIONS = {
    "desktop": SEARCH_LOCATIONS["desktop"],
    "documents": SEARCH_LOCATIONS["documents"],
}

_HOME_DIR = os.path.realpath(os.path.expanduser("~"))
_UNSAFE_FILENAME_RE = re.compile(r'[\\/:*?"<>|]|\.\.|\.\/')


def _safe_resolve_path(path: str) -> Optional[str]:
    """
    Resolve a path and confirm it is inside the user's home directory.
    Returns the resolved absolute path, or None if it escapes the home dir.
    """
    resolved = os.path.realpath(os.path.abspath(path))
    if not resolved.startswith(_HOME_DIR):
        logger.warning(f"Path traversal blocked: '{path}' resolves to '{resolved}'")
        return None
    return resolved


def _validate_filename(filename: str) -> bool:
    """Reject filenames with path traversal characters or shell-special sequences."""
    if not filename or not filename.strip():
        return False
    if _UNSAFE_FILENAME_RE.search(filename):
        logger.warning(f"Unsafe filename rejected: '{filename}'")
        return False
    # Reject filenames that are just dots
    if filename.strip(".") == "":
        return False
    return True


async def search_files(
    query: str,
    location: str = "all",
    file_type: Optional[str] = None,
    max_results: int = 10
) -> Dict[str, Any]:
    """
    Search for files matching query across common locations.

    Args:
        query: Filename or partial name to search for
        location: Where to search ('downloads', 'documents', 'desktop', 'all')
        file_type: Optional extension filter ('pdf', 'docx', etc.)
        max_results: Maximum number of results to return

    Returns:
        Dict with 'success', 'output', 'data' (list of file paths)
    """
    search_dirs = []

    if location == "all":
        search_dirs = list(SEARCH_LOCATIONS.values())
    elif location in SEARCH_LOCATIONS:
        search_dirs = [SEARCH_LOCATIONS[location]]
    else:
        # Treat as a literal path only if it's inside home dir
        candidate = _safe_resolve_path(location)
        if candidate and os.path.exists(candidate):
            search_dirs = [candidate]
        else:
            search_dirs = list(SEARCH_LOCATIONS.values())

    found_files: List[Dict[str, Any]] = []
    query_lower = query.lower().replace("*", "").replace("?", "")

    for search_dir in search_dirs:
        if not os.path.exists(search_dir):
            continue

        try:
            for root, dirs, files in os.walk(search_dir):
                # Skip hidden and system directories
                dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['$RECYCLE.BIN', 'System Volume Information']]

                for filename in files:
                    if query_lower in filename.lower():
                        if file_type and not filename.lower().endswith(f".{file_type.lower()}"):
                            continue

                        filepath = os.path.join(root, filename)
                        try:
                            stat = os.stat(filepath)
                            found_files.append({
                                "name": filename,
                                "path": filepath,
                                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                                "modified": stat.st_mtime,
                            })
                        except OSError:
                            continue

                if len(found_files) >= max_results:
                    break
        except PermissionError:
            continue

    # Sort by most recently modified
    found_files.sort(key=lambda x: x["modified"], reverse=True)
    found_files = found_files[:max_results]

    if not found_files:
        return {
            "success": False,
            "output": f"No files found matching '{query}'" + (f" of type .{file_type}" if file_type else ""),
            "data": []
        }

    file_list = "\n".join([f"  • {f['name']} ({f['size_mb']} MB) — {f['path']}" for f in found_files])
    return {
        "success": True,
        "output": f"Found {len(found_files)} file(s) matching '{query}':\n{file_list}",
        "data": found_files,
        "best_match": found_files[0]["path"]
    }


async def create_file(
    filename: str,
    location: str = "desktop",
    content: str = ""
) -> Dict[str, Any]:
    """
    Create a new text file at an approved location.

    Args:
        filename: Name of the file (must not contain path traversal chars)
        location: 'desktop' or 'documents' only
        content: Optional initial content

    Returns:
        Dict with 'success' and 'output'
    """
    # 1. Permission check
    if not is_allowed("file_create"):
        return {"success": False, "output": "File creation is turned off in settings."}

    # 2. Location allowlist check
    location_key = location.lower().strip()
    base_dir = FILE_CREATE_LOCATIONS.get(location_key)
    if not base_dir:
        return {
            "success": False,
            "output": f"Files can only be created on Desktop or in Documents, not '{location}'."
        }

    # 3. Filename validation — no path traversal, no special chars
    if not _validate_filename(filename):
        return {
            "success": False,
            "output": "Invalid filename. Please use a simple name without slashes or special characters."
        }

    # 4. Build and canonicalize path, confirm it stays inside home dir
    raw_path = os.path.join(base_dir, filename)
    safe_path = _safe_resolve_path(raw_path)
    if not safe_path:
        return {
            "success": False,
            "output": "Something went wrong resolving the file path. Please try again."
        }

    try:
        os.makedirs(os.path.dirname(safe_path), exist_ok=True)
        with open(safe_path, "w", encoding="utf-8") as f:
            f.write(content)
        logger.info(f"File created: success (location={location_key})")
        return {
            "success": True,
            "output": f"Created '{filename}' on your {location_key.capitalize()}.",
            "data": {"path": safe_path}
        }
    except Exception as e:
        logger.error(f"File creation failed: {e}")
        return {"success": False, "output": "Something went wrong creating the file. Please try again."}


async def open_file(file_path: str) -> Dict[str, Any]:
    """Open a file with its default application."""
    # 1. Permission check
    if not is_allowed("file_open"):
        return {"success": False, "output": "File opening is turned off in settings."}

    # 2. Canonicalize and home-dir check
    safe_path = _safe_resolve_path(file_path)
    if not safe_path:
        return {"success": False, "output": "That file path is not accessible."}

    if not os.path.exists(safe_path):
        return {"success": False, "output": "File not found."}

    try:
        os.startfile(safe_path)
        return {
            "success": True,
            "output": f"Opened {os.path.basename(safe_path)}",
            "data": {"path": safe_path}
        }
    except Exception as e:
        logger.error(f"open_file failed: {e}")
        return {"success": False, "output": "Something went wrong opening the file. Please try again."}


async def open_folder(folder_path: str) -> Dict[str, Any]:
    """Open a folder in Windows Explorer."""
    # Canonicalize and home-dir check
    safe_path = _safe_resolve_path(folder_path)
    if not safe_path:
        return {"success": False, "output": "That folder path is not accessible."}

    if not os.path.exists(safe_path):
        return {"success": False, "output": "Folder not found."}

    try:
        subprocess.Popen(["explorer", safe_path], shell=False)
        return {"success": True, "output": f"Opened folder: {os.path.basename(safe_path)}"}
    except Exception as e:
        logger.error(f"open_folder failed: {e}")
        return {"success": False, "output": "Something went wrong opening the folder. Please try again."}
