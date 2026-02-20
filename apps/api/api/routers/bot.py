"""
Discord Bot Admin Router
Endpoints for managing the Atlas Discord bot from the admin dashboard
"""

import os
import asyncio
import logging
import httpx
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import hashlib
import random
import urllib.parse
from api.config import DISCORD_BOT_TOKEN, DISCORD_API_KEY, DISCORD_API_PROXY, DISCORD_PROXY_KEY, ENVIRONMENT, ADMIN_EMAILS
from api.supabase_client import get_supabase_admin

logger = logging.getLogger("atlas.bot")

router = APIRouter()

# Discord API base URL (proxy if configured, else direct)
DISCORD_API_BASE = DISCORD_API_PROXY or "https://discord.com"

# Startup warning if proxy is not configured
if not DISCORD_API_PROXY:
    logger.warning("DISCORD_API_PROXY not set. Discord API calls will go directly to discord.com. "
                   "Render's shared IP may get Cloudflare Error 1015 (IP ban).")
else:
    logger.info("Discord API proxy configured: %s...", DISCORD_API_PROXY[:40])


# ---------------------------------------------------------------------------
# TTL Cache for Discord API responses (avoids hammering Discord on every page load)
# ---------------------------------------------------------------------------
class _TTLCache:
    """Simple in-memory cache with per-key TTL."""
    def __init__(self):
        self._store: Dict[str, tuple] = {}  # key -> (value, expires_at)

    def get(self, key: str):
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if datetime.now(timezone.utc) > expires_at:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value, ttl_seconds: int = 300):
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
        self._store[key] = (value, expires_at)

    def invalidate(self, key: str):
        self._store.pop(key, None)

_cache = _TTLCache()


def get_discord_headers():
    """Get headers for Discord API calls, including proxy key if configured."""
    headers = {"Authorization": f"Bot {DISCORD_BOT_TOKEN}"}
    if DISCORD_API_PROXY and DISCORD_PROXY_KEY:
        headers["X-Proxy-Key"] = DISCORD_PROXY_KEY
    return headers


# ---------------------------------------------------------------------------
# Discord API fetch helper with retry + exponential backoff
# ---------------------------------------------------------------------------
async def discord_fetch(
    method: str,
    path: str,
    *,
    json: Optional[Dict] = None,
    max_retries: int = 2,
    timeout: float = 15.0,
) -> httpx.Response:
    """
    Make a Discord API request with automatic retry on 5xx / 429 / network errors.
    Skips retry on 4xx (except 429) since those won't resolve with retries.
    """
    url = f"{DISCORD_API_BASE}{path}"
    headers = get_discord_headers()
    if json is not None:
        headers["Content-Type"] = "application/json"

    last_exc: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.request(method, url, headers=headers, json=json)

            # Log every Discord API call for monitoring
            _log_discord_api_call(method, path, response.status_code)

            # Success or client error (not 429) — return immediately
            if response.status_code < 500 and response.status_code != 429:
                return response

            # 429 rate-limited — respect Retry-After header
            if response.status_code == 429:
                retry_after = float(response.headers.get("Retry-After", "1"))
                retry_after = min(retry_after, 5.0)  # cap at 5s
                if attempt < max_retries:
                    await asyncio.sleep(retry_after)
                    continue
                return response

            # 5xx — exponential backoff
            if attempt < max_retries:
                await asyncio.sleep(0.5 * (2 ** attempt))  # 0.5s, 1s
                continue
            return response

        except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError) as exc:
            last_exc = exc
            _log_discord_api_call(method, path, 0, error=str(exc))
            if attempt < max_retries:
                await asyncio.sleep(0.5 * (2 ** attempt))
                continue
            raise

    # Should not reach here, but just in case
    if last_exc:
        raise last_exc
    raise RuntimeError("discord_fetch exhausted retries without result")


# ---------------------------------------------------------------------------
# Discord API call logger (async-safe, fire-and-forget to Supabase)
# ---------------------------------------------------------------------------
def _log_discord_api_call(method: str, path: str, status_code: int, error: str = None):
    """Log Discord API call to Supabase for monitoring trends. Non-blocking."""
    try:
        sb = get_supabase_admin()
        if not sb:
            return
        row = {
            "method": method,
            "path": path[:200],
            "status_code": status_code,
            "proxy_used": bool(DISCORD_API_PROXY),
        }
        if error:
            row["error"] = error[:500]
        sb.table("discord_api_log").insert(row).execute()
    except Exception:
        pass  # Never let logging break the actual request

def _sanitize_discord_error(status_code: int, response_text: str) -> str:
    """Return a clean error message, stripping Cloudflare HTML pages."""
    if "<!doctype" in response_text.lower() or "<html" in response_text.lower():
        if "1015" in response_text:
            return f"Discord API blocked (Cloudflare Error 1015 — IP rate-limited). Proxy may not be configured. Status {status_code}"
        return f"Discord API returned HTML error page (status {status_code}). Likely a Cloudflare block."
    return f"Discord API error {status_code}: {response_text[:300]}"


# Brand colors
COLORS = {
    "primary": 0x22d3ee,
    "gold": 0xfbbf24,
    "success": 0x22c55e,
    "warning": 0xeab308,
    "error": 0xef4444,
}



# In-memory rate limiter for bot admin endpoints
_rate_limit_store: Dict[str, list] = {}
BOT_RATE_LIMIT = 30  # max requests per window
BOT_RATE_WINDOW = 60  # seconds

def _check_rate_limit(client_ip: str = "unknown"):
    """Check rate limit for bot admin endpoints. Raises 429 if exceeded."""
    import time
    now = time.time()
    key = f"bot:{client_ip}"
    timestamps = _rate_limit_store.get(key, [])
    timestamps = [t for t in timestamps if now - t < BOT_RATE_WINDOW]
    if len(timestamps) >= BOT_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")
    timestamps.append(now)
    _rate_limit_store[key] = timestamps


def _verify_api_key(x_api_key: Optional[str]) -> bool:
    """Verify bot admin API key."""
    if not DISCORD_API_KEY:
        if ENVIRONMENT == "production":
            return False
        return True  # Dev mode passthrough
    return x_api_key == DISCORD_API_KEY


def _verify_bot_admin_jwt(authorization: Optional[str]) -> bool:
    """Verify admin access via Supabase JWT — checks profiles.is_admin then email fallback."""
    if not authorization:
        return False
    try:
        token = authorization
        if token.startswith("Bearer "):
            token = token[7:]
        if not token:
            return False
        client = get_supabase_admin()
        if not client:
            return False
        user_response = client.auth.get_user(token)
        if user_response and user_response.user:
            user_email = user_response.user.email
            user_id = user_response.user.id
            # Primary: database is_admin flag
            try:
                profile = client.table("profiles").select("is_admin").eq("id", user_id).single().execute()
                if profile.data and profile.data.get("is_admin") is True:
                    return True
            except Exception:
                pass
            # Fallback: admin email list
            if user_email and user_email.lower() in [e.lower() for e in ADMIN_EMAILS]:
                return True
    except Exception:
        pass
    return False


def require_bot_admin(
    x_api_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    request: Request = None,
):
    """FastAPI dependency for bot admin endpoints.
    Accepts either X-API-Key header OR Authorization Bearer JWT from an admin user.
    Also enforces per-IP rate limiting."""
    client_ip = "unknown"
    if request and request.client:
        client_ip = request.client.host
    _check_rate_limit(client_ip)

    if _verify_api_key(x_api_key):
        return True
    if _verify_bot_admin_jwt(authorization):
        return True
    raise HTTPException(
        status_code=401,
        detail="Bot admin authentication required. Use X-API-Key or Authorization header."
    )


def _verify_any_authenticated_jwt(authorization: Optional[str]) -> bool:
    """Verify that the caller has a valid Supabase JWT (any authenticated user, not just admin)."""
    if not authorization:
        return False
    try:
        token = authorization
        if token.startswith("Bearer "):
            token = token[7:]
        if not token:
            return False
        client = get_supabase_admin()
        if not client:
            return False
        user_response = client.auth.get_user(token)
        if user_response and user_response.user:
            return True
    except Exception:
        pass
    return False


def require_bot_or_user(
    x_api_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    request: Request = None,
):
    """FastAPI dependency for endpoints callable by the bot (API key) OR any authenticated user (JWT).
    Used for user-initiated actions like sync-settler-role."""
    client_ip = "unknown"
    if request and request.client:
        client_ip = request.client.host
    _check_rate_limit(client_ip)

    if _verify_api_key(x_api_key):
        return True
    if _verify_any_authenticated_jwt(authorization):
        return True
    raise HTTPException(
        status_code=401,
        detail="Authentication required. Sign in or provide API key."
    )


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



@router.get("/health")
async def bot_health():
    """
    Lightweight health endpoint — does NOT call Discord API.
    Returns cached bot status if available, otherwise just config state.
    Frontend can poll this cheaply without burning Discord API quota.
    """
    cached_status = _cache.get("bot_status")
    cached_servers = _cache.get("servers_list")

    return {
        "bot_token_configured": bool(DISCORD_BOT_TOKEN),
        "proxy_configured": bool(DISCORD_API_PROXY),
        "discord_api_base": DISCORD_API_BASE[:50],
        "cached_bot_status": cached_status.get("status") if cached_status else None,
        "cached_server_count": cached_servers.get("total") if cached_servers else None,
        "cache_note": "Call /status or /servers to populate cache from Discord API",
    }


@router.get("/status")
async def get_bot_status(_: bool = Depends(require_bot_admin)):
    """
    Get the current status of the Discord bot.
    Returns online status and basic bot info.
    Note: server_count comes from /servers endpoint to avoid duplicate Discord API calls.
    Caches result for 5 minutes.
    """
    if not DISCORD_BOT_TOKEN:
        return {
            "status": "unconfigured",
            "message": "Discord bot token not configured",
            "server_count": 0,
            "uptime_hours": 0
        }
    
    # Return cached status if fresh
    cached = _cache.get("bot_status")
    if cached is not None:
        return cached
    
    try:
        response = await discord_fetch("GET", "/api/v10/users/@me", timeout=10.0)
        
        if response.status_code != 200:
            return {
                "status": "error",
                "message": _sanitize_discord_error(response.status_code, response.text),
                "server_count": 0
            }
        
        bot_user = response.json()
        
        result = {
            "status": "online",
            "bot_name": bot_user.get("username", "Atlas"),
            "bot_id": bot_user.get("id"),
            "bot_avatar": bot_user.get("avatar"),
            "server_count": 0,
            "uptime_hours": 0
        }
        _cache.set("bot_status", result, ttl_seconds=300)
        return result
    except Exception as e:
        logger.error("Error in /status: %s", e)
        return {
            "status": "error",
            "message": "Failed to connect to Discord API",
            "server_count": 0
        }


@router.get("/servers")
async def get_bot_servers(_: bool = Depends(require_bot_admin)):
    """
    Get list of all servers the bot is in, with member counts.
    Uses ?with_counts=true for approximate member/presence stats.
    Returns gracefully on error instead of throwing.
    Caches result for 5 minutes to reduce Discord API calls.
    """
    if not DISCORD_BOT_TOKEN:
        return {"servers": [], "total": 0, "error": "Discord bot token not configured"}
    
    # Return cached servers if fresh
    cached = _cache.get("servers_list")
    if cached is not None:
        return cached
    
    try:
        response = await discord_fetch("GET", "/api/v10/users/@me/guilds?with_counts=true")
        
        if response.status_code != 200:
            return {
                "servers": [],
                "total": 0,
                "error": _sanitize_discord_error(response.status_code, response.text)
            }
        
        guilds = response.json()
        
        result = {
            "servers": [
                {
                    "id": g.get("id"),
                    "name": g.get("name"),
                    "icon": f"https://cdn.discordapp.com/icons/{g.get('id')}/{g.get('icon')}.png" if g.get("icon") else None,
                    "owner": g.get("owner", False),
                    "permissions": g.get("permissions"),
                    "member_count": g.get("approximate_member_count", 0),
                    "presence_count": g.get("approximate_presence_count", 0)
                }
                for g in guilds
            ],
            "total": len(guilds)
        }
        _cache.set("servers_list", result, ttl_seconds=300)
        return result
    except Exception as e:
        logger.error("Error in /servers: %s", e)
        return {"servers": [], "total": 0, "error": "Failed to fetch server list"}


@router.get("/servers/{server_id}/channels")
async def get_server_channels(server_id: str, _: bool = Depends(require_bot_admin)):
    """
    Get list of text channels in a specific server.
    """
    if not DISCORD_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Discord bot token not configured")
    
    try:
        response = await discord_fetch("GET", f"/api/v10/guilds/{server_id}/channels")
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=_sanitize_discord_error(response.status_code, response.text)
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
        logger.error("Error in /servers/channels: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch channels")


@router.post("/send-message")
async def send_message(data: SendMessageRequest, _: bool = Depends(require_bot_admin)):
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
        
        response = await discord_fetch(
            "POST",
            f"/api/v10/channels/{data.channel_id}/messages",
            json=payload,
        )
        
        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=response.status_code,
                detail=_sanitize_discord_error(response.status_code, response.text)
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
        logger.error("Error in /send-message: %s", e)
        raise HTTPException(status_code=500, detail="Failed to send message")


class SendReactionRoleRequest(BaseModel):
    """Request model for deploying a reaction role message"""
    channel_id: str = Field(..., description="Discord channel ID to send message to")
    title: str = Field(..., description="Embed title")
    description: str = Field(..., description="Embed description with emoji-role listing")
    emoji_role_mappings: List[Dict[str, Any]] = Field(..., description="List of {emoji, role_id, label} mappings")
    config_id: str = Field(..., description="Supabase bot_reaction_roles row ID")


@router.post("/send-reaction-role")
async def send_reaction_role(data: SendReactionRoleRequest, _: bool = Depends(require_bot_admin)):
    """
    Deploy a reaction role message: send embed, add reactions, update config with message_id.
    The bot-side handler listens for reactions on messages with IDs in bot_reaction_roles.
    """
    if not DISCORD_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Discord bot token not configured")

    if not data.emoji_role_mappings:
        raise HTTPException(status_code=400, detail="Must provide at least one emoji-role mapping")

    try:
        # Build embed
        embed = {
            "title": data.title or "Role Selection",
            "description": data.description or "React to get your roles!",
            "color": 0xa855f7,
            "footer": {"text": "Kingshot Atlas • React to assign roles"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        payload: Dict[str, Any] = {"embeds": [embed]}

        # Send message
        response = await discord_fetch(
            "POST",
            f"/api/v10/channels/{data.channel_id}/messages",
            json=payload,
        )

        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=response.status_code,
                detail=_sanitize_discord_error(response.status_code, response.text)
            )

        message = response.json()
        message_id = message.get("id")

        # Add reactions to the message (one per emoji mapping)
        for mapping in data.emoji_role_mappings:
            emoji = mapping.get("emoji", "").strip()
            if not emoji:
                continue
            # URL-encode the emoji for the API path
            encoded_emoji = urllib.parse.quote(emoji)
            try:
                await discord_fetch(
                    "PUT",
                    f"/api/v10/channels/{data.channel_id}/messages/{message_id}/reactions/{encoded_emoji}/@me",
                    max_retries=1,
                    timeout=10.0,
                )
                # Small delay to avoid rate limits on reactions
                await asyncio.sleep(0.3)
            except Exception as e:
                logger.warning("Failed to add reaction %s: %s", emoji, e)

        # Update Supabase config with message_id and set active
        sb = get_supabase_admin()
        if sb and data.config_id:
            try:
                sb.table("bot_reaction_roles").update({
                    "message_id": message_id,
                    "active": True,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", data.config_id).execute()
            except Exception as e:
                logger.warning("Failed to update reaction role config: %s", e)

        return {
            "success": True,
            "message_id": message_id,
            "channel_id": data.channel_id,
            "reactions_added": len(data.emoji_role_mappings),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in /send-reaction-role: %s", e)
        raise HTTPException(status_code=500, detail="Failed to deploy reaction role message")


class EditReactionRoleRequest(BaseModel):
    """Request model for editing an already-deployed reaction role message"""
    channel_id: str = Field(..., description="Discord channel ID where the message lives")
    message_id: str = Field(..., description="Discord message ID to edit")
    title: str = Field(..., description="Updated embed title")
    description: str = Field(..., description="Updated embed description")
    config_id: str = Field(..., description="Supabase bot_reaction_roles row ID")


@router.patch("/edit-reaction-role")
async def edit_reaction_role(data: EditReactionRoleRequest, _: bool = Depends(require_bot_admin)):
    """
    Edit an already-deployed reaction role embed message in Discord.
    Updates the embed content in-place without deleting and re-posting.
    """
    if not DISCORD_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Discord bot token not configured")

    try:
        embed = {
            "title": data.title or "Role Selection",
            "description": data.description or "React to get your roles!",
            "color": 0xa855f7,
            "footer": {"text": "Kingshot Atlas • React to assign roles"},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        response = await discord_fetch(
            "PATCH",
            f"/api/v10/channels/{data.channel_id}/messages/{data.message_id}",
            json={"embeds": [embed]},
        )

        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=response.status_code,
                detail=_sanitize_discord_error(response.status_code, response.text)
            )

        # Update Supabase config
        sb = get_supabase_admin()
        if sb and data.config_id:
            try:
                sb.table("bot_reaction_roles").update({
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", data.config_id).execute()
            except Exception as e:
                logger.warning("Failed to update reaction role config timestamp: %s", e)

        return {"success": True, "message_id": data.message_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in /edit-reaction-role: %s", e)
        raise HTTPException(status_code=500, detail="Failed to edit reaction role message")


class SpotlightRequest(BaseModel):
    """Request model for sending a spotlight message via Discord webhook"""
    content: str = Field(..., description="Message content to send")
    username: str = Field(default="Atlas Spotlight", description="Webhook display name")
    avatar_url: Optional[str] = Field(default=None, description="Webhook avatar URL")


SPOTLIGHT_WEBHOOK_URL = os.getenv("DISCORD_SPOTLIGHT_WEBHOOK_URL", "")


@router.post("/spotlight")
async def send_spotlight(data: SpotlightRequest, _: bool = Depends(require_bot_admin)):
    """
    Send a spotlight message to the #spotlight Discord channel via webhook.
    Proxies the webhook call server-side to avoid browser CORS issues.
    """
    webhook_url = SPOTLIGHT_WEBHOOK_URL
    if not webhook_url:
        raise HTTPException(status_code=503, detail="Spotlight webhook URL not configured")

    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Message content cannot be empty")

    try:
        payload: Dict[str, Any] = {
            "content": data.content,
            "username": data.username,
        }
        if data.avatar_url:
            payload["avatar_url"] = data.avatar_url

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(webhook_url, json=payload)

        if response.status_code in (200, 204):
            return {"success": True, "message": "Spotlight message sent successfully"}
        else:
            logger.error("Spotlight webhook failed: %s %s", response.status_code, response.text[:200])
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Discord webhook returned {response.status_code}"
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Discord webhook timed out")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in /spotlight: %s", e)
        raise HTTPException(status_code=500, detail="Failed to send spotlight message")


SPOTLIGHT_AVATAR_URL = "https://ks-atlas.com/AtlasBotAvatar.webp"
SPOTLIGHT_BOT_NAME = "Atlas"

SPOTLIGHT_TEMPLATES: Dict[str, list] = {
    "supporter": [
        "🎉 A new legend rises! {user} just became an **Atlas Supporter**! Your belief in this community fuels everything we build. From the bottom of our hearts — thank you. 💎",
        "⚡ {user} just leveled up to **Atlas Supporter**! Every kingdom, every score, every feature — you make it possible. We don't take that for granted. Thank you! 💎",
        "🌟 Shoutout to {user} for becoming an **Atlas Supporter**! You're not just supporting a tool — you're investing in the competitive Kingshot community. That means the world. 💎",
        "💎 {user} has joined the ranks of **Atlas Supporters**! The intelligence gets stronger, the tools get sharper — all because of people like you. Thank you for believing in Atlas!",
        "🏆 Big moment! {user} just subscribed as an **Atlas Supporter**! Your contribution keeps this community-powered project alive and growing. We salute you! 💎",
        "✨ Welcome to the Supporter family, {user}! Your support means more kingdoms tracked, better tools, and a stronger community. Atlas wouldn't be Atlas without you. 💎",
        "🔥 {user} just unlocked **Atlas Supporter** status! You're powering the tools that thousands of players rely on every day. That's legendary. Thank you! 💎",
        "💪 The Atlas army grows stronger! {user} just joined as an **Atlas Supporter**. Your backing keeps the scoreboard running and the data flowing. We appreciate you! 💎",
        "🎯 {user} has stepped up as an **Atlas Supporter**! You're the reason we can keep building the best kingdom intelligence out there. Massive respect. 💎",
        "⭐ A new Supporter enters the arena! {user}, your contribution goes straight into making Atlas better for every player. From all of us — thank you! 💎",
    ],
    "ambassador": [
        "🏛️ {user} has earned the title of **Atlas Ambassador**! By spreading the word and bringing players into the fold, you've proven yourself a true champion of this community. 🙌",
        "⚡ A new **Ambassador** has emerged! {user} has been rallying players and building bridges across kingdoms. Your referrals strengthen us all. Thank you! 🏛️",
        "🌟 Hats off to {user} — our newest **Atlas Ambassador**! You didn't just join the community, you grew it. That kind of dedication doesn't go unnoticed. 🏛️",
        "🏛️ {user} just unlocked **Ambassador** status! Every player you've brought to Atlas makes our intelligence network stronger. You're a legend. Keep building! 💜",
        "👑 {user} has been crowned an **Atlas Ambassador**! Your dedication to growing this community is unmatched. Twenty referrals and counting — you're a force of nature! 🏛️",
        "🔥 From player to legend — {user} just became an **Atlas Ambassador**! You've brought an incredible number of players into the fold. The community salutes you! 🏛️",
        "💜 {user} is now officially an **Atlas Ambassador**! Your tireless work spreading the word about Atlas has made a real difference. We couldn't do this without you. 🏛️",
        "🏛️ Bow before {user}, our newest **Atlas Ambassador**! You've proven that one person truly can grow a community. Your referrals are legendary. 👏",
        "🌍 {user} just reached **Ambassador** tier! By connecting players across kingdoms, you've helped build something bigger than any one kingdom. Thank you, Ambassador! 🏛️",
        "⭐ {user} has achieved **Atlas Ambassador** status! Your passion for this community shines through every referral. We're honored to have you leading the charge! 🏛️",
    ],
}


def _build_spotlight_message(reason: str, discord_username: str, discord_user_id: str = "") -> str:
    """Build a random spotlight message for the given reason."""
    templates = SPOTLIGHT_TEMPLATES.get(reason, SPOTLIGHT_TEMPLATES["supporter"])
    template = random.choice(templates)
    mention = f"<@{discord_user_id}>" if discord_user_id else f"**{discord_username}**"
    return template.replace("{user}", mention)


async def send_spotlight_to_discord(content: str) -> bool:
    """Send a spotlight message to Discord via webhook. Returns True on success."""
    webhook_url = SPOTLIGHT_WEBHOOK_URL
    if not webhook_url:
        logger.warning("Spotlight webhook URL not configured, skipping auto-spotlight")
        return False

    try:
        payload = {
            "content": content,
            "username": SPOTLIGHT_BOT_NAME,
            "avatar_url": SPOTLIGHT_AVATAR_URL,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(webhook_url, json=payload)
        if response.status_code in (200, 204):
            logger.info("Auto-spotlight sent successfully")
            return True
        else:
            logger.error("Auto-spotlight webhook failed: %s %s", response.status_code, response.text[:200])
            return False
    except Exception as e:
        logger.error("Error sending auto-spotlight: %s", e)
        return False


def _log_spotlight_history(
    reason: str,
    message: str,
    discord_username: str = "",
    discord_user_id: str = "",
    user_id: str = "",
    auto_triggered: bool = True,
    status: str = "sent",
    error_message: str = "",
) -> bool:
    """Log a spotlight to the spotlight_history table."""
    sb = get_supabase_admin()
    if not sb:
        return False
    try:
        data: Dict[str, Any] = {
            "reason": reason,
            "message": message,
            "auto_triggered": auto_triggered,
            "status": status,
        }
        if discord_username:
            data["discord_username"] = discord_username
        if discord_user_id:
            data["discord_user_id"] = discord_user_id
        if user_id:
            data["user_id"] = user_id
        if status == "sent":
            data["sent_at"] = datetime.now(timezone.utc).isoformat()
        if error_message:
            data["error_message"] = error_message
        sb.table("spotlight_history").insert(data).execute()
        return True
    except Exception as e:
        logger.error("Error logging spotlight history: %s", e)
        return False


@router.post("/process-pending-spotlights")
async def process_pending_spotlights(_: bool = Depends(require_bot_admin)):
    """
    Process all pending auto-triggered spotlights.
    Generates messages and sends them to Discord, then updates status.
    """
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        result = sb.table("spotlight_history").select("*").eq("status", "pending").order("created_at").execute()
        pending = result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch pending spotlights: {e}")

    sent_count = 0
    failed_count = 0

    for entry in pending:
        reason = entry.get("reason", "supporter")
        username = entry.get("discord_username") or "Unknown"
        user_id_val = entry.get("discord_user_id") or ""
        message = _build_spotlight_message(reason, username, user_id_val)

        success = await send_spotlight_to_discord(message)
        new_status = "sent" if success else "failed"

        try:
            update_data: Dict[str, Any] = {
                "status": new_status,
                "message": message,
            }
            if success:
                update_data["sent_at"] = datetime.now(timezone.utc).isoformat()
                sent_count += 1
            else:
                update_data["error_message"] = "Webhook delivery failed"
                failed_count += 1
            sb.table("spotlight_history").update(update_data).eq("id", entry["id"]).execute()
        except Exception as e:
            logger.error("Failed to update spotlight %s: %s", entry["id"], e)
            failed_count += 1

        # Small delay to avoid webhook rate limits
        await asyncio.sleep(1)

    return {
        "success": True,
        "processed": len(pending),
        "sent": sent_count,
        "failed": failed_count,
    }


@router.get("/stats")
async def get_bot_stats(_: bool = Depends(require_bot_admin)):
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
        # Get server count from cache first, then Discord API
        cached_servers = _cache.get("servers_list")
        if cached_servers:
            server_count = cached_servers.get("total", 0)
        else:
            try:
                response = await discord_fetch("GET", "/api/v10/users/@me/guilds")
                server_count = len(response.json()) if response.status_code == 200 else 0
            except Exception:
                server_count = 0
        
        # Calculate command stats from Supabase
        now = datetime.now(timezone.utc)
        day_ago = (now - timedelta(days=1)).isoformat()
        week_ago = (now - timedelta(days=7)).isoformat()
        
        commands_24h = 0
        commands_7d = 0
        top_commands = []
        
        sb = get_supabase_admin()
        if sb:
            try:
                r24 = sb.table("bot_command_usage").select("id", count="exact").gte("created_at", day_ago).execute()
                commands_24h = r24.count or 0
                
                r7d = sb.table("bot_command_usage").select("id", count="exact").gte("created_at", week_ago).execute()
                commands_7d = r7d.count or 0
                
                # Top commands (all time, limited to recent 10k)
                all_cmds = sb.table("bot_command_usage").select("command_name").order("created_at", desc=True).limit(10000).execute()
                command_counts: Dict[str, int] = {}
                for row in (all_cmds.data or []):
                    name = row.get("command_name", "unknown")
                    command_counts[name] = command_counts.get(name, 0) + 1
                top_commands = sorted(
                    [{"name": k, "count": v} for k, v in command_counts.items()],
                    key=lambda x: x["count"],
                    reverse=True
                )[:5]
            except Exception as e:
                logger.warning("Failed to read command stats from Supabase: %s", e)
        
        return {
            "status": "online",
            "server_count": server_count,
            "commands_24h": commands_24h,
            "commands_7d": commands_7d,
            "top_commands": top_commands
        }
    except Exception as e:
        logger.error("Error in /stats: %s", e)
        return {
            "status": "error",
            "message": "Failed to fetch bot statistics",
            "server_count": 0,
            "commands_24h": 0,
            "commands_7d": 0,
            "top_commands": []
        }


@router.get("/analytics")
async def get_bot_analytics(_: bool = Depends(require_bot_admin)):
    """
    Comprehensive bot analytics: command usage (24h/7d/30d), unique users,
    server breakdown, latency stats, and daily time series.
    """
    sb = get_supabase_admin()
    if not sb:
        return {"error": "Supabase not configured"}
    
    now = datetime.now(timezone.utc)
    day_ago = (now - timedelta(days=1)).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()
    
    try:
        # Fetch all rows from last 30 days (command_name, user_id_hash, guild_id, latency_ms, created_at)
        rows_resp = sb.table("bot_command_usage").select(
            "command_name,user_id_hash,guild_id,latency_ms,created_at"
        ).gte("created_at", month_ago).order("created_at", desc=True).limit(50000).execute()
        rows = rows_resp.data or []
        
        # Parse into buckets
        r24, r7d, r30d = [], [], []
        for r in rows:
            r30d.append(r)
            ts = r.get("created_at", "")
            if ts >= week_ago:
                r7d.append(r)
            if ts >= day_ago:
                r24.append(r)
        
        def compute_stats(data):
            total = len(data)
            unique_users = len(set(r.get("user_id_hash", "") for r in data))
            # Command breakdown
            cmd_counts: Dict[str, int] = {}
            cmd_unique: Dict[str, set] = {}
            for r in data:
                cmd = r.get("command_name", "unknown")
                cmd_counts[cmd] = cmd_counts.get(cmd, 0) + 1
                if cmd not in cmd_unique:
                    cmd_unique[cmd] = set()
                cmd_unique[cmd].add(r.get("user_id_hash", ""))
            commands = sorted(
                [{"name": k, "count": v, "unique_users": len(cmd_unique.get(k, set()))} for k, v in cmd_counts.items()],
                key=lambda x: x["count"],
                reverse=True
            )
            # Latency stats
            latencies = [r.get("latency_ms") for r in data if r.get("latency_ms") is not None]
            latency = None
            if latencies:
                latencies_sorted = sorted(latencies)
                latency = {
                    "avg": round(sum(latencies) / len(latencies)),
                    "p50": latencies_sorted[len(latencies_sorted) // 2],
                    "p95": latencies_sorted[int(len(latencies_sorted) * 0.95)],
                    "max": latencies_sorted[-1],
                }
            return {"total": total, "unique_users": unique_users, "commands": commands, "latency": latency}
        
        stats_24h = compute_stats(r24)
        stats_7d = compute_stats(r7d)
        stats_30d = compute_stats(r30d)
        
        # Server breakdown (30d)
        server_counts: Dict[str, int] = {}
        for r in r30d:
            gid = r.get("guild_id", "DM")
            server_counts[gid] = server_counts.get(gid, 0) + 1
        servers = sorted(
            [{"guild_id": k, "commands": v} for k, v in server_counts.items()],
            key=lambda x: x["commands"],
            reverse=True
        )
        
        # Per-command latency breakdown (30d)
        cmd_latencies: Dict[str, list] = {}
        for r in r30d:
            cmd = r.get("command_name", "unknown")
            lat = r.get("latency_ms")
            if lat is not None:
                if cmd not in cmd_latencies:
                    cmd_latencies[cmd] = []
                cmd_latencies[cmd].append(lat)
        latency_by_command = []
        for cmd, lats in cmd_latencies.items():
            lats_sorted = sorted(lats)
            latency_by_command.append({
                "command": cmd,
                "avg": round(sum(lats) / len(lats)),
                "p50": lats_sorted[len(lats_sorted) // 2],
                "p95": lats_sorted[int(len(lats_sorted) * 0.95)],
                "count": len(lats),
            })
        latency_by_command.sort(key=lambda x: x["avg"], reverse=True)
        
        # Daily time series (last 30 days)
        daily: Dict[str, Dict] = {}
        for r in r30d:
            day = r.get("created_at", "")[:10]
            if day not in daily:
                daily[day] = {"date": day, "commands": 0, "unique_users": set()}
            daily[day]["commands"] += 1
            daily[day]["unique_users"].add(r.get("user_id_hash", ""))
        time_series = sorted(
            [{"date": d["date"], "commands": d["commands"], "unique_users": len(d["unique_users"])} for d in daily.values()],
            key=lambda x: x["date"]
        )
        
        return {
            "period_24h": stats_24h,
            "period_7d": stats_7d,
            "period_30d": stats_30d,
            "servers": servers,
            "latency_by_command": latency_by_command,
            "time_series": time_series,
        }
    except Exception as e:
        logger.error("Error in /analytics: %s", e)
        return {"error": "Failed to compute analytics"}


class LogMultirallyRequest(BaseModel):
    """Request model for logging multirally analytics"""
    target: str = Field(..., description="Target building name")
    player_count: int = Field(..., description="Number of players in the rally")
    gap: int = Field(0, description="Gap in seconds between hits")
    guild_id: str = Field("DM", description="Discord guild/server ID")
    user_id: str = Field(..., description="Discord user ID")
    is_supporter: bool = Field(False, description="Whether the user is a supporter")


class LogCommandRequest(BaseModel):
    """Request model for logging a command usage event"""
    command: str = Field(..., description="Command name that was executed")
    guild_id: str = Field(..., description="Discord guild/server ID")
    user_id: str = Field(..., description="Discord user ID who executed the command")
    latency_ms: Optional[int] = Field(None, description="Command response time in milliseconds")


class SyncSettlerRoleRequest(BaseModel):
    """Request model for syncing Settler role when Kingshot account is linked/unlinked"""
    user_id: str = Field(..., description="Supabase user ID")
    is_linking: bool = Field(True, description="True if linking, False if unlinking")


@router.post("/log-multirally")
async def log_multirally(
    data: LogMultirallyRequest,
    _: bool = Depends(require_bot_or_user)
):
    """
    Log multirally analytics (target building, player count, gap) to Supabase.
    User IDs are hashed for privacy.
    """
    user_hash = hashlib.sha256(data.user_id.encode()).hexdigest()[:16]

    client = get_supabase_admin()
    if client:
        try:
            client.table("multirally_analytics").insert({
                "target": data.target[:100],
                "player_count": data.player_count,
                "gap": data.gap,
                "guild_id": data.guild_id,
                "user_id_hash": user_hash,
                "is_supporter": data.is_supporter,
            }).execute()
        except Exception as e:
            logger.warning("Failed to log multirally analytics: %s", e)

    return {"success": True}


@router.get("/multirally-analytics")
async def get_multirally_analytics(_: bool = Depends(require_bot_admin)):
    """
    Get detailed multirally analytics: target building distribution, avg players per call.
    Uses the multirally_analytics table (detailed per-call logs).
    """
    sb = get_supabase_admin()
    if not sb:
        return {"error": "Supabase not configured"}

    try:
        rows_resp = sb.table("multirally_analytics").select("*").order("created_at", desc=True).limit(1000).execute()
        rows = rows_resp.data or []

        if not rows:
            return {"total_uses": 0, "avg_players": 0, "target_distribution": [], "supporter_ratio": 0}

        total = len(rows)
        avg_players = round(sum(r.get("player_count", 0) for r in rows) / total, 1) if total else 0
        supporters = sum(1 for r in rows if r.get("is_supporter"))

        target_counts: Dict[str, int] = {}
        for r in rows:
            t = r.get("target", "Unknown")
            target_counts[t] = target_counts.get(t, 0) + 1
        target_dist = sorted(
            [{"target": k, "count": v, "pct": round(v / total * 100, 1)} for k, v in target_counts.items()],
            key=lambda x: x["count"], reverse=True
        )

        return {
            "total_uses": total,
            "avg_players": avg_players,
            "target_distribution": target_dist,
            "supporter_ratio": round(supporters / total * 100, 1) if total else 0,
        }
    except Exception as e:
        logger.error("Error in /multirally-analytics: %s", e)
        return {"error": "Failed to compute multirally analytics"}


@router.get("/redeem-stats")
async def get_redeem_stats(_: bool = Depends(require_bot_admin)):
    """
    Gift code redemption analytics from the gift_code_redemptions table.
    Returns totals, success rates, top codes, and period breakdowns.
    """
    sb = get_supabase_admin()
    if not sb:
        return {"error": "Supabase not configured"}

    now = datetime.now(timezone.utc)
    day_ago = (now - timedelta(days=1)).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()

    try:
        rows_resp = sb.table("gift_code_redemptions").select(
            "code,player_id,success,error_code,message,created_at"
        ).gte("created_at", month_ago).order("created_at", desc=True).limit(10000).execute()
        rows = rows_resp.data or []

        if not rows:
            return {
                "total": 0, "success_rate": 0, "unique_players": 0,
                "today": {"total": 0, "success": 0, "failed": 0, "players": 0},
                "week": {"total": 0, "success": 0, "failed": 0, "players": 0},
                "month": {"total": 0, "success": 0, "failed": 0, "players": 0},
                "top_codes": [], "error_breakdown": [],
            }

        def period_stats(data):
            total = len(data)
            success = sum(1 for r in data if r.get("success"))
            failed = total - success
            players = len(set(r.get("player_id", "") for r in data))
            return {"total": total, "success": success, "failed": failed, "players": players}

        r_today = [r for r in rows if r.get("created_at", "") >= day_ago]
        r_week = [r for r in rows if r.get("created_at", "") >= week_ago]

        total = len(rows)
        successes = sum(1 for r in rows if r.get("success"))
        success_rate = round((successes / total) * 100, 1) if total else 0
        unique_players = len(set(r.get("player_id", "") for r in rows))

        # Top codes by attempt count
        code_map: Dict[str, Dict] = {}
        for r in rows:
            c = r.get("code", "")
            if c not in code_map:
                code_map[c] = {"attempts": 0, "successes": 0}
            code_map[c]["attempts"] += 1
            if r.get("success"):
                code_map[c]["successes"] += 1
        top_codes = sorted(
            [{"code": k, "attempts": v["attempts"], "successes": v["successes"],
              "success_rate": round((v["successes"] / v["attempts"]) * 100, 1) if v["attempts"] else 0}
             for k, v in code_map.items()],
            key=lambda x: x["attempts"], reverse=True
        )[:10]

        # Error code breakdown (failures only)
        err_map: Dict[str, int] = {}
        for r in rows:
            if not r.get("success"):
                err = str(r.get("error_code") or r.get("message") or "unknown")
                err_map[err] = err_map.get(err, 0) + 1
        error_breakdown = sorted(
            [{"error": k, "count": v} for k, v in err_map.items()],
            key=lambda x: x["count"], reverse=True
        )[:8]

        return {
            "total": total,
            "success_rate": success_rate,
            "unique_players": unique_players,
            "today": period_stats(r_today),
            "week": period_stats(r_week),
            "month": period_stats(rows),
            "top_codes": top_codes,
            "error_breakdown": error_breakdown,
        }
    except Exception as e:
        logger.error("Error in /redeem-stats: %s", e)
        return {"error": "Failed to compute redeem stats"}


@router.get("/check-permissions/{guild_id}")
async def check_guild_permissions(
    guild_id: str,
    _: bool = Depends(require_bot_admin),
):
    """
    Check the bot's permissions in a specific guild.
    Returns permission flags and a health status.
    """
    if not DISCORD_BOT_TOKEN:
        raise HTTPException(status_code=500, detail="Bot token not configured")

    headers = {
        "Authorization": f"Bot {DISCORD_BOT_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Get bot's own member info in the guild
            me_resp = await client.get(
                f"{DISCORD_API_BASE}/api/v10/guilds/{guild_id}/members/@me",
                headers=headers,
            )
            if me_resp.status_code != 200:
                return {
                    "healthy": False,
                    "error": f"Cannot access guild (HTTP {me_resp.status_code})",
                    "permissions": {},
                }

            # Get guild roles to compute effective permissions
            roles_resp = await client.get(
                f"{DISCORD_API_BASE}/api/v10/guilds/{guild_id}/roles",
                headers=headers,
            )
            member = me_resp.json()
            bot_role_ids = set(member.get("roles", []))
            roles = roles_resp.json() if roles_resp.status_code == 200 else []

            # Compute combined permission bits
            perms = 0
            for role in roles:
                if role["id"] == guild_id or role["id"] in bot_role_ids:
                    perms |= int(role.get("permissions", "0"))

            # Check key permissions
            checks = {
                "VIEW_CHANNEL": bool(perms & (1 << 10)),
                "SEND_MESSAGES": bool(perms & (1 << 11)),
                "EMBED_LINKS": bool(perms & (1 << 14)),
                "MANAGE_ROLES": bool(perms & (1 << 28)),
                "USE_APPLICATION_COMMANDS": bool(perms & (1 << 31)),
            }
            healthy = all(checks.values())

            return {
                "healthy": healthy,
                "permissions": checks,
                "missing": [k for k, v in checks.items() if not v],
            }
    except Exception as e:
        return {"healthy": False, "error": str(e), "permissions": {}}


@router.post("/log-command")
async def log_command(
    data: LogCommandRequest,
    _: bool = Depends(require_bot_or_user)
):
    """
    Log a command usage event to Supabase.
    User IDs are hashed for privacy.
    """
    user_hash = hashlib.sha256(data.user_id.encode()).hexdigest()[:16]
    
    client = get_supabase_admin()
    if client:
        try:
            row = {
                "command_name": data.command,
                "user_id_hash": user_hash,
                "guild_id": data.guild_id,
            }
            if data.latency_ms is not None:
                row["latency_ms"] = data.latency_ms
            client.table("bot_command_usage").insert(row).execute()
        except Exception as e:
            logger.warning("Failed to log command to Supabase: %s", e)
    
    return {"success": True}


@router.post("/sync-supporter-role")
async def sync_supporter_role_endpoint(
    data: SyncSettlerRoleRequest,
    _: bool = Depends(require_bot_admin)
):
    """
    Sync the Supporter Discord role for a specific user (admin-only).
    Looks up the user's subscription tier and discord_id, then assigns/removes
    the Supporter role accordingly.
    """
    from api.supabase_client import get_user_profile
    from api.discord_role_sync import sync_subscription_role
    
    profile = get_user_profile(data.user_id)
    if not profile:
        return {"success": False, "error": "User not found"}
    
    discord_id = profile.get("discord_id")
    if not discord_id:
        return {"success": False, "error": "User has no Discord account linked"}
    
    tier = profile.get("subscription_tier", "free")
    
    result = await sync_subscription_role(discord_id, tier)
    return result


@router.post("/sync-settler-role")
async def sync_settler_role(
    data: SyncSettlerRoleRequest,
    _: bool = Depends(require_bot_or_user)
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


@router.get("/user-by-discord/{discord_id}")
async def get_user_by_discord(discord_id: str, _: bool = Depends(require_bot_admin)):
    """
    Look up an Atlas user profile by their Discord ID.
    Used by the /redeem bot command to find linked Kingshot accounts.
    """
    from api.supabase_client import get_user_by_discord_id
    
    user = get_user_by_discord_id(discord_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/transfer-groups")
async def get_transfer_groups():
    """
    Public endpoint — returns active transfer groups from Supabase.
    Used by the frontend (replaces static transferGroups.ts config) and the Discord bot.
    No auth required — groups are public information.
    """
    sb = get_supabase_admin()
    if not sb:
        return {"groups": [], "total": 0, "error": "Supabase not configured"}

    try:
        result = sb.table("transfer_groups").select(
            "id, min_kingdom, max_kingdom, label, event_number, is_active, updated_at"
        ).eq("is_active", True).order("min_kingdom").execute()

        groups = result.data or []
        updated_at = groups[0]["updated_at"] if groups else None

        return {
            "groups": groups,
            "total": len(groups),
            "updated_at": updated_at,
        }
    except Exception as e:
        logger.error("Error in /transfer-groups: %s", e)
        return {"groups": [], "total": 0, "error": str(e)}


@router.get("/transfer-groups/with-counts")
async def get_transfer_groups_with_counts(_: bool = Depends(require_bot_admin)):
    """
    Admin endpoint: get all transfer groups (active + inactive) with user counts per group.
    Counts how many linked users fall into each kingdom range.
    """
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    try:
        # Get ALL groups (not just active) for admin view
        result = sb.table("transfer_groups").select("*").order("min_kingdom").execute()
        groups = result.data or []

        # Count linked users per group
        profiles = sb.table("profiles").select(
            "linked_kingdom"
        ).not_.is_("linked_kingdom", "null").not_.is_("discord_id", "null").execute()
        kingdoms = [p["linked_kingdom"] for p in (profiles.data or []) if p.get("linked_kingdom")]

        for g in groups:
            g["user_count"] = sum(1 for k in kingdoms if g["min_kingdom"] <= k <= g["max_kingdom"])

        return {"groups": groups, "total": len(groups)}
    except Exception as e:
        logger.error("Error in /transfer-groups/with-counts: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/transfer-groups/{group_id}")
async def update_transfer_group(
    group_id: int,
    data: Dict[str, Any],
    _: bool = Depends(require_bot_admin),
):
    """
    Admin endpoint: update a single transfer group (min_kingdom, max_kingdom, is_active, event_number).
    """
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    allowed_fields = {"min_kingdom", "max_kingdom", "is_active", "event_number"}
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        result = sb.table("transfer_groups").update(update_data).eq("id", group_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Group not found")
        return {"group": result.data[0], "ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating transfer group %d: %s", group_id, e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transfer-groups/new-event")
async def create_new_transfer_event(
    data: Dict[str, Any],
    _: bool = Depends(require_bot_admin),
):
    """
    Admin endpoint: create a new transfer event.
    Deactivates all current groups and creates new ones from the provided ranges.
    Expects: { event_number: int, groups: [{ min_kingdom: int, max_kingdom: int }] }
    """
    sb = get_supabase_admin()
    if not sb:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    event_number = data.get("event_number")
    new_groups = data.get("groups", [])

    if not event_number or not new_groups:
        raise HTTPException(status_code=400, detail="event_number and groups[] are required")

    # Validate ranges
    for g in new_groups:
        if not g.get("min_kingdom") or not g.get("max_kingdom"):
            raise HTTPException(status_code=400, detail="Each group needs min_kingdom and max_kingdom")
        if g["min_kingdom"] > g["max_kingdom"]:
            raise HTTPException(status_code=400, detail=f"min_kingdom ({g['min_kingdom']}) > max_kingdom ({g['max_kingdom']})")

    now = datetime.now(timezone.utc).isoformat()

    try:
        # Deactivate all existing active groups
        sb.table("transfer_groups").update({
            "is_active": False, "updated_at": now
        }).eq("is_active", True).execute()

        # Insert new groups
        rows = [{
            "min_kingdom": g["min_kingdom"],
            "max_kingdom": g["max_kingdom"],
            "event_number": event_number,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        } for g in new_groups]

        result = sb.table("transfer_groups").insert(rows).execute()
        created = result.data or []

        logger.info("Created %d new transfer groups for event #%d", len(created), event_number)
        return {"groups": created, "total": len(created), "event_number": event_number, "ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating new transfer event: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/linked-users")
async def get_linked_users(_: bool = Depends(require_bot_admin)):
    """
    Get all users who have both a linked Kingshot account AND a Discord account.
    Returns all_kingdoms per user (primary + alt accounts) so the bot can assign
    the correct transfer group role(s) for multi-account users.
    """
    sb = get_supabase_admin()
    if not sb:
        return {"users": [], "total": 0, "error": "Supabase not configured"}

    try:
        # Fetch all profiles with both discord_id and linked_player_id
        result = sb.table("profiles").select(
            "id, discord_id, linked_player_id, linked_username, username, referral_tier, linked_kingdom"
        ).not_.is_("linked_player_id", "null").not_.is_("discord_id", "null").limit(10000).execute()

        profiles = result.data or []

        # Fetch alt accounts from player_accounts table
        # NOTE: We fetch ALL rows with kingdom and filter in Python to avoid
        # exceeding PostgREST URL length limit with a massive .in_() clause
        # (711+ UUIDs in the URL causes 'JSON could not be generated' 400 error).
        user_id_set = set(p["id"] for p in profiles)
        alt_map: dict = {}
        try:
            alts_result = sb.table("player_accounts").select(
                "user_id, kingdom"
            ).not_.is_("kingdom", "null").limit(10000).execute()
            for alt in (alts_result.data or []):
                uid = alt["user_id"]
                if uid in user_id_set and alt.get("kingdom"):
                    if uid not in alt_map:
                        alt_map[uid] = []
                    alt_map[uid].append(alt["kingdom"])
        except Exception as alt_err:
            logger.warning("Failed to fetch alt accounts, continuing without: %s", alt_err)

        users = []
        for p in profiles:
            kingdoms = []
            if p.get("linked_kingdom"):
                kingdoms.append(p["linked_kingdom"])
            for k in alt_map.get(p["id"], []):
                if k not in kingdoms:
                    kingdoms.append(k)
            users.append({
                "user_id": p["id"],
                "discord_id": p["discord_id"],
                "linked_player_id": p.get("linked_player_id"),
                "username": p.get("linked_username") or p.get("username"),
                "referral_tier": p.get("referral_tier"),
                "linked_kingdom": p.get("linked_kingdom"),
                "all_kingdoms": kingdoms,
            })

        logger.info("Found %d linked users (with alt kingdoms)", len(users))
        return {"users": users, "total": len(users)}

    except Exception as e:
        logger.error("Error in /linked-users: %s", e)
        return {"users": [], "total": 0, "error": str(e)}


@router.get("/supporter-users")
async def get_supporter_users(_: bool = Depends(require_bot_admin)):
    """
    Get all users who have an active supporter subscription AND a Discord account.
    Used by the Discord bot for periodic Supporter role sync.
    """
    from api.supabase_client import get_supporter_users_with_discord
    
    users = get_supporter_users_with_discord()
    
    return {
        "users": users,
        "total": len(users)
    }


@router.get("/gilded-users")
async def get_gilded_users(_: bool = Depends(require_bot_admin)):
    """
    Get all users who belong to a Gold-tier Kingdom Fund kingdom AND have a Discord account.
    Used by the Discord bot for periodic Gilded role sync.
    """
    sb = get_supabase_admin()
    if not sb:
        return {"users": [], "total": 0, "error": "Supabase not configured"}

    try:
        # Step 1: Get all Gold-tier kingdom numbers
        funds_resp = sb.table("kingdom_funds").select("kingdom_number").eq("tier", "gold").execute()
        gold_kingdoms = [f["kingdom_number"] for f in (funds_resp.data or [])]

        if not gold_kingdoms:
            return {"users": [], "total": 0}

        # Step 2: Get all users linked to those kingdoms who have Discord
        profiles_resp = sb.table("profiles").select(
            "id, discord_id, linked_username, linked_kingdom"
        ).in_("linked_kingdom", gold_kingdoms).not_.is_("discord_id", "null").not_.is_("linked_username", "null").execute()

        users = [
            {
                "user_id": p["id"],
                "discord_id": p["discord_id"],
                "username": p.get("linked_username"),
                "kingdom": p.get("linked_kingdom"),
            }
            for p in (profiles_resp.data or [])
            if p.get("discord_id")
        ]

        return {"users": users, "total": len(users)}
    except Exception as e:
        logger.error("Error in /gilded-users: %s", e)
        return {"users": [], "total": 0, "error": str(e)}


@router.post("/backfill-settler-roles")
async def backfill_settler_roles(_: bool = Depends(require_bot_admin)):
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
            logger.error("Error in /backfill-settler-roles for user %s: %s", user_id, e)
            results["failed"] += 1
            results["details"].append({
                "user_id": user_id,
                "username": username,
                "status": "failed",
                "error": "Discord API call failed",
            })
    
    results["success"] = results["failed"] == 0
    results["message"] = f"Backfill complete: {results['assigned']} assigned, {results['skipped']} skipped, {results['failed']} failed"
    
    logger.info("Settler role backfill: %s", results['message'])
    
    return results


@router.post("/backfill-supporter-roles")
async def backfill_supporter_roles(_: bool = Depends(require_bot_admin)):
    """
    Backfill Supporter Discord role for all users who have:
    - An active supporter subscription (subscription_tier = 'supporter')
    - A linked Discord account (discord_id)
    
    Admin-only endpoint for manual Supporter role sync.
    """
    from api.supabase_client import get_supporter_users_with_discord
    from api.discord_role_sync import sync_subscription_role
    
    users = get_supporter_users_with_discord()
    
    if not users:
        return {
            "success": True,
            "message": "No eligible supporter users found",
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
            result = await sync_subscription_role(discord_id, "supporter")
            
            if result.get("success"):
                results["assigned"] += 1
                results["details"].append({
                    "user_id": user_id,
                    "username": username,
                    "status": "assigned",
                })
            else:
                results["skipped"] += 1
                results["details"].append({
                    "user_id": user_id,
                    "username": username,
                    "status": "skipped",
                    "reason": result.get("error", "Unknown"),
                })
        except Exception as e:
            logger.error("Error in /backfill-supporter-roles for user %s: %s", user_id, e)
            results["failed"] += 1
            results["details"].append({
                "user_id": user_id,
                "username": username,
                "status": "failed",
                "error": "Discord API call failed",
            })
    
    results["success"] = results["failed"] == 0
    results["message"] = f"Supporter backfill: {results['assigned']} assigned, {results['skipped']} skipped, {results['failed']} failed"
    
    logger.info("Supporter role backfill: %s", results['message'])
    
    return results


@router.post("/backfill-gilded-roles")
async def backfill_gilded_roles(_: bool = Depends(require_bot_admin)):
    """
    Backfill Gilded Discord role for all users who belong to Gold-tier Kingdom Fund kingdoms
    and have a linked Discord account. Admin-only endpoint for manual Gilded role sync.
    """
    from api.discord_role_sync import add_role_to_member, DISCORD_GILDED_ROLE_ID

    if not DISCORD_GILDED_ROLE_ID:
        return {"success": False, "message": "DISCORD_GILDED_ROLE_ID not configured", "total": 0, "assigned": 0, "skipped": 0, "failed": 0}

    sb = get_supabase_admin()
    if not sb:
        return {"success": False, "message": "Supabase not configured", "total": 0, "assigned": 0, "skipped": 0, "failed": 0}

    try:
        # Get gold kingdom numbers
        funds_resp = sb.table("kingdom_funds").select("kingdom_number").eq("tier", "gold").execute()
        gold_kingdoms = [f["kingdom_number"] for f in (funds_resp.data or [])]

        if not gold_kingdoms:
            return {"success": True, "message": "No gold-tier kingdoms found", "total": 0, "assigned": 0, "skipped": 0, "failed": 0}

        # Get users linked to gold kingdoms with Discord
        profiles_resp = sb.table("profiles").select(
            "id, discord_id, linked_username, linked_kingdom"
        ).in_("linked_kingdom", gold_kingdoms).not_.is_("discord_id", "null").not_.is_("linked_username", "null").execute()

        users = [p for p in (profiles_resp.data or []) if p.get("discord_id")]

        if not users:
            return {"success": True, "message": "No eligible gilded users found", "total": 0, "assigned": 0, "skipped": 0, "failed": 0}

        results = {"total": len(users), "assigned": 0, "skipped": 0, "failed": 0, "details": [], "gold_kingdoms": gold_kingdoms}

        for user in users:
            discord_id = user["discord_id"]
            username = user.get("linked_username") or "Unknown"
            kingdom = user.get("linked_kingdom")

            try:
                success = await add_role_to_member(discord_id, DISCORD_GILDED_ROLE_ID)
                if success:
                    results["assigned"] += 1
                    results["details"].append({"username": username, "kingdom": kingdom, "status": "assigned"})
                else:
                    results["skipped"] += 1
                    results["details"].append({"username": username, "kingdom": kingdom, "status": "skipped"})
            except Exception as e:
                results["failed"] += 1
                results["details"].append({"username": username, "kingdom": kingdom, "status": "failed", "error": str(e)})

        results["success"] = results["failed"] == 0
        results["message"] = f"Gilded backfill: {results['assigned']} assigned, {results['skipped']} skipped, {results['failed']} failed"
        logger.info("Gilded role backfill: %s", results['message'])
        return results

    except Exception as e:
        logger.error("Error in /backfill-gilded-roles: %s", e)
        return {"success": False, "message": str(e), "total": 0, "assigned": 0, "skipped": 0, "failed": 0}


@router.post("/leave-server/{server_id}")
async def leave_server(server_id: str, _: bool = Depends(require_bot_admin)):
    """
    Make the bot leave a specific server.
    """
    if not DISCORD_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Discord bot token not configured")
    
    try:
        response = await discord_fetch("DELETE", f"/api/v10/users/@me/guilds/{server_id}")
        
        if response.status_code not in (200, 204):
            raise HTTPException(
                status_code=response.status_code,
                detail=_sanitize_discord_error(response.status_code, response.text)
            )
        
        # Invalidate server cache since guild list changed
        _cache.invalidate("servers_list")
        return {"success": True, "message": f"Left server {server_id}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in /leave-server: %s", e)
        raise HTTPException(status_code=500, detail="Failed to leave server")


@router.get("/discord-diagnostic")
async def discord_diagnostic(_: bool = Depends(require_bot_admin)):
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
            "proxy_configured": bool(DISCORD_API_PROXY),
            "proxy_url": DISCORD_API_PROXY[:30] + "..." if DISCORD_API_PROXY else None,
            "discord_api_base": DISCORD_API_BASE[:50],
        },
        "tests": {},
    }
    
    if not DISCORD_BOT_TOKEN:
        results["tests"]["token"] = {"status": "FAIL", "error": "DISCORD_BOT_TOKEN not set"}
        return results
    
    try:
        # Test 1: Verify bot token by getting bot user
        bot_response = await discord_fetch("GET", "/api/v10/users/@me", max_retries=1, timeout=10.0)
        
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
                "error": _sanitize_discord_error(bot_response.status_code, bot_response.text)
            }
            return results
        
        # Test 2: Check if bot is in the target guild
        if DISCORD_GUILD_ID:
            guild_response = await discord_fetch("GET", f"/api/v10/guilds/{DISCORD_GUILD_ID}", max_retries=1)
            
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
                member_response = await discord_fetch("GET", f"/api/v10/guilds/{DISCORD_GUILD_ID}/members/{bot_id}", max_retries=1)
                
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
            roles_response = await discord_fetch("GET", f"/api/v10/guilds/{DISCORD_GUILD_ID}/roles", max_retries=1)
            
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
        logger.error("Error in /discord-diagnostic: %s", e)
        results["tests"]["connection"] = {
            "status": "FAIL",
            "error": "Discord API connection failed"
        }
    
    # Overall status
    all_pass = all(
        t.get("status") == "PASS" 
        for t in results["tests"].values()
    )
    results["overall"] = "HEALTHY" if all_pass else "ISSUES_DETECTED"
    
    return results


# ---------------------------------------------------------------------------
# Multirally Premium Credit System
# Free users: 3 uses/day. Supporters: unlimited.
# ---------------------------------------------------------------------------

MULTIRALLY_DAILY_LIMIT = 3


class MultirallyCheckRequest(BaseModel):
    """Request model for checking multirally credits"""
    discord_user_id: str = Field(..., description="Discord user ID")
    is_supporter: bool = Field(False, description="Whether the user has the Supporter role")


class MultirallyIncrementRequest(BaseModel):
    """Request model for incrementing multirally usage"""
    discord_user_id: str = Field(..., description="Discord user ID")
    is_supporter: bool = Field(False, description="Whether the user has the Supporter role")


@router.post("/multirally-credits/check")
async def check_multirally_credits(
    data: MultirallyCheckRequest,
    _: bool = Depends(require_bot_or_user)
):
    """
    Check if a Discord user has remaining /multirally credits for today.
    Supporters always have unlimited. Free users get 3/day.
    """
    if data.is_supporter:
        return {"allowed": True, "remaining": -1, "is_supporter": True}

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    client = get_supabase_admin()
    if not client:
        # Fallback: allow if DB unavailable (don't block users)
        return {"allowed": True, "remaining": MULTIRALLY_DAILY_LIMIT, "is_supporter": False}

    try:
        result = client.table("multirally_usage").select("usage_count").eq(
            "discord_user_id", data.discord_user_id
        ).eq("usage_date", today).execute()

        current_count = 0
        if result.data and len(result.data) > 0:
            current_count = result.data[0].get("usage_count", 0)

        remaining = max(0, MULTIRALLY_DAILY_LIMIT - current_count)
        return {
            "allowed": current_count < MULTIRALLY_DAILY_LIMIT,
            "remaining": remaining,
            "is_supporter": False,
        }
    except Exception as e:
        logger.warning("Failed to check multirally credits: %s", e)
        return {"allowed": True, "remaining": MULTIRALLY_DAILY_LIMIT, "is_supporter": False}


@router.post("/multirally-credits/increment")
async def increment_multirally_credits(
    data: MultirallyIncrementRequest,
    _: bool = Depends(require_bot_or_user)
):
    """
    Increment /multirally usage for a Discord user today.
    Upserts into multirally_usage table.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    client = get_supabase_admin()
    if not client:
        return {"success": False, "error": "Database unavailable"}

    try:
        # Check if row exists for today
        result = client.table("multirally_usage").select("id,usage_count").eq(
            "discord_user_id", data.discord_user_id
        ).eq("usage_date", today).execute()

        if result.data and len(result.data) > 0:
            # Update existing row
            row = result.data[0]
            new_count = row["usage_count"] + 1
            client.table("multirally_usage").update({
                "usage_count": new_count,
                "is_supporter": data.is_supporter,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", row["id"]).execute()
        else:
            # Insert new row
            new_count = 1
            client.table("multirally_usage").insert({
                "discord_user_id": data.discord_user_id,
                "usage_date": today,
                "usage_count": 1,
                "is_supporter": data.is_supporter,
            }).execute()

        remaining = max(0, MULTIRALLY_DAILY_LIMIT - new_count) if not data.is_supporter else -1
        return {"success": True, "usage_count": new_count, "remaining": remaining}
    except Exception as e:
        logger.warning("Failed to increment multirally credits: %s", e)
        return {"success": False, "error": str(e)}


@router.get("/telemetry")
async def get_bot_telemetry(
    limit: int = 50,
    severity: Optional[str] = None,
    event_type: Optional[str] = None,
    hours: int = 168,
    _: bool = Depends(require_bot_admin),
):
    """
    Get bot telemetry events from Supabase.
    Returns recent lifecycle events with optional filtering.
    
    Query params:
      - limit: max rows (default 50, max 200)
      - severity: filter by severity (info, warn, error, critical)
      - event_type: filter by event type
      - hours: lookback window in hours (default 168 = 7 days)
    """
    sb = get_supabase_admin()
    if not sb:
        return {"events": [], "summary": {}, "error": "Supabase not configured"}

    limit = min(limit, 200)
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    try:
        query = sb.table("bot_telemetry").select("*").gte("created_at", since).order("created_at", desc=True).limit(limit)
        if severity:
            query = query.eq("severity", severity)
        if event_type:
            query = query.eq("event_type", event_type)
        result = query.execute()
        events = result.data or []

        # Build summary from full 7-day window (unfiltered)
        summary_query = sb.table("bot_telemetry").select("event_type,severity,created_at").gte("created_at", since).order("created_at", desc=True).limit(1000)
        summary_result = summary_query.execute()
        all_events = summary_result.data or []

        now = datetime.now(timezone.utc)
        day_ago = (now - timedelta(hours=24)).isoformat()

        crashes_24h = sum(1 for e in all_events if e.get("severity") in ("error", "critical") and e.get("created_at", "") >= day_ago)
        memory_warnings = sum(1 for e in all_events if e.get("event_type") == "memory_warning")
        disconnects = sum(1 for e in all_events if e.get("event_type") == "disconnect")
        restarts = sum(1 for e in all_events if e.get("event_type") == "startup")

        # Uptime segments: each startup→shutdown/crash pair
        startups = [e for e in reversed(all_events) if e.get("event_type") == "startup"]
        shutdowns = [e for e in reversed(all_events) if e.get("event_type") in ("shutdown", "crash")]

        # Severity breakdown
        severity_counts = {}
        for e in all_events:
            s = e.get("severity", "info")
            severity_counts[s] = severity_counts.get(s, 0) + 1

        summary = {
            "total_events": len(all_events),
            "crashes_24h": crashes_24h,
            "memory_warnings": memory_warnings,
            "disconnects": disconnects,
            "restarts": restarts,
            "severity_counts": severity_counts,
            "period_hours": hours,
        }

        return {"events": events, "summary": summary}
    except Exception as e:
        logger.error("Error in /telemetry: %s", e)
        return {"events": [], "summary": {}, "error": str(e)}


@router.get("/multirally-stats")
async def get_multirally_stats(
    _: bool = Depends(require_bot_or_user)
):
    """
    Get /multirally premium usage stats for the analytics dashboard.
    Returns total uses, unique users, supporter vs free breakdown, and upsell count.
    """
    client = get_supabase_admin()
    if not client:
        return {"error": "Database unavailable"}

    try:
        now = datetime.now(timezone.utc)
        today = now.strftime("%Y-%m-%d")
        week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        month_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")

        # All-time stats
        all_rows = client.table("multirally_usage").select(
            "discord_user_id,usage_count,is_supporter,usage_date"
        ).execute()
        rows = all_rows.data or []

        total_uses = sum(r.get("usage_count", 0) for r in rows)
        unique_users = len(set(r.get("discord_user_id") for r in rows))
        supporter_uses = sum(r.get("usage_count", 0) for r in rows if r.get("is_supporter"))
        free_uses = total_uses - supporter_uses

        # Today
        today_rows = [r for r in rows if r.get("usage_date") == today]
        today_uses = sum(r.get("usage_count", 0) for r in today_rows)
        today_users = len(set(r.get("discord_user_id") for r in today_rows))

        # Last 7 days
        week_rows = [r for r in rows if r.get("usage_date", "") >= week_ago]
        week_uses = sum(r.get("usage_count", 0) for r in week_rows)
        week_users = len(set(r.get("discord_user_id") for r in week_rows))

        # Last 30 days
        month_rows = [r for r in rows if r.get("usage_date", "") >= month_ago]
        month_uses = sum(r.get("usage_count", 0) for r in month_rows)
        month_users = len(set(r.get("discord_user_id") for r in month_rows))

        # Upsell impressions (from bot_command_usage where command_name = 'multirally_upsell')
        upsell_resp = client.table("bot_command_usage").select("id", count="exact").eq(
            "command_name", "multirally_upsell"
        ).execute()
        upsell_count = upsell_resp.count or 0

        return {
            "total_uses": total_uses,
            "unique_users": unique_users,
            "supporter_uses": supporter_uses,
            "free_uses": free_uses,
            "upsell_impressions": upsell_count,
            "today": {"uses": today_uses, "users": today_users},
            "week": {"uses": week_uses, "users": week_users},
            "month": {"uses": month_uses, "users": month_users},
        }
    except Exception as e:
        logger.error("Error in /multirally-stats: %s", e)
        return {"error": str(e)}
