import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
sys.path.insert(0, os.path.dirname(__file__))
from config.settings import settings
from api.websocket import router as ws_router
from api.settings_api import router as settings_router
from api.auth import initialize_auth_storage, router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info(f"🚀 NexusAI Backend starting on {settings.host}:{settings.port}")
    logger.info(f"🤖 LLM Provider: {settings.llm_provider}")
    logger.info(f"🔗 LLM Base URL: {settings.get_llm_base_url()}")
    logger.info(f"🧠 Model: {settings.get_llm_model()}")
    
    initialize_auth_storage()

    # Test LLM connection on startup
    try:
        from llm.client import test_connection
        result = await test_connection()
        if result["status"] == "connected":
            logger.success(f"✅ LLM connection OK — Model: {result['model']}")
        else:
            logger.warning(f"⚠️  LLM connection failed: {result.get('error', 'unknown')}")
            logger.warning("    → Start LM Studio and load a model, then restart backend")
    except Exception as e:
        logger.warning(f"⚠️  Could not test LLM connection: {e}")
        
    # Start background notification listener
    try:
        import asyncio
        from skills.notification_skill import start_notification_polling
        asyncio.create_task(start_notification_polling())
    except Exception as e:
        logger.error(f"Failed to start notification polling: {e}")
    
    yield
    
    logger.info("NexusAI Backend shutting down")


# ─── FastAPI App ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="NexusAI Backend",
    description="Agentic AI Operating Layer — WebSocket + REST API",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Logging Hygiene Rule ─────────────────────────────────────────────────────
# NEVER log: raw user messages, file contents, search queries, or any
# user-provided text. Only log: action names, status, and session metadata.
# ─────────────────────────────────────────────────────────────────────────────

# CORS — allow React dev server and packaged Tauri app only (no wildcard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "tauri://localhost",        # Tauri production
        "http://tauri.localhost",
        # NOTE: Do not re-add "*" wildcard here — it allows any website to
        # make credentialed requests to this backend.
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# ─── Routes ──────────────────────────────────────────────────────────────────
app.include_router(ws_router)
app.include_router(settings_router)
app.include_router(auth_router)


@app.get("/")
async def root():
    return {
        "app": "NexusAI",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


# ─── Dev Server Entry ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info" if not settings.debug else "debug",
    )
