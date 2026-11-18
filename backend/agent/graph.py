"""
NexusAI — Main Agent Graph (LangGraph)
Defines the stateful agent loop: context → plan → execute → respond
"""
import json
import re
import asyncio
from pathlib import Path
from typing import AsyncGenerator, Dict, Any, List, Optional
from loguru import logger

from agent.state import AgentState
from agent.nodes.system_context import collect_system_context
from llm.client import chat_stream, chat_completion
from llm.prompts import NEXUS_SYSTEM_PROMPT, INTENT_CLASSIFICATION_PROMPT


from config.skills_config import get_skills_state

# ─────────────────────────────────────────────────────────────────────────────
# Tool Definitions (LM Studio function calling)
# ─────────────────────────────────────────────────────────────────────────────

NEXUS_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "open_application",
            "description": "Launch or bring focus to a Windows application",
            "parameters": {
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "Application name (e.g. 'Chrome', 'WhatsApp', 'Notepad')"},
                    "file_path": {"type": "string", "description": "Optional file to open with the app"}
                },
                "required": ["app_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_nexus_panel",
            "description": "Open a specific panel inside the NexusAI app (e.g. 'browser', 'files', 'email', 'music', 'maps', 'weather', 'settings'). Do NOT use this to open external Windows apps.",
            "parameters": {
                "type": "object",
                "properties": {
                    "panel": {"type": "string", "description": "The panel to open (e.g., 'browser', 'files', 'email', 'music', 'maps', 'weather', 'settings')"},
                    "search_query": {"type": "string", "description": "Optional search query to pre-fill or execute in the panel"}
                },
                "required": ["panel"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_folder",
            "description": "Open a specific folder or directory in Windows File Explorer.",
            "parameters": {
                "type": "object",
                "properties": {
                    "folder_path": {"type": "string", "description": "The absolute Windows path to the folder"}
                },
                "required": ["folder_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_file_directly",
            "description": "Open a specific file directly with its default Windows application.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "The absolute Windows path to the file"}
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": "Search for files on the user's computer",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Filename or pattern to search for"},
                    "location": {"type": "string", "description": "Where to search: 'downloads', 'documents', 'desktop', 'all'"},
                    "file_type": {"type": "string", "description": "File extension filter like 'pdf', 'docx', 'xlsx'"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "print_file",
            "description": "Send a file to the printer",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Full path to the file to print"},
                    "printer_name": {"type": "string", "description": "Optional printer name. Uses default if not specified."},
                    "copies": {"type": "integer", "description": "Number of copies", "default": 1}
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "Search the web and return current, cited results. Use this for news, recent events, live facts, current people/roles, prices, schedules, results, and any fact that may have changed since the model was trained.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The web search query"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_url",
            "description": "Open a URL in the default web browser",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The URL to open"},
                    "search_query": {"type": "string", "description": "If set, search Google for this query instead"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_chrome",
            "description": "Open Google Chrome browser, optionally navigating to a URL or searching the web",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The URL to open in Chrome"},
                    "search_query": {"type": "string", "description": "If set, search Google for this query in Chrome"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_edge",
            "description": "Open Microsoft Edge browser, optionally navigating to a URL or searching the web",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The URL to open in Edge"},
                    "search_query": {"type": "string", "description": "If set, search Bing for this query in Edge"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_system_info",
            "description": "Get information about the current system state: running apps, connected devices, disk space",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "close_application",
            "description": "Close or terminate a running Windows application by name",
            "parameters": {
                "type": "object",
                "properties": {
                    "app_name": {"type": "string", "description": "Name of the application to close (e.g. 'WhatsApp', 'Chrome', 'Spotify')"},
                    "force": {"type": "boolean", "description": "If true, forcefully kill the process. Default is graceful close.", "default": False}
                },
                "required": ["app_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_notepad",
            "description": "Open Notepad, optionally with a file or with text content pre-written",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to a text file to open in Notepad"},
                    "content": {"type": "string", "description": "Text content to write to a new file and open in Notepad"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_pdf",
            "description": "Open a PDF file using the default PDF viewer (Edge, Adobe Reader, etc.)",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Full path to the PDF file to open"}
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_calendar",
            "description": "Open Windows Calendar app or create a new calendar event",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Event title (if creating an event)"},
                    "start_time": {"type": "string", "description": "Event start time in ISO format e.g. 2024-07-20T10:00:00"},
                    "end_time": {"type": "string", "description": "Event end time in ISO format"},
                    "location": {"type": "string", "description": "Event location"},
                    "description": {"type": "string", "description": "Event description or notes"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "compose_email",
            "description": "Open the default email client to compose a new email",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {"type": "string", "description": "Recipient email address(es), comma-separated"},
                    "subject": {"type": "string", "description": "Email subject line"},
                    "body": {"type": "string", "description": "Email body text"},
                    "cc": {"type": "string", "description": "CC recipients, comma-separated"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_contacts",
            "description": "Open Windows Contacts/People app, optionally searching for a contact",
            "parameters": {
                "type": "object",
                "properties": {
                    "search_query": {"type": "string", "description": "Contact name or phone number to search for"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_camera",
            "description": "Open the Windows Camera app",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_whatsapp",
            "description": "Open WhatsApp Desktop, optionally opening a chat with a specific contact or phone number",
            "parameters": {
                "type": "object",
                "properties": {
                    "contact": {"type": "string", "description": "Contact name or phone number (international format e.g. +919876543210)"},
                    "message": {"type": "string", "description": "Pre-filled message text to load in the chat input"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_telegram",
            "description": "Open Telegram Desktop, optionally opening a chat with a specific username",
            "parameters": {
                "type": "object",
                "properties": {
                    "username": {"type": "string", "description": "Telegram username to open a chat with"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_word",
            "description": "Open Microsoft Word, optionally opening a specific document",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to a .docx or .doc file to open"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_excel",
            "description": "Open Microsoft Excel, optionally opening a specific spreadsheet",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to a .xlsx or .xls file to open"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_calculator",
            "description": "Open the Windows Calculator app",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_media_player",
            "description": "Open a media player (VLC or Windows Media Player) to play a video or audio file",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to a media file to play"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_image_viewer",
            "description": "Open the Windows Photos app or default image viewer",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path to an image file to open"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_file",
            "description": "Analyze or describe the contents of an uploaded image, screenshot, text file, or document. Use this when the user asks what an attachment shows, says, contains, or means.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Full local path to the uploaded file"},
                    "question": {"type": "string", "description": "The user's question about the file"}
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_zoom",
            "description": "Open Zoom or join a Zoom meeting",
            "parameters": {
                "type": "object",
                "properties": {
                    "meeting_id": {"type": "string", "description": "Zoom meeting ID to join"},
                    "meeting_password": {"type": "string", "description": "Optional password for the Zoom meeting"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_settings",
            "description": "Open Windows Settings, optionally opening a specific settings page",
            "parameters": {
                "type": "object",
                "properties": {
                    "page": {"type": "string", "description": "Specific settings page to open (display, bluetooth, wifi, sound, notifications, apps, privacy, updates, storage, theme, power, accounts, taskbar, clock, language)"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_clock",
            "description": "Open the Windows Clock app (for timers, alarms, and world clock)",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_spotify",
            "description": "Open Spotify and optionally search for music",
            "parameters": {
                "type": "object",
                "properties": {
                    "search_query": {"type": "string", "description": "Track, artist, or album to search for"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_task",
            "description": "Schedule a task or action to be performed in the future (e.g., reminders, sending delayed messages)",
            "parameters": {
                "type": "object",
                "properties": {
                    "delay_minutes": {"type": "number", "description": "Minutes to wait before executing the task"},
                    "task_instruction": {"type": "string", "description": "Instruction for the agent to execute when the timer is up"}
                },
                "required": ["delay_minutes", "task_instruction"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_notification",
            "description": "Send a custom Windows notification/toast only when the user explicitly asks for a notification, alert, or reminder",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Title of the notification"},
                    "message": {"type": "string", "description": "Body text of the notification"}
                },
                "required": ["title", "message"]
            }
        }
    },
]

# Map Skill IDs from Settings to Tool Names
SKILL_TOOL_MAP = {
    "file_manager": ["search_files", "analyze_file", "open_folder", "open_file_directly"],
    "app_launcher": ["open_application"],
    "app_closer": ["close_application"],
    "system_settings": ["open_settings", "get_system_info"],
    "notepad": ["open_notepad"],
    "powerpoint": ["open_powerpoint"],
    "pdf_reader": ["open_pdf"],
    "calendar": ["open_calendar"],
    "word": ["open_word"],
    "excel": ["open_excel"],
    "calculator": ["open_calculator"],
    "alarms": ["open_clock", "schedule_task"],
    "whatsapp": ["open_whatsapp"],
    "email": ["compose_email"],
    "contacts": ["open_contacts"],
    "telegram": ["open_telegram"],
    "zoom": ["open_zoom"],
    "browser_control": ["open_url", "search_web"],
    "chrome": ["open_chrome"],
    "edge": ["open_edge"],
    "printer": ["print_file"],
    "camera": ["open_camera"],
    "media_player": ["open_media_player"],
    "image_viewer": ["open_image_viewer"],
    "spotify": ["open_spotify"]
    # We do not assign "send_notification" or "open_nexus_panel" to a specific skill ID right now, so they are always active.
}

def get_active_tools() -> List[Dict[str, Any]]:
    """Filter tools based on enabled skills config."""
    state = get_skills_state()
    disabled_tools = set()
    
    for skill_id, tools in SKILL_TOOL_MAP.items():
        if not state.get(skill_id, True):
            for t in tools:
                disabled_tools.add(t)
                
    return [t for t in NEXUS_TOOLS if t["function"]["name"] not in disabled_tools]


# ─────────────────────────────────────────────────────────────────────────────
# Tool Executor
# ─────────────────────────────────────────────────────────────────────────────

async def execute_tool(tool_name: str, tool_args: Dict[str, Any], session_id: str = "") -> Dict[str, Any]:
    """
    Dispatch tool calls to the skills layer.
    Returns a result dict with 'success', 'output', and optional 'data'.
    """
    try:
        if tool_name == "open_nexus_panel":
            panel_name = tool_args.get("panel", "dashboard")
            search_query = tool_args.get("search_query", "")
            return {
                "success": True, 
                "output": f"Opened {panel_name} panel.", 
                "action": "switch_view", 
                "view": panel_name, 
                "search_query": search_query
            }

        elif tool_name == "open_application":
            from skills.app_launcher import launch_app
            result = await launch_app(
                app_name=tool_args.get("app_name", ""),
                file_path=tool_args.get("file_path")
            )
            return result

        elif tool_name == "open_folder":
            from skills.file_manager import open_folder
            return await open_folder(tool_args.get("folder_path", ""))

        elif tool_name == "open_file_directly":
            # User selected this file themselves from the in-app explorer — open it with its default app
            import asyncio
            file_path = tool_args.get("file_path", "")
            if not file_path or not os.path.exists(file_path):
                return {"success": False, "output": f"File not found: {file_path}"}
            try:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, os.startfile, file_path)
                return {"success": True, "output": f"Opened {os.path.basename(file_path)}"}
            except Exception as e:
                logger.error(f"open_file_directly failed: {e}")
                return {"success": False, "output": f"Could not open file: {e}"}

        elif tool_name == "search_files":
            from skills.file_manager import search_files
            result = await search_files(
                query=tool_args.get("query", ""),
                location=tool_args.get("location", "all"),
                file_type=tool_args.get("file_type")
            )
            return result

        elif tool_name == "print_file":
            from skills.printer import print_file
            result = await print_file(
                file_path=tool_args.get("file_path", ""),
                printer_name=tool_args.get("printer_name"),
                copies=tool_args.get("copies", 1)
            )
            return result

        elif tool_name == "open_url":
            from skills.browser_control import open_url
            result = await open_url(
                url=tool_args.get("url"),
                search_query=tool_args.get("search_query")
            )
            return result

        elif tool_name == "search_web":
            from skills.web_search_skill import search_web
            return await search_web(query=tool_args.get("query", ""))

        elif tool_name == "open_chrome":
            from skills.browser_control import open_chrome
            result = await open_chrome(
                url=tool_args.get("url"),
                search_query=tool_args.get("search_query")
            )
            return result

        elif tool_name == "open_edge":
            from skills.browser_control import open_edge
            result = await open_edge(
                url=tool_args.get("url"),
                search_query=tool_args.get("search_query")
            )
            return result

        elif tool_name == "get_system_info":
            context = collect_system_context()
            return {"success": True, "output": "System context retrieved", "data": context}

        elif tool_name == "close_application":
            from skills.app_closer import close_app
            result = await close_app(
                app_name=tool_args.get("app_name", ""),
                force=tool_args.get("force", False)
            )
            return result

        elif tool_name == "open_notepad":
            from skills.notepad_skill import open_notepad
            result = await open_notepad(
                file_path=tool_args.get("file_path"),
                content=tool_args.get("content")
            )
            return result

        elif tool_name == "open_pdf":
            from skills.pdf_skill import open_pdf
            result = await open_pdf(file_path=tool_args.get("file_path", ""))
            return result

        elif tool_name == "open_calendar":
            from skills.calendar_skill import open_calendar, create_calendar_event
            if tool_args.get("title"):
                result = await create_calendar_event(
                    title=tool_args.get("title", ""),
                    start_time=tool_args.get("start_time"),
                    end_time=tool_args.get("end_time"),
                    location=tool_args.get("location"),
                    description=tool_args.get("description")
                )
            else:
                result = await open_calendar()
            return result

        elif tool_name == "compose_email":
            from skills.email_skill import compose_email
            result = await compose_email(
                to=tool_args.get("to"),
                subject=tool_args.get("subject"),
                body=tool_args.get("body"),
                cc=tool_args.get("cc")
            )
            return result

        elif tool_name == "open_contacts":
            from skills.contacts_skill import open_contacts
            result = await open_contacts(search_query=tool_args.get("search_query"))
            return result

        elif tool_name == "open_camera":
            from skills.camera_skill import open_camera
            result = await open_camera()
            return result

        elif tool_name == "open_whatsapp":
            from skills.whatsapp_skill import open_whatsapp
            result = await open_whatsapp(
                contact=tool_args.get("contact"),
                message=tool_args.get("message")
            )
            return result

        elif tool_name == "open_powerpoint":
            from skills.powerpoint_skill import open_powerpoint
            result = await open_powerpoint(
                file_path=tool_args.get("file_path"),
                present=tool_args.get("present", False)
            )
            return result

        elif tool_name == "open_telegram":
            from skills.telegram_skill import open_telegram
            result = await open_telegram(username=tool_args.get("username"))
            return result

        elif tool_name == "open_word":
            from skills.word_skill import open_word
            result = await open_word(file_path=tool_args.get("file_path"))
            return result

        elif tool_name == "open_excel":
            from skills.excel_skill import open_excel
            result = await open_excel(file_path=tool_args.get("file_path"))
            return result

        elif tool_name == "open_calculator":
            from skills.calculator_skill import open_calculator
            result = await open_calculator()
            return result

        elif tool_name == "open_media_player":
            from skills.media_player_skill import open_media_player
            result = await open_media_player(file_path=tool_args.get("file_path"))
            return result

        elif tool_name == "open_image_viewer":
            from skills.image_viewer_skill import open_image
            result = await open_image(file_path=tool_args.get("file_path"))
            return result

        elif tool_name == "analyze_file":
            from skills.file_analysis_skill import analyze_file
            result = await analyze_file(
                file_path=tool_args.get("file_path", ""),
                question=tool_args.get("question", "")
            )
            return result

        elif tool_name == "open_zoom":
            from skills.zoom_skill import open_zoom
            result = await open_zoom(
                meeting_id=tool_args.get("meeting_id"),
                meeting_password=tool_args.get("meeting_password")
            )
            return result

        elif tool_name == "open_settings":
            from skills.system_settings_skill import open_settings
            result = await open_settings(page=tool_args.get("page"))
            return result

        elif tool_name == "open_clock":
            from skills.alarms_skill import open_clock
            result = await open_clock()
            return result

        elif tool_name == "open_spotify":
            from skills.spotify_skill import open_spotify
            result = await open_spotify(search_query=tool_args.get("search_query"))
            return result
            
        elif tool_name == "schedule_task":
            from agent.scheduler import schedule_agent_task
            delay_minutes = tool_args.get("delay_minutes", 0)
            instruction = tool_args.get("task_instruction", "")
            if delay_minutes > 0 and instruction:
                schedule_agent_task(session_id, delay_minutes, instruction)
                return {"success": True, "output": f"Task scheduled in {delay_minutes} minutes."}
            return {"success": False, "output": "Invalid scheduling parameters."}

        elif tool_name == "send_notification":
            from skills.notification_skill import send_notification
            result = await send_notification(
                title=tool_args.get("title", "NexusAI"),
                message=tool_args.get("message", "")
            )
            return result

        else:
            return {"success": False, "output": f"Unknown tool: {tool_name}"}

    except Exception as e:
        logger.error(f"Tool execution error ({tool_name}): {e}")
        return {"success": False, "output": "Something went wrong. Please try again."}


def _extract_attached_file_paths(user_input: str) -> List[str]:
    paths = []
    for line in user_input.splitlines():
        stripped = line.strip()
        if not stripped.startswith("- ") or ":" not in stripped:
            continue
        _, possible_path = stripped.split(":", 1)
        possible_path = possible_path.strip()
        if possible_path and re.match(r"^[A-Za-z]:\\", possible_path):
            paths.append(possible_path)
    return paths


def _should_directly_analyze_attachment(user_input: str, file_path: str) -> bool:
    ext = Path(file_path).suffix.lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".txt", ".md", ".csv", ".tsv", ".json", ".log", ".docx"}:
        return False

    lowered = user_input.lower()
    analysis_words = [
        "what is this", "what's this", "what does", "what is in", "what's in",
        "describe", "saying", "say", "read", "contents", "content",
        "summarize", "explain", "analyze", "look at"
    ]
    return any(word in lowered for word in analysis_words)


def _needs_current_web_search(user_input: str) -> bool:
    """Conservative routing for questions where a stale local model is unsafe."""
    lowered = user_input.lower()
    current_markers = (
        "latest", "recent", "today", "yesterday", "tomorrow", "current", "currently",
        "news", "just happened", "who won", "winner", "score", "result", "results",
        "price", "stock", "weather", "schedule", "standings", "election", "ceo",
    )
    year_markers = re.findall(r"\b20\d{2}\b", lowered)
    return any(marker in lowered for marker in current_markers) or bool(year_markers)


def _direct_desktop_request(user_input: str) -> Optional[tuple[str, Dict[str, Any]]]:
    """Route ONLY pure, single-action open commands without going through the LLM.

    This is ONLY for simple commands like "open notepad", "open chrome", "open edge".
    Any compound command (with 'and', 'then', 'write', 'go to', 'search', 'type', etc.)
    must be passed to the LLM so it can chain multiple tool calls correctly.
    """
    folder_match = re.search(r"open this folder in file explorer:\s*(.+)$", user_input.strip(), re.IGNORECASE)
    if folder_match:
        return "open_folder", {"folder_path": folder_match.group(1).strip()}

    file_match = re.search(r"open this file:\s*(.+)$", user_input.strip(), re.IGNORECASE)
    if file_match:
        path = file_match.group(1).strip()
        if os.path.isdir(path):
            return "open_folder", {"folder_path": path}
        return "open_file_directly", {"file_path": path}

    lowered = user_input.strip().lower()

    # Must contain an open-style verb
    if not re.search(r"\b(open|launch|start|run|use)\b", lowered):
        return None

    # Bail out for ANY compound command — let LLM handle multi-step requests
    compound_signals = [
        " and ", " then ", " also ", " after ", " next ",
        "write", "type", "go to", "navigate", "search", "find", "look",
        "google", "play", "send", "compose", "create", "make", "set",
        "with content", "and say", "and message", "and open"
    ]
    if any(signal in lowered for signal in compound_signals):
        return None

    app_aliases = {
        "file explorer": "file explorer", "explorer": "file explorer",
        "whatsapp": "whatsapp", "spotify": "spotify", "chrome": "chrome",
        "google chrome": "google chrome",
        "edge": "edge", "microsoft edge": "microsoft edge",
        "notepad": "notepad", "calculator": "calculator", "outlook": "outlook",
        "email client": "outlook",
        "discord": "discord", "zoom": "zoom", "telegram": "telegram",
        "vlc": "vlc", "paint": "paint",
    }
    for phrase, app_name in app_aliases.items():
        if phrase in lowered:
            return "open_application", {"app_name": app_name}
    return None



def _direct_file_search_request(user_input: str) -> Optional[tuple[str, Dict[str, Any]]]:
    """Recognize ordinary local-file search phrasing before asking the model."""
    lowered = user_input.strip().lower()
    
    # Bail out for compound commands or app-launching intents
    compound_signals = [
        "open", "launch", "start", "run", "use",
        "and search", "then search", "also search"
    ]
    if any(signal in lowered for signal in compound_signals):
        return None

    # Ignore explicit browser searches
    if any(b in lowered for b in [" in chrome", " in edge", " in browser", " on web", " on the web", " online"]):
        return None
        
    match = re.search(r"\b(?:find|search(?:\s+for)?)\s+(?:my\s+)?(.+?)(?:\s+(?:in|on)\s+(?:my\s+)?(?:computer|pc|files|file explorer))?[?.!]*$", user_input.strip(), re.IGNORECASE)
    if not match:
        return None
    query = match.group(1).strip(" \t'\"")
    if not query or len(query) > 180 or query.lower() in {"files", "file", "my files"}:
        return None
    return "search_files", {"query": query, "location": "all"}


# ─────────────────────────────────────────────────────────────────────────────
# Main Agent Run — Streaming
# ─────────────────────────────────────────────────────────────────────────────

async def run_agent(
    user_input: str,
    conversation_history: List[Dict[str, Any]],
    session_id: str = "default",
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Main agent entry point. Yields streaming events to the WebSocket handler.
    
    Event types:
    - thinking: Agent is reasoning about what to do
    - tool_start: Agent is about to use a tool  
    - tool_end: Tool execution completed
    - stream: Partial LLM response text
    - done: Final response complete
    - error: Something went wrong
    """
    
    # ── Step 1: Collect system context ─────────────────────────────────────
    yield {"type": "thinking", "message": "Analyzing your request..."}
    
    try:
        system_context = collect_system_context()
    except Exception:
        system_context = {}
    
    # ── Step 2: Build conversation messages ────────────────────────────────
    # Include recent context summary in system prompt
    context_note = ""
    if system_context:
        apps = system_context.get("running_apps", [])
        printers = [p.get("name", "") for p in system_context.get("printers", [])]
        if apps:
            context_note += f"\n\nCurrently running apps: {', '.join(apps[:8])}"
        if printers:
            context_note += f"\nConnected printers: {', '.join(printers)}"

    system_prompt = NEXUS_SYSTEM_PROMPT + context_note

    messages = list(conversation_history) + [
        {"role": "user", "content": user_input}
    ]

    attached_paths = _extract_attached_file_paths(user_input)
    # Attachments take precedence over freshness heuristics. In particular, uploaded
    # screenshot filenames often contain a year, which must not turn image analysis
    # into a web search.
    if attached_paths and _should_directly_analyze_attachment(user_input, attached_paths[0]):
        yield {
            "type": "tool_start",
            "tool": "analyze_file",
            "args": {"file_path": attached_paths[0], "question": user_input},
            "message": "Analyzing attached file..."
        }
        result = await execute_tool(
            "analyze_file",
            {"file_path": attached_paths[0], "question": user_input},
            session_id
        )
        yield {
            "type": "tool_end",
            "tool": "analyze_file",
            "success": result.get("success", False),
            "message": "File analyzed" if result.get("success", False) else result.get("output", "Could not analyze file"),
        }
        yield {"type": "stream", "text": result.get("output", "I could not analyze that file.")}
        yield {"type": "done", "message": "Task complete"}
        return

    # Handle simple app launches deterministically.  We always invoke the launcher:
    # Windows will focus or start the app based on its actual current state.
    direct_request = _direct_desktop_request(user_input)
    if direct_request:
        tool_name, tool_args = direct_request
        yield {"type": "tool_start", "tool": tool_name, "args": tool_args, "message": _describe_tool_start(tool_name, tool_args)}
        result = await execute_tool(tool_name, tool_args, session_id)
        yield {"type": "tool_end", "tool": tool_name, "success": result.get("success", False), "message": result.get("output", "Done")}
        yield {"type": "stream", "text": result.get("output", "I could not complete that action.")}
        yield {"type": "done", "message": "Task complete"}
        return

    direct_file_search = _direct_file_search_request(user_input)
    if direct_file_search:
        tool_name, tool_args = direct_file_search
        yield {"type": "tool_start", "tool": tool_name, "args": tool_args, "message": _describe_tool_start(tool_name, tool_args)}
        result = await execute_tool(tool_name, tool_args, session_id)
        yield {"type": "tool_end", "tool": tool_name, "success": result.get("success", False), "message": result.get("output", "Done")}
        yield {"type": "stream", "text": result.get("output", "I could not search your files.")}
        yield {"type": "done", "message": "Task complete"}
        return

    # Ground time-sensitive questions before the model can answer from stale training data.
    # Do not search just because an attached file path or filename contains a year.
    query_without_attachments = "\n".join(
        line for line in user_input.splitlines() if not line.strip().startswith("-")
    ).strip()
    if not attached_paths and _needs_current_web_search(query_without_attachments):
        yield {"type": "tool_start", "tool": "search_web", "args": {"query": query_without_attachments}, "message": "Searching the web for current information..."}
        web_result = await execute_tool("search_web", {"query": query_without_attachments}, session_id)
        yield {
            "type": "tool_end", "tool": "search_web", "success": web_result.get("success", False),
            "message": "Current sources found" if web_result.get("success", False) else web_result.get("output", "Web search unavailable"),
        }
        if web_result.get("success"):
            system_prompt += (
                "\n\n## Current web search results\nUse the following retrieved results to answer the user. "
                "Do not invent facts beyond them. Mention the relevant source URLs in your answer.\n"
                + web_result.get("output", "")
            )

    # ── Step 3: Initial LLM call (may include tool calls) ──────────────────
    yield {"type": "thinking", "message": "Planning approach..."}
    
    full_messages_with_system = [{"role": "system", "content": system_prompt}] + messages
    
    # Non-streaming call first to check for tool calls
    try:
        from llm.client import _get_client
        from config import settings
        client = _get_client()
        response = await client.chat.completions.create(
            model=settings.get_llm_model(),
            messages=full_messages_with_system,
            tools=get_active_tools(),
            tool_choice="auto",
            temperature=0.7,
            max_tokens=2048,
        )
    except Exception as e:
        logger.error(f"Initial LLM call failed: {e}")
        yield {
            "type": "error",
            "message": f"Could not reach AI model. Check your LM Studio settings. Error: {str(e)}"
        }
        return

    choice = response.choices[0]
    assistant_message = choice.message
    raw_content = assistant_message.content or ""

    # ── Step 4: Handle tool calls if present ───────────────────────────────
    # Support both OpenAI JSON tool_calls AND Qwen/Llama XML-style tool calls
    tool_results_for_context = []

    # Detect XML-style tool calls: <tool_call>\n<function=name>\n{...}\n</function>\n</tool_call>
    xml_tool_calls = _parse_xml_tool_calls(raw_content)

    if hasattr(assistant_message, 'tool_calls') and assistant_message.tool_calls:
        # Agent wants to use tools
        for tool_call in assistant_message.tool_calls:
            tool_name = tool_call.function.name
            try:
                tool_args = json.loads(tool_call.function.arguments)
            except json.JSONDecodeError:
                tool_args = {}
            
            # Emit tool start event
            yield {
                "type": "tool_start",
                "tool": tool_name,
                "args": tool_args,
                "message": _describe_tool_start(tool_name, tool_args)
            }
            
            # Execute the tool
            result = await execute_tool(tool_name, tool_args, session_id)
            
            # Emit tool end event
            yield {
                "type": "tool_end",
                "tool": tool_name,
                "success": result.get("success", False),
                "message": result.get("output", "Done"),
            }
            
            if result.get("action") == "switch_view":
                yield {
                    "type": "switch_view",
                    "view": result.get("view", "dashboard"),
                    "search_query": result.get("search_query", "")
                }
            
            tool_results_for_context.append({
                "tool_call_id": tool_call.id,
                "role": "tool",
                "content": json.dumps(result),
            })
        
        # ── Step 5: Second LLM call with tool results ──────────────────────
        yield {"type": "thinking", "message": "Processing results..."}
        
        messages_with_tools = (
            full_messages_with_system
            + [{"role": "assistant", "content": None, 
                "tool_calls": [tc.model_dump() for tc in assistant_message.tool_calls]}]
            + tool_results_for_context
        )
        
        yield {"type": "thinking", "message": "Composing response..."}
        
        try:
            from llm.client import _get_client
            from config import settings
            client = _get_client()
            final_response = await client.chat.completions.create(
                model=settings.get_llm_model(),
                messages=messages_with_tools,
                stream=True,
                temperature=0.7,
                max_tokens=2048,
            )
            async for chunk in final_response:
                if chunk.choices and chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    # Filter out any XML tool-call tags the model leaks in its follow-up
                    if "<tool_call>" in token or "</tool_call>" in token or "<function=" in token or "</function>" in token or "<function." in token:
                        continue
                    yield {"type": "stream", "text": token}
        except Exception as e:
            logger.error(f"Streaming error (JSON tool branch): {e}")
            yield {"type": "error", "message": "Something went wrong generating the response."}
            return

    elif xml_tool_calls:
        # ── XML-style tool calls (Qwen/Llama local models) ─────────────────
        for tool_name, tool_args in xml_tool_calls:
            yield {
                "type": "tool_start",
                "tool": tool_name,
                "args": tool_args,
                "message": _describe_tool_start(tool_name, tool_args)
            }
            result = await execute_tool(tool_name, tool_args, session_id)
            yield {
                "type": "tool_end",
                "tool": tool_name,
                "success": result.get("success", False),
                "message": result.get("output", "Done"),
            }
            
            if result.get("action") == "switch_view":
                yield {
                    "type": "switch_view",
                    "view": result.get("view", "dashboard"),
                    "search_query": result.get("search_query", "")
                }

            tool_results_for_context.append({
                "role": "user",
                "content": f"<tool_result>\n<function={tool_name}>\n{json.dumps(result)}\n</function>\n</tool_result>",
            })

        # Follow-up call with tool results to get natural language response
        yield {"type": "thinking", "message": "Composing response..."}
        
        # Replace raw XML with plain text so the model doesn't loop repeating XML
        tools_summary = ", ".join([name for name, _ in xml_tool_calls])
        messages_with_tools = full_messages_with_system + [
            {"role": "assistant", "content": f"I decided to use the following tools: {tools_summary}."},
        ] + tool_results_for_context

        try:
            from llm.client import _get_client
            from config import settings
            client = _get_client()
            final_response = await client.chat.completions.create(
                model=settings.get_llm_model(),
                messages=messages_with_tools,
                stream=True,
                temperature=0.7,
                max_tokens=2048,
            )
            async for chunk in final_response:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    # Filter out any XML tool-call tags the model leaks in its follow-up
                    if "<tool_call>" in delta or "</tool_call>" in delta or "<function=" in delta or "</function>" in delta or "<function." in delta:
                        continue
                    yield {"type": "stream", "text": delta}
        except Exception as e:
            logger.error(f"Streaming error (XML tool branch): {e}")
            yield {"type": "error", "message": "Something went wrong generating the response."}
            return

    else:
        # ── No tool calls — stream the direct response ──────────────────────
        yield {"type": "thinking", "message": "Composing response..."}

        try:
            from llm.client import _get_client
            from config import settings
            client = _get_client()
            streaming_response = await client.chat.completions.create(
                model=settings.get_llm_model(),
                messages=full_messages_with_system,
                stream=True,
                temperature=0.7,
                max_tokens=2048,
            )
            async for chunk in streaming_response:
                if chunk.choices and chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    # Skip raw XML tool call tags if model leaks them in direct response
                    if "<tool_call>" in token or "</tool_call>" in token or "<function=" in token or "</function>" in token or "<function." in token:
                        continue
                    yield {"type": "stream", "text": token}
        except Exception as e:
            logger.error(f"Streaming error (direct response): {e}")
            yield {"type": "error", "message": "Something went wrong generating the response."}
            return

    yield {"type": "done", "message": "Task complete"}


def _describe_tool_start(tool_name: str, args: Dict[str, Any]) -> str:
    """Human-readable description of what tool is being invoked."""
    descriptions = {
        "open_application": f"Opening {args.get('app_name', 'application')}...",
        "search_files": f"Searching for '{args.get('query', 'files')}'...",
        "print_file": f"Sending to printer...",
        "open_url": f"Opening browser..." if not args.get("search_query") else f"Searching for '{args.get('search_query')}'...",
        "search_web": f"Searching the web for '{args.get('query', '')}'...",
        "get_system_info": "Checking system status...",
        "close_application": f"Closing {args.get('app_name', 'application')}...",
    }
    return descriptions.get(tool_name, f"Executing {tool_name}...")


def _parse_xml_tool_calls(content: str) -> List[tuple]:
    """
    Parse Qwen/Llama style XML tool calls from model output.
    Handles formats like:
      <tool_call>
      <function=get_system_info>
      </function>
      </tool_call>
    
    Also handles JSON args inside the function tag.
    Returns list of (tool_name, args_dict) tuples.
    """
    results = []
    if "<tool_call>" not in content:
        return results

    # Match each <tool_call>...</tool_call> block
    blocks = re.findall(r'<tool_call>(.*?)</tool_call>', content, re.DOTALL)
    for block in blocks:
        # Try format: <function=tool_name>\n{json}\n</function>
        match = re.search(r'<function=(\w+)>(.*?)</function>', block, re.DOTALL)
        if match:
            tool_name = match.group(1).strip()
            args_str = match.group(2).strip()
            try:
                args = json.loads(args_str) if args_str else {}
            except json.JSONDecodeError:
                args = {}
            results.append((tool_name, args))
            continue

        # Try format: {"name": "tool_name", "arguments": {...}}
        try:
            data = json.loads(block.strip())
            tool_name = data.get("name") or data.get("function", "")
            args = data.get("arguments") or data.get("parameters") or {}
            if tool_name:
                results.append((tool_name, args))
        except (json.JSONDecodeError, AttributeError):
            pass

    return results
