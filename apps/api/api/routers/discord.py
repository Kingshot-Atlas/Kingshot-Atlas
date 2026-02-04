"""
Discord Integration Router
Endpoints for Discord OAuth, webhooks (patch notes, announcements, etc.)
"""

import os
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import List, Optional

router = APIRouter()

# Discord OAuth2 configuration
DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", "")
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "")

# Webhook URL from environment
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_PATCH_NOTES_WEBHOOK")
DISCORD_API_KEY = os.getenv("DISCORD_API_KEY")  # Simple API key for auth

# Brand colors
COLORS = {
    "primary": 0x22d3ee,
    "gold": 0xfbbf24,
    "success": 0x22c55e,
    "warning": 0xeab308,
    "error": 0xef4444,
}


class DiscordCallbackRequest(BaseModel):
    """Request model for Discord OAuth callback"""
    code: str = Field(..., description="Authorization code from Discord OAuth")
    redirect_uri: str = Field(..., description="Redirect URI used in the OAuth flow")


class PatchNotesRequest(BaseModel):
    """Request model for posting patch notes"""
    date: str = Field(..., description="Date of the patch notes (e.g., 'January 29, 2026')")
    new: List[str] = Field(default=[], description="List of new features")
    fixed: List[str] = Field(default=[], description="List of bug fixes")
    improved: List[str] = Field(default=[], description="List of improvements")
    role_id: Optional[str] = Field(None, description="Discord role ID to mention")


class MajorReleaseRequest(BaseModel):
    """Request model for major release announcements"""
    title: str = Field(..., description="Release title")
    description: str = Field(..., description="Release description")
    highlights: List[str] = Field(default=[], description="Key highlights")


class MaintenanceRequest(BaseModel):
    """Request model for maintenance notices"""
    date: str = Field(..., description="Date of maintenance")
    time: str = Field(..., description="Time of maintenance (UTC)")
    duration: str = Field(..., description="Expected duration")
    reason: Optional[str] = Field(None, description="Reason for maintenance")


class StatusRequest(BaseModel):
    """Request model for status updates"""
    type: str = Field(..., description="'outage' or 'resolved'")
    feature: Optional[str] = Field(None, description="Affected feature")
    message: str = Field(..., description="Status message")


def verify_api_key(x_api_key: str = Header(None)):
    """Simple API key verification for webhook endpoints"""
    if not DISCORD_API_KEY:
        # If no API key is configured, allow all requests (development mode)
        return True
    if x_api_key != DISCORD_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return True


@router.post("/callback")
async def discord_oauth_callback(data: DiscordCallbackRequest, authorization: str = Header(None)):
    """
    Handle Discord OAuth callback.
    Exchange the authorization code for user info and save to profile.
    
    This endpoint requires a valid Supabase JWT token in the Authorization header.
    """
    if not DISCORD_CLIENT_ID or not DISCORD_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Discord OAuth not configured"
        )
    
    # Verify Supabase JWT and get user
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    token = authorization.replace("Bearer ", "")
    
    # Get user from Supabase
    from api.supabase_client import get_supabase_admin
    supabase = get_supabase_admin()
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    
    try:
        # Verify the JWT and get user
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = user_response.user.id
    except Exception as e:
        print(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Exchange code for access token with Discord
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://discord.com/api/oauth2/token",
            data={
                "client_id": DISCORD_CLIENT_ID,
                "client_secret": DISCORD_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "code": data.code,
                "redirect_uri": data.redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if token_response.status_code != 200:
            print(f"Discord token exchange failed: {token_response.text}")
            raise HTTPException(
                status_code=400,
                detail="Failed to exchange Discord code"
            )
        
        token_data = token_response.json()
        access_token = token_data.get("access_token")
        
        if not access_token:
            raise HTTPException(status_code=400, detail="No access token received")
        
        # Get Discord user info
        user_response = await client.get(
            "https://discord.com/api/users/@me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if user_response.status_code != 200:
            print(f"Discord user fetch failed: {user_response.text}")
            raise HTTPException(
                status_code=400,
                detail="Failed to get Discord user info"
            )
        
        discord_user = user_response.json()
    
    discord_id = discord_user.get("id")
    discord_username = discord_user.get("global_name") or discord_user.get("username")
    
    if not discord_id:
        raise HTTPException(status_code=400, detail="Discord user ID not found")
    
    # Save to Supabase profile
    try:
        result = supabase.table("profiles").update({
            "discord_id": discord_id,
            "discord_username": discord_username,
            "discord_linked_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", user_id).execute()
        
        if not result.data:
            print(f"Profile update returned no data for user {user_id}")
    except Exception as e:
        print(f"Failed to update profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to save Discord info")
    
    print(f"Discord linked: user={user_id}, discord_id={discord_id}, username={discord_username}")
    
    return {
        "success": True,
        "discord_id": discord_id,
        "discord_username": discord_username
    }


def build_patch_notes_embed(data: PatchNotesRequest) -> dict:
    """Build Discord embed for patch notes"""
    embed = {
        "title": f"📢 Kingshot Atlas Update — {data.date}",
        "url": "https://ks-atlas.com/changelog",
        "color": COLORS["primary"],
        "fields": [],
        "footer": {"text": "Kingshot Atlas • ks-atlas.com"},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if data.new:
        embed["fields"].append({
            "name": "✨ New",
            "value": "\n".join(f"• {item}" for item in data.new),
            "inline": False,
        })

    if data.fixed:
        embed["fields"].append({
            "name": "🐛 Fixed",
            "value": "\n".join(f"• {item}" for item in data.fixed),
            "inline": False,
        })

    if data.improved:
        embed["fields"].append({
            "name": "🔧 Improved",
            "value": "\n".join(f"• {item}" for item in data.improved),
            "inline": False,
        })

    embed["fields"].append({
        "name": "📖 Full Notes",
        "value": "[View on website](https://ks-atlas.com/changelog)",
        "inline": False,
    })

    return embed


@router.post("/webhook/patch-notes")
async def post_patch_notes(
    data: PatchNotesRequest,
    _: bool = Depends(verify_api_key)
):
    """
    Post patch notes to Discord via webhook.
    
    This endpoint is called by the Release Manager agent after compiling patch notes.
    """
    if not DISCORD_WEBHOOK_URL:
        raise HTTPException(
            status_code=503,
            detail="Discord webhook not configured"
        )

    embed = build_patch_notes_embed(data)

    payload = {
        "username": "Atlas",
        "avatar_url": "https://ks-atlas.com/AtlasBotAvatar.webp",
        "embeds": [embed],
    }
    
    # Add role mention if provided
    if data.role_id:
        payload["content"] = f"<@&{data.role_id}>"
        payload["allowed_mentions"] = {"roles": [data.role_id]}

    async with httpx.AsyncClient() as client:
        response = await client.post(DISCORD_WEBHOOK_URL, json=payload)

    if response.status_code not in (200, 204):
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Discord webhook failed: {response.text}"
        )

    return {"success": True, "message": "Patch notes posted to Discord"}


@router.post("/webhook/major-release")
async def post_major_release(
    data: MajorReleaseRequest,
    _: bool = Depends(verify_api_key)
):
    """Post a major release announcement to Discord"""
    if not DISCORD_WEBHOOK_URL:
        raise HTTPException(status_code=503, detail="Discord webhook not configured")

    embed = {
        "title": f"🎉 {data.title}",
        "url": "https://ks-atlas.com/changelog",
        "description": data.description,
        "color": COLORS["gold"],
        "fields": [],
        "footer": {"text": "Kingshot Atlas • ks-atlas.com"},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if data.highlights:
        embed["fields"].append({
            "name": "🌟 Highlights",
            "value": "\n".join(f"• {h}" for h in data.highlights),
            "inline": False,
        })

    embed["fields"].append({
        "name": "📖 Full Details",
        "value": "[View on website](https://ks-atlas.com/changelog)",
        "inline": False,
    })

    payload = {
        "username": "Atlas",
        "avatar_url": "https://ks-atlas.com/AtlasBotAvatar.webp",
        "content": "📢 **New Release!**",
        "embeds": [embed],
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(DISCORD_WEBHOOK_URL, json=payload)

    if response.status_code not in (200, 204):
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Discord webhook failed: {response.text}"
        )

    return {"success": True, "message": "Major release posted to Discord"}


@router.post("/webhook/maintenance")
async def post_maintenance(
    data: MaintenanceRequest,
    _: bool = Depends(verify_api_key)
):
    """Post a maintenance notice to Discord"""
    if not DISCORD_WEBHOOK_URL:
        raise HTTPException(status_code=503, detail="Discord webhook not configured")

    embed = {
        "title": "🔧 Scheduled Maintenance",
        "description": "Kingshot Atlas will be briefly unavailable for maintenance.",
        "color": COLORS["warning"],
        "fields": [
            {"name": "📆 Date", "value": data.date, "inline": True},
            {"name": "⏰ Time", "value": data.time, "inline": True},
            {"name": "⏱️ Duration", "value": data.duration, "inline": True},
        ],
        "footer": {"text": "Kingshot Atlas • ks-atlas.com"},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if data.reason:
        embed["fields"].append({
            "name": "📝 Reason",
            "value": data.reason,
            "inline": False,
        })

    embed["fields"].append({
        "name": "💬",
        "value": "Thanks for your patience!",
        "inline": False,
    })

    payload = {
        "username": "Atlas",
        "avatar_url": "https://ks-atlas.com/AtlasBotAvatar.webp",
        "embeds": [embed],
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(DISCORD_WEBHOOK_URL, json=payload)

    if response.status_code not in (200, 204):
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Discord webhook failed: {response.text}"
        )

    return {"success": True, "message": "Maintenance notice posted to Discord"}


@router.post("/webhook/status")
async def post_status(
    data: StatusRequest,
    _: bool = Depends(verify_api_key)
):
    """Post a status update (outage or resolution) to Discord"""
    if not DISCORD_WEBHOOK_URL:
        raise HTTPException(status_code=503, detail="Discord webhook not configured")

    is_outage = data.type == "outage"
    embed = {
        "title": "⚠️ Service Issue" if is_outage else "✅ All Clear!",
        "description": data.message,
        "color": COLORS["error"] if is_outage else COLORS["success"],
        "fields": [],
        "footer": {"text": "Kingshot Atlas • ks-atlas.com"},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if data.feature:
        embed["fields"].append({
            "name": "Affected",
            "value": data.feature,
            "inline": True,
        })

    payload = {
        "username": "Atlas",
        "avatar_url": "https://ks-atlas.com/AtlasBotAvatar.webp",
        "embeds": [embed],
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(DISCORD_WEBHOOK_URL, json=payload)

    if response.status_code not in (200, 204):
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Discord webhook failed: {response.text}"
        )

    return {"success": True, "message": f"Status update ({data.type}) posted to Discord"}
