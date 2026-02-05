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


class SyncSettlerRoleRequest(BaseModel):
    """Request model for syncing Settler role when Kingshot account is linked/unlinked"""
    user_id: str = Field(..., description="Supabase user ID")
    is_linking: bool = Field(True, description="True if linking, False if unlinking")


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


@router.post("/sync-settler-role")
async def sync_settler_role(
    data: SyncSettlerRoleRequest,
    _: bool = Depends(verify_api_key)
):
    """
    Sync the Settler Discord role when a user links/unlinks their Kingshot account.
    
    - Assigns Settler role when user links their Kingshot account (is_linking=True)
    - Removes Settler role when user unlinks their Kingshot account (is_linking=False)
    
    Requirements:
    - User must have a Discord account linked to their Atlas profile
    - User must be a member of the Kingshot Atlas Discord server
    - Bot must have "Manage Roles" permission
    """
    from api.discord_role_sync import sync_settler_role_for_user
    
    result = await sync_settler_role_for_user(
        user_id=data.user_id,
        is_linking=data.is_linking
    )
    
    return result


@router.get("/linked-users")
async def get_linked_users(_: bool = Depends(verify_api_key)):
    """
    Get all users who have both a linked Kingshot account AND a Discord account.
    These are eligible for the Settler role.
    """
    from api.supabase_client import get_users_with_linked_kingshot_and_discord
    
    users = get_users_with_linked_kingshot_and_discord()
    
    return {
        "users": users,
        "total": len(users)
    }


@router.post("/backfill-settler-roles")
async def backfill_settler_roles(_: bool = Depends(verify_api_key)):
    """
    Backfill Settler Discord role for all users who have both:
    - A linked Kingshot account (linked_player_id)
    - A linked Discord account (discord_id)
    
    This is an admin-only endpoint to catch up users who linked before
    the auto-assign feature was implemented.
    """
    from api.supabase_client import get_users_with_linked_kingshot_and_discord
    from api.discord_role_sync import assign_settler_role
    
    # Get all eligible users
    users = get_users_with_linked_kingshot_and_discord()
    
    if not users:
        return {
            "success": True,
            "message": "No eligible users found for backfill",
            "total": 0,
            "assigned": 0,
            "skipped": 0,
            "failed": 0,
        }
    
    results = {
        "total": len(users),
        "assigned": 0,
        "skipped": 0,
        "failed": 0,
        "details": [],
    }
    
    for user in users:
        discord_id = user.get("discord_id")
        user_id = user.get("id")
        username = user.get("linked_username") or user.get("username") or "Unknown"
        
        if not discord_id:
            results["skipped"] += 1
            continue
        
        try:
            result = await assign_settler_role(discord_id)
            
            if result.get("success"):
                results["assigned"] += 1
                results["details"].append({
                    "user_id": user_id,
                    "username": username,
                    "status": "assigned",
                })
            else:
                # User might not be in the Discord server
                results["skipped"] += 1
                results["details"].append({
                    "user_id": user_id,
                    "username": username,
                    "status": "skipped",
                    "reason": result.get("error", "Unknown"),
                })
        except Exception as e:
            results["failed"] += 1
            results["details"].append({
                "user_id": user_id,
                "username": username,
                "status": "failed",
                "error": str(e),
            })
    
    results["success"] = results["failed"] == 0
    results["message"] = f"Backfill complete: {results['assigned']} assigned, {results['skipped']} skipped, {results['failed']} failed"
    
    print(f"Settler role backfill: {results['message']}")
    
    return results


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


@router.get("/discord-diagnostic")
async def discord_diagnostic(_: bool = Depends(verify_api_key)):
    """
    Diagnostic endpoint to debug Discord API connectivity issues.
    Tests bot token, guild membership, and role management permissions.
    """
    from api.discord_role_sync import DISCORD_GUILD_ID, DISCORD_SETTLER_ROLE_ID
    
    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "config": {
            "bot_token_set": bool(DISCORD_BOT_TOKEN),
            "bot_token_length": len(DISCORD_BOT_TOKEN) if DISCORD_BOT_TOKEN else 0,
            "guild_id": DISCORD_GUILD_ID,
            "settler_role_id": DISCORD_SETTLER_ROLE_ID,
        },
        "tests": {},
    }
    
    if not DISCORD_BOT_TOKEN:
        results["tests"]["token"] = {"status": "FAIL", "error": "DISCORD_BOT_TOKEN not set"}
        return results
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Test 1: Verify bot token by getting bot user
            bot_response = await client.get(
                "https://discord.com/api/v10/users/@me",
                headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
            )
            
            if bot_response.status_code == 200:
                bot_data = bot_response.json()
                results["tests"]["bot_token"] = {
                    "status": "PASS",
                    "bot_name": bot_data.get("username"),
                    "bot_id": bot_data.get("id"),
                }
            elif bot_response.status_code == 401:
                results["tests"]["bot_token"] = {
                    "status": "FAIL",
                    "error": "Invalid token (401 Unauthorized)",
                    "hint": "Token may be revoked or incorrect"
                }
                return results
            elif bot_response.status_code == 429:
                results["tests"]["bot_token"] = {
                    "status": "RATE_LIMITED",
                    "error": f"Rate limited (429)",
                    "retry_after": bot_response.headers.get("Retry-After", "unknown")
                }
                return results
            else:
                results["tests"]["bot_token"] = {
                    "status": "FAIL",
                    "error": f"HTTP {bot_response.status_code}: {bot_response.text[:200]}"
                }
                return results
            
            # Test 2: Check if bot is in the target guild
            if DISCORD_GUILD_ID:
                guild_response = await client.get(
                    f"https://discord.com/api/v10/guilds/{DISCORD_GUILD_ID}",
                    headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
                )
                
                if guild_response.status_code == 200:
                    guild_data = guild_response.json()
                    results["tests"]["guild_membership"] = {
                        "status": "PASS",
                        "guild_name": guild_data.get("name"),
                        "member_count": guild_data.get("approximate_member_count"),
                    }
                elif guild_response.status_code == 403:
                    results["tests"]["guild_membership"] = {
                        "status": "FAIL",
                        "error": "Bot not in guild or lacks access (403)"
                    }
                else:
                    results["tests"]["guild_membership"] = {
                        "status": "FAIL",
                        "error": f"HTTP {guild_response.status_code}"
                    }
            
            # Test 3: Check bot's roles in guild (to verify Manage Roles permission)
            if DISCORD_GUILD_ID:
                bot_id = results["tests"].get("bot_token", {}).get("bot_id")
                if bot_id:
                    member_response = await client.get(
                        f"https://discord.com/api/v10/guilds/{DISCORD_GUILD_ID}/members/{bot_id}",
                        headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
                    )
                    
                    if member_response.status_code == 200:
                        member_data = member_response.json()
                        results["tests"]["bot_guild_roles"] = {
                            "status": "PASS",
                            "role_count": len(member_data.get("roles", [])),
                            "role_ids": member_data.get("roles", [])[:5],  # First 5 roles
                        }
                    else:
                        results["tests"]["bot_guild_roles"] = {
                            "status": "FAIL",
                            "error": f"HTTP {member_response.status_code}"
                        }
            
            # Test 4: Check if Settler role exists
            if DISCORD_GUILD_ID and DISCORD_SETTLER_ROLE_ID:
                roles_response = await client.get(
                    f"https://discord.com/api/v10/guilds/{DISCORD_GUILD_ID}/roles",
                    headers={"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
                )
                
                if roles_response.status_code == 200:
                    roles = roles_response.json()
                    settler_role = next((r for r in roles if r["id"] == DISCORD_SETTLER_ROLE_ID), None)
                    if settler_role:
                        results["tests"]["settler_role"] = {
                            "status": "PASS",
                            "role_name": settler_role.get("name"),
                            "role_position": settler_role.get("position"),
                        }
                    else:
                        results["tests"]["settler_role"] = {
                            "status": "FAIL",
                            "error": f"Role {DISCORD_SETTLER_ROLE_ID} not found in guild"
                        }
                else:
                    results["tests"]["settler_role"] = {
                        "status": "FAIL",
                        "error": f"HTTP {roles_response.status_code}"
                    }
                    
    except Exception as e:
        results["tests"]["connection"] = {
            "status": "FAIL",
            "error": str(e)
        }
    
    # Overall status
    all_pass = all(
        t.get("status") == "PASS" 
        for t in results["tests"].values()
    )
    results["overall"] = "HEALTHY" if all_pass else "ISSUES_DETECTED"
    
    return results
