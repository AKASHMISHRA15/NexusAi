"""
NexusAI — Agent State Definition
TypedDict for the LangGraph agent's state machine.
"""
from typing import TypedDict, List, Dict, Any, Optional, Annotated
from langgraph.graph.message import add_messages


class AgentState(TypedDict):
    """The complete state passed between nodes in the NexusAI agent graph."""
    
    # Conversation messages (LangGraph managed)
    messages: Annotated[List[Dict[str, Any]], add_messages]
    
    # User's original input
    user_input: str
    
    # Classified intent
    intent: Optional[str]
    intent_confidence: float
    
    # Extracted entities from user input
    entities: Dict[str, Any]
    
    # Execution plan (list of steps)
    plan: List[str]
    
    # Currently executing step index
    current_step: int
    
    # Tool execution results
    tool_results: List[Dict[str, Any]]
    
    # Whether we need user clarification before proceeding
    needs_clarification: bool
    clarification_question: Optional[str]
    
    # Whether the user has confirmed a sensitive action
    user_confirmed: bool
    
    # Final response to send to user
    final_response: Optional[str]
    
    # Error state
    error: Optional[str]
    
    # System context snapshot (running apps, connected printers, etc.)
    system_context: Dict[str, Any]
    
    # Stream events emitted to frontend (for live activity panel)
    stream_events: List[Dict[str, Any]]
