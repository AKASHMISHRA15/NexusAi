"""NexusAI — LLM package"""
from .client import chat_completion, chat_stream, test_connection
from .prompts import NEXUS_SYSTEM_PROMPT, INTENT_CLASSIFICATION_PROMPT

__all__ = [
    "chat_completion",
    "chat_stream", 
    "test_connection",
    "NEXUS_SYSTEM_PROMPT",
    "INTENT_CLASSIFICATION_PROMPT",
]
