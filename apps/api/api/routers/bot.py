"""
Discord Bot Admin Router
Endpoints for managing the Atlas Discord bot from the admin dashboard
"""

import os
import httpx
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

router = APIRouter()

# Discord Bot Token for API calls
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")
DISCORD_API_KEY = os.getenv("DISCORD_API_KEY")

# Brand colors
COLORS = {
    "primary": 0x22d3ee,
    "gold": 0xfbbf24,
    "success": 0x22c55e,
    "warning": 0xeab308,
    "error": 0xef4444,
}


def verify_api_key(x_api_key: str = Header(None)):
    """Simple API key verification for bot admin endpoints"""
    if not DISCORD_API_KEY:
        return True
    if x_api_key != DISCORD_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return True


class SendMessageRequest(BaseModel):
    """Request model for sending a message to a Discord channel"""
    channel_id: str = Field(..., description="Discord channel ID to send message to")
    content: Optional[str] = Field(None, description="Text content of the message")
    embed: Optional[Dict[str, Any]] = Field(None, description="Embed object for rich message")


class BotStatsResponse(BaseModel):
    """Response model for bot statistics"""
    server_count: int
    total_commands_24h: int
    total_commands_7d: int
    top_commands: List[Dict[str, Any]]
    uptime_hours: float
    status: str


class ServerInfo(BaseModel):
    """Model for Discord server information"""
    id: str
    name: str
    icon: Optional[str]
    member_count: int
    owner_id: str
    joined_at: Optional[str]


class ChannelInfo(BaseModel):
    """Model for Discord channel information"""
    id: str
    name: str
    type: int
    position: int


# In-memory command usage tracking (will be replaced with Supabase in production)
command_usage: List[Dict[str, Any]] = []


@router.get("/status")
async def get_bot_status(_: bool = Depends(verify_api_key)):
    """
    Get the current status of the Discord bot.
    Returns online status, server count, and basic metrics.
    """
    if not DISCORD_BOT_TOKEN:
        return {
            "status": "unconfigured",
            "message": "Discord bot token not configured",
            "server_count": 0,
            "uptime_hours": 0
        }
    
    try:
        async with httpx.AsyncClient() as client:
            # Get bot user info
            response = await client.get(
                "https://discord.com/api/v10/users/@me",
                headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
            )
            
            if response.status_code != 200:
                return {
                    "status": "error",
                    "message": f"Discord API error: {response.status_code}",
                    "server_count": 0
                }
            
            bot_user = response.json()
            
            # Get guilds (servers) the bot is in
            guilds_response = await client.get(
                "https://discord.com/api/v10/users/@me/guilds",
                headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
            )
            
            guilds = guilds_response.json() if guilds_response.status_code == 200 else []
            
            return {
                "status": "online",
                "bot_name": bot_user.get("username", "Atlas"),
                "bot_id": bot_user.get("id"),
                "bot_avatar": bot_user.get("avatar"),
                "server_count": len(guilds),
                "uptime_hours": 0  # Would need to track bot start time
            }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "server_count": 0
        }


@router.get("/servers")
async def get_bot_servers(_: bool = Depends(verify_api_key)):
    """
    Get list of all servers the bot is in.
    """
    if not DISCORD_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Discord bot token not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://discord.com/api/v10/users/@me/guilds",
                headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Discord API error: {response.text}"
                )
            
            guilds = response.json()
            
            return {
                "servers": [
                    {
                        "id": g.get("id"),
                        "name": g.get("name"),
                        "icon": f"https://cdn.discordapp.com/icons/{g.get('id')}/{g.get('icon')}.png" if g.get("icon") else None,
                        "owner": g.get("owner", False),
                        "permissions": g.get("permissions")
                    }
                    for g in guilds
                ],
                "total": len(guilds)
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/servers/{server_id}/channels")
async def get_server_channels(server_id: str, _: bool = Depends(verify_api_key)):
    """
    Get list of text channels in a specific server.
    """
    if not DISCORD_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Discord bot token not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://discord.com/api/v10/guilds/{server_id}/channels",
                headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Discord API error: {response.text}"
                )
            
            channels = response.json()
            
            # Filter to text channels only (type 0 = text channel)
            text_channels = [
                {
                    "id": c.get("id"),
                    "name": c.get("name"),
                    "type": c.get("type"),
                    "position": c.get("position", 0),
                    "parent_id": c.get("parent_id")
                }
                for c in channels
                if c.get("type") == 0  # Text channels only
            ]
            
            # Sort by position
            text_channels.sort(key=lambda x: x["position"])
            
            return {"channels": text_channels}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/send-message")
async def send_message(data: SendMessageRequest, _: bool = Depends(verify_api_key)):
    """
    Send a message to a Discord channel.
    Can send plain text, embeds, or both.
    """
    if not DISCORD_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Discord bot token not configured")
    
    if not data.content and not data.embed:
        raise HTTPException(status_code=400, detail="Must provide content or embed")
    
    try:
        payload: Dict[str, Any] = {}
        
        if data.content:
            payload["content"] = data.content
        
        if data.embed:
            # Add default styling if not present
            embed = data.embed.copy()
            if "color" not in embed:
                embed["color"] = COLORS["primary"]
            if "footer" not in embed:
                embed["footer"] = {"text": "Kingshot Atlas • ks-atlas.com"}
            if "timestamp" not in embed:
                embed["timestamp"] = datetime.now(timezone.utc).isoformat()
            payload["embeds"] = [embed]
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://discord.com/api/v10/channels/{data.channel_id}/messages",
                headers={
                    "Authorization": f"Bot {DISCORD_BOT_TOKEN}",
                    "Content-Type": "application/json"
                },
                json=payload
            )
            
            if response.status_code not in (200, 201):
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Discord API error: {response.text}"
                )
            
            message = response.json()
            
            return {
                "success": True,
                "message_id": message.get("id"),
                "channel_id": data.channel_id
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_bot_stats(_: bool = Depends(verify_api_key)):
    """
    Get bot usage statistics.
    Returns command usage, server count, and other metrics.
    """
    if not DISCORD_BOT_TOKEN:
        return {
            "status": "unconfigured",
            "server_count": 0,
            "commands_24h": 0,
            "commands_7d": 0,
            "top_commands": []
        }
    
    try:
        # Get server count
        async with httpx.AsyncClient() as client:
            guilds_response = await client.get(
                "https://discord.com/api/v10/users/@me/guilds",
                headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
            )
            server_count = len(guilds_response.json()) if guilds_response.status_code == 200 else 0
        
        # Calculate command stats from in-memory tracking
        now = datetime.now(timezone.utc)
        day_ago = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)
        
        commands_24h = len([c for c in command_usage if c.get("timestamp", now) > day_ago])
        commands_7d = len([c for c in command_usage if c.get("timestamp", now) > week_ago])
        
        # Aggregate top commands
        command_counts: Dict[str, int] = {}
        for cmd in command_usage:
            name = cmd.get("command", "unknown")
            command_counts[name] = command_counts.get(name, 0) + 1
        
        top_commands = sorted(
            [{"name": k, "count": v} for k, v in command_counts.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:5]
        
        return {
            "status": "online",
            "server_count": server_count,
            "commands_24h": commands_24h,
            "commands_7d": commands_7d,
            "top_commands": top_commands
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "server_count": 0,
            "commands_24h": 0,
            "commands_7d": 0,
            "top_commands": []
        }


class LogCommandRequest(BaseModel):
    """Request model for logging a command usage event"""
    command: str = Field(..., description="Command name that was executed")
    guild_id: str = Field(..., description="Discord guild/server ID")
    user_id: str = Field(..., description="Discord user ID who executed the command")


@router.post("/log-command")
async def log_command(
    data: LogCommandRequest,
    _: bool = Depends(verify_api_key)
):
    """
    Log a command usage event.
    Called by the Discord bot when a command is executed.
    """
    command_usage.append({
        "command": command,
        "guild_id": guild_id,
        "user_id": user_id,
        "timestamp": datetime.now(timezone.utc)
    })
    
    # Keep only last 10000 entries to prevent memory issues
    if len(command_usage) > 10000:
        command_usage.pop(0)
    
    return {"success": True}


@router.post("/leave-server/{server_id}")
async def leave_server(server_id: str, _: bool = Depends(verify_api_key)):
    """
    Make the bot leave a specific server.
    """
    if not DISCORD_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Discord bot token not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"https://discord.com/api/v10/users/@me/guilds/{server_id}",
                headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
            )
            
            if response.status_code not in (200, 204):
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Discord API error: {response.text}"
                )
            
            return {"success": True, "message": f"Left server {server_id}"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
