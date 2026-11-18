"""WebSocket endpoint with independently cancellable NexusAI task runs."""
import asyncio
import json
import re
import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

from agent.graph import run_agent

# ── Logging Hygiene Rule ─────────────────────────────────────────────────────
# NEVER log: raw user messages, transcribed speech, file contents, or any
# user-provided text. Only log: action names, session IDs, success/failure.
# This rule applies to all modules. Do not weaken it in future phases.
# ─────────────────────────────────────────────────────────────────────────────

MAX_INPUT_LENGTH = 2000  # Characters. Longer messages are rejected.
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]")


def sanitize_input(text: str) -> str | None:
    """
    Sanitize raw user input before passing to the agent.
    Returns None if the input should be rejected outright.
    """
    if not text or not text.strip():
        return None
    # Enforce max length
    if len(text) > MAX_INPUT_LENGTH:
        logger.warning(f"Input rejected: exceeded max length ({len(text)} chars)")
        return None
    # Strip dangerous control characters (keep newlines \n and tabs \t)
    sanitized = _CONTROL_CHAR_RE.sub("", text).strip()
    if not sanitized:
        return None
    return sanitized

router = APIRouter()
sessions: Dict[str, List[Dict[str, Any]]] = {}
active_connections: Dict[str, WebSocket] = {}
MAX_CONCURRENT_TASKS = 3


@router.websocket("/ws/agent")
async def agent_websocket(websocket: WebSocket):
    """Run up to three agent tasks concurrently for a single chat session."""
    await websocket.accept()
    session_id = str(uuid.uuid4())
    sessions[session_id] = []
    active_connections[session_id] = websocket
    tasks: Dict[str, asyncio.Task] = {}
    send_lock = asyncio.Lock()
    history_lock = asyncio.Lock()

    async def send(event: Dict[str, Any]):
        async with send_lock:
            await websocket.send_json(event)

    async def run_task(task_id: str, user_content: str):
        response_parts: List[str] = []
        completed = False
        try:
            # Each task gets a stable snapshot, avoiding history races while other
            # tasks are running. Completed results are appended atomically below.
            async with history_lock:
                history_snapshot = list(sessions.get(session_id, []))

            async for event in run_agent(user_content, history_snapshot, session_id):
                event["task_id"] = task_id
                await send(event)
                if event["type"] == "stream":
                    response_parts.append(event.get("text", ""))
                if event["type"] == "done":
                    completed = True
                    break
                if event["type"] == "error":
                    break

            if completed:
                async with history_lock:
                    history = sessions.setdefault(session_id, [])
                    history.append({"role": "user", "content": user_content})
                    full_text = "".join(response_parts)
                    if full_text:
                        history.append({"role": "assistant", "content": full_text})
                    sessions[session_id] = history[-20:]
        except asyncio.CancelledError:
            await send({"type": "error", "task_id": task_id, "message": "Task cancelled."})
            raise
        except Exception as exc:
            # Log full detail internally — NEVER expose raw exception to client
            logger.exception(f"Task {task_id} failed")
            await send({"type": "error", "task_id": task_id, "message": "Something went wrong processing your request. Please try again."})
        finally:
            tasks.pop(task_id, None)

    await send({"type": "connected", "session_id": session_id, "message": "NexusAI agent ready"})
    logger.info(f"WebSocket connected: {session_id}")

    try:
        while True:
            try:
                data = json.loads(await websocket.receive_text())
            except json.JSONDecodeError:
                await send({"type": "error", "message": "Invalid JSON received"})
                continue

            msg_type = data.get("type", "message")
            if msg_type == "ping":
                await send({"type": "pong"})
                continue
            if msg_type == "clear_session":
                sessions[session_id] = []
                await send({"type": "session_cleared", "message": "Conversation history cleared"})
                continue
            if msg_type == "cancel_task":
                task_id = data.get("task_id", "")
                task = tasks.get(task_id)
                if task and not task.done():
                    task.cancel()
                continue
            if msg_type != "message":
                continue

            raw_content = data.get("content", "")
            user_content = sanitize_input(raw_content)
            if not user_content:
                await send({"type": "error", "message": "Message is empty or too long (max 2000 characters)."})
                continue
            task_id = data.get("task_id") or str(uuid.uuid4())
            if len(tasks) >= MAX_CONCURRENT_TASKS:
                await send({
                    "type": "error", "task_id": task_id,
                    "message": f"Up to {MAX_CONCURRENT_TASKS} tasks can run at once. Stop or wait for a task before starting another.",
                })
                continue
            tasks[task_id] = asyncio.create_task(run_task(task_id, user_content))
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {session_id}")
    finally:
        for task in tasks.values():
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks.values(), return_exceptions=True)
        active_connections.pop(session_id, None)
