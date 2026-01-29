"""
Director Agent API Router

Provides endpoints for interacting with the Atlas Director agent,
which uses Anthropic Claude for reasoning and decision-making.
"""

import os
from datetime import datetime, timezone
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

router = APIRouter()

# Agent file paths (relative to project root)
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.parent
AGENTS_DIR = PROJECT_ROOT / "agents"
DIRECTOR_DIR = AGENTS_DIR / "director"
PROJECT_INSTANCE_DIR = AGENTS_DIR / "project-instances" / "kingshot-atlas"


class AgentMessage(BaseModel):
    """Request model for agent interaction"""
    message: str
    context: Optional[str] = None


class AgentResponse(BaseModel):
    """Response model from agent"""
    response: str
    agent: str = "Atlas Director"
    timestamp: str
    tokens_used: Optional[int] = None


class AgentStatus(BaseModel):
    """Agent status information"""
    name: str
    status: str
    version: str
    last_updated: str
    capabilities: list[str]


def load_agent_files() -> dict[str, str]:
    """Load the director agent's identity and knowledge files"""
    files = {}
    
    # Load SPECIALIST.md (identity)
    specialist_path = DIRECTOR_DIR / "SPECIALIST.md"
    if specialist_path.exists():
        files["identity"] = specialist_path.read_text()
    
    # Load LATEST_KNOWLEDGE.md
    knowledge_path = DIRECTOR_DIR / "LATEST_KNOWLEDGE.md"
    if knowledge_path.exists():
        files["knowledge"] = knowledge_path.read_text()
    
    # Load project status if available
    status_path = PROJECT_INSTANCE_DIR / "STATUS_SNAPSHOT.md"
    if status_path.exists():
        files["project_status"] = status_path.read_text()
    
    # Load activity log if available
    activity_path = PROJECT_INSTANCE_DIR / "ACTIVITY_LOG.md"
    if activity_path.exists():
        # Only load last 100 lines to keep context manageable
        content = activity_path.read_text()
        lines = content.split('\n')
        files["recent_activity"] = '\n'.join(lines[-100:])
    
    return files


def build_system_prompt(agent_files: dict[str, str]) -> str:
    """Build the system prompt from agent files"""
    parts = []
    
    if "identity" in agent_files:
        parts.append("# Your Identity\n" + agent_files["identity"])
    
    if "knowledge" in agent_files:
        parts.append("# Your Knowledge Base\n" + agent_files["knowledge"])
    
    if "project_status" in agent_files:
        parts.append("# Current Project Status\n" + agent_files["project_status"])
    
    if "recent_activity" in agent_files:
        parts.append("# Recent Activity\n" + agent_files["recent_activity"])
    
    return "\n\n---\n\n".join(parts)


def get_anthropic_client():
    """Get Anthropic client, raising error if not configured"""
    if not ANTHROPIC_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Anthropic SDK not installed. Run: pip install anthropic"
        )
    
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY environment variable not set"
        )
    
    return anthropic.Anthropic(api_key=api_key)


@router.get("/status", response_model=AgentStatus)
async def get_agent_status():
    """Get the current status of the director agent"""
    agent_files = load_agent_files()
    
    # Check if agent is properly configured
    has_identity = "identity" in agent_files
    has_knowledge = "knowledge" in agent_files
    has_anthropic = ANTHROPIC_AVAILABLE and os.getenv("ANTHROPIC_API_KEY")
    
    if has_identity and has_knowledge and has_anthropic:
        status = "operational"
    elif has_identity and has_knowledge:
        status = "degraded - LLM not configured"
    else:
        status = "offline - missing agent files"
    
    capabilities = []
    if has_identity:
        capabilities.append("identity_loaded")
    if has_knowledge:
        capabilities.append("knowledge_loaded")
    if has_anthropic:
        capabilities.append("llm_enabled")
    if (PROJECT_INSTANCE_DIR / "STATUS_SNAPSHOT.md").exists():
        capabilities.append("project_status_available")
    
    return AgentStatus(
        name="Atlas Director",
        status=status,
        version="2.0",
        last_updated="2026-01-28",
        capabilities=capabilities
    )


@router.post("/chat", response_model=AgentResponse)
async def chat_with_agent(request: AgentMessage):
    """
    Send a message to the Atlas Director agent.
    
    The agent will respond based on its identity, knowledge, and current project context.
    """
    client = get_anthropic_client()
    agent_files = load_agent_files()
    
    if not agent_files:
        raise HTTPException(
            status_code=503,
            detail="Agent files not found. Ensure agent directory exists."
        )
    
    system_prompt = build_system_prompt(agent_files)
    
    # Add any additional context from the request
    user_message = request.message
    if request.context:
        user_message = f"Additional Context:\n{request.context}\n\n---\n\nRequest:\n{request.message}"
    
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_message}
            ]
        )
        
        return AgentResponse(
            response=response.content[0].text,
            timestamp=datetime.now(timezone.utc).isoformat(),
            tokens_used=response.usage.input_tokens + response.usage.output_tokens
        )
    
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Anthropic API error: {str(e)}"
        )


@router.post("/delegate")
async def delegate_task(request: AgentMessage):
    """
    Ask the director to analyze a task and recommend which specialist to delegate to.
    
    Returns a structured delegation recommendation.
    """
    client = get_anthropic_client()
    agent_files = load_agent_files()
    
    system_prompt = build_system_prompt(agent_files)
    
    delegation_prompt = f"""Analyze this task and provide a delegation recommendation.

Task: {request.message}

Respond in this exact JSON format:
{{
    "recommended_specialist": "Product Engineer | Platform Engineer | Design Lead | Ops Lead | Release Manager | Director (self)",
    "reasoning": "Brief explanation of why this specialist",
    "task_summary": "Concise task description for handoff",
    "priority": "high | medium | low",
    "estimated_complexity": "simple | moderate | complex",
    "dependencies": ["list of any dependencies or prerequisites"],
    "success_criteria": ["list of measurable success criteria"]
}}

Only respond with the JSON, no additional text."""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=[
                {"role": "user", "content": delegation_prompt}
            ]
        )
        
        import json
        try:
            delegation = json.loads(response.content[0].text)
        except json.JSONDecodeError:
            # If JSON parsing fails, return raw response
            delegation = {"raw_response": response.content[0].text}
        
        return {
            "delegation": delegation,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tokens_used": response.usage.input_tokens + response.usage.output_tokens
        }
    
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Anthropic API error: {str(e)}"
        )


@router.get("/context")
async def get_agent_context():
    """
    Get the current context the agent has access to.
    
    Useful for debugging and understanding what the agent knows.
    """
    agent_files = load_agent_files()
    
    context_summary = {}
    for key, content in agent_files.items():
        context_summary[key] = {
            "loaded": True,
            "length": len(content),
            "preview": content[:500] + "..." if len(content) > 500 else content
        }
    
    # Check for missing files
    expected_files = ["identity", "knowledge", "project_status", "recent_activity"]
    for expected in expected_files:
        if expected not in context_summary:
            context_summary[expected] = {"loaded": False}
    
    return {
        "agent": "Atlas Director",
        "context": context_summary,
        "anthropic_configured": ANTHROPIC_AVAILABLE and bool(os.getenv("ANTHROPIC_API_KEY"))
    }
