"""
NexusAI — LLM Client
Uses the official OpenAI SDK, which is 100% compatible with LM Studio's local server.
"""
from openai import AsyncOpenAI
from typing import AsyncGenerator, List, Dict, Any, Optional
from loguru import logger

from config.settings import settings


def _get_client() -> AsyncOpenAI:
    """Instantiate a new OpenAI client using current settings."""
    return AsyncOpenAI(
        base_url=settings.get_llm_base_url(),
        api_key="lm-studio",  # LM Studio ignores this, but SDK requires it
    )


def _build_messages_with_system(
    messages: List[Dict[str, Any]],
    system_prompt: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Prepend system prompt if provided and not already present."""
    if system_prompt and (not messages or messages[0].get("role") != "system"):
        return [{"role": "system", "content": system_prompt}] + messages
    return messages


async def chat_completion(
    messages: List[Dict[str, Any]],
    system_prompt: Optional[str] = None,
    tools: Optional[List[Dict]] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> Dict[str, Any]:
    """
    Non-streaming completion. Returns the full response dict.
    Use for quick, non-interactive calls.
    """
    client = _get_client()
    full_messages = _build_messages_with_system(messages, system_prompt)
    
    kwargs = {
        "model": settings.get_llm_model(),
        "messages": full_messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    try:
        response = await client.chat.completions.create(**kwargs)
        return response.model_dump()
    except Exception as e:
        logger.error(f"LLM completion error: {e}")
        raise


async def chat_stream(
    messages: List[Dict[str, Any]],
    system_prompt: Optional[str] = None,
    tools: Optional[List[Dict]] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> AsyncGenerator[str, None]:
    """
    Streaming completion. Yields text chunks as they arrive.
    Use for the main chat interface to show live typing.
    """
    client = _get_client()
    full_messages = _build_messages_with_system(messages, system_prompt)
    
    kwargs = {
        "model": settings.get_llm_model(),
        "messages": full_messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }
    
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    try:
        response = await client.chat.completions.create(**kwargs)
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as e:
        logger.error(f"LLM stream error: {e}")
        yield f"\n\n[NexusAI Error: Failed to reach LLM — {str(e)}]"


async def test_connection() -> Dict[str, Any]:
    """
    Test the LLM connection. Returns status and model info.
    Called on backend startup and from the settings panel.
    """
    client = _get_client()
    try:
        response = await client.chat.completions.create(
            model=settings.get_llm_model(),
            messages=[{"role": "user", "content": "Reply with exactly: NEXUS_OK"}],
            max_tokens=20,
        )
        content = response.choices[0].message.content or ""
        return {
            "status": "connected",
            "provider": settings.llm_provider,
            "model": settings.get_llm_model(),
            "base_url": settings.get_llm_base_url(),
            "response_preview": content[:100],
        }
    except Exception as e:
        return {
            "status": "error",
            "provider": settings.llm_provider,
            "model": settings.get_llm_model(),
            "base_url": settings.get_llm_base_url(),
            "error": str(e),
        }
