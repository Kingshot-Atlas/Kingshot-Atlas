"""
Player Link Router - Proxy for Century Games Gift Code API

This router provides a secure proxy to verify Kingshot player IDs
and retrieve basic profile information without exposing the API secret.

Endpoints:
- POST /api/player-link/verify - Verify a player ID and get profile data
- POST /api/player-link/refresh - Refresh linked player data (rate limited)
"""

import hashlib
import time
import os
import logging
import httpx
import asyncio
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from api.supabase_client import log_gift_code_redemption, get_gift_codes_from_db, get_deactivated_gift_codes, upsert_gift_codes, add_manual_gift_code, deactivate_gift_code, mark_gift_code_expired

logger = logging.getLogger("atlas.player_link")

router = APIRouter()

# Discord webhook for gift code notifications
DISCORD_GIFT_CODES_WEBHOOK = os.getenv("DISCORD_GIFT_CODES_WEBHOOK", "")
DISCORD_GIFT_CODES_ROLE_ID = os.getenv("DISCORD_GIFT_CODES_ROLE_ID", "1471516628125749319")


async def notify_discord_new_gift_code(code: str):
    """Fire-and-forget: send a Discord webhook embed for a new gift code."""
    webhook_url = DISCORD_GIFT_CODES_WEBHOOK
    if not webhook_url:
        logger.info("[gift-codes] DISCORD_GIFT_CODES_WEBHOOK not set — skipping notification")
        return
    try:
        role_mention = f"<@&{DISCORD_GIFT_CODES_ROLE_ID}>" if DISCORD_GIFT_CODES_ROLE_ID else ""
        embed = {
            "title": "\U0001f381 New Gift Code",
            "description": (
                f"## `{code}`\n\n"
                "\u26a1 Use `/redeem` right here in Discord\n"
                "\U0001f310 Or one-click redeem at **[ks-atlas.com/tools/gift-codes](https://ks-atlas.com/tools/gift-codes)**\n\n"
                "*Redeem before it expires!*"
            ),
            "color": 0xf59e0b,
            "footer": {"text": "Kingshot Atlas \u2022 ks-atlas.com"},
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        payload = {
            "content": role_mention,
            "embeds": [embed],
            "allowed_mentions": {"roles": [DISCORD_GIFT_CODES_ROLE_ID]} if DISCORD_GIFT_CODES_ROLE_ID else {},
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code in (200, 204):
                logger.info("[gift-codes] Discord notification sent for %s", code)
            else:
                logger.warning("[gift-codes] Discord webhook returned %s: %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.error("[gift-codes] Discord notification failed for %s: %s", code, e)

# Century Games API Configuration
# Salt is loaded from environment variable with fallback to known public value
# Note: This salt is public (used by the gift code website) - not a secret
KINGSHOT_API_BASE = "https://kingshot-giftcode.centurygame.com/api"
# IMPORTANT: Handle empty env var case - os.getenv returns "" if var is set but empty
# which bypasses the default. Always fall back to known working salt.
_DEFAULT_SALT = "mN4!pQs6JrYwV9"
_env_salt = os.getenv("KINGSHOT_API_SALT", "")
KINGSHOT_API_SALT = _env_salt.strip() if _env_salt.strip() else _DEFAULT_SALT

# Rate limiter for this router
limiter = Limiter(key_func=get_remote_address)


class PlayerVerifyRequest(BaseModel):
    """Request model for player verification"""
    player_id: str = Field(..., min_length=6, max_length=20, pattern=r"^\d+$")


class GiftCodeRedeemRequest(BaseModel):
    """Request model for gift code redemption"""
    player_id: str = Field(..., min_length=6, max_length=20, pattern=r"^\d+$")
    code: str = Field(..., min_length=3, max_length=50)


class GiftCodeRedeemResponse(BaseModel):
    """Response model for gift code redemption"""
    success: bool
    message: str
    code: str
    err_code: int | None = None


class PlayerProfileResponse(BaseModel):
    """Response model for player profile data"""
    player_id: str
    username: str
    avatar_url: str | None
    kingdom: int
    town_center_level: int
    verified: bool = True


class PlayerVerifyError(BaseModel):
    """Error response model"""
    error: str
    code: str


def generate_signature(params: dict) -> str:
    """
    Generate MD5 signature for Century Games API
    
    Args:
        params: Dictionary of parameters to sign
        
    Returns:
        MD5 hash string
        
    Raises:
        HTTPException: If API salt is not configured
    """
    # Use the module-level salt, which has a default fallback
    salt = KINGSHOT_API_SALT
    if not salt or salt.strip() == "":
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Player linking service not configured",
                "code": "SERVICE_UNAVAILABLE"
            }
        )
    sorted_keys = sorted(params.keys())
    param_string = "&".join(f"{k}={params[k]}" for k in sorted_keys)
    return hashlib.md5((param_string + KINGSHOT_API_SALT).encode(), usedforsecurity=False).hexdigest()


async def fetch_player_from_century_games(player_id: str) -> dict:
    """
    Fetch player data from Century Games API
    
    Args:
        player_id: The player's numeric ID
        
    Returns:
        Player data dictionary
        
    Raises:
        HTTPException: If API call fails or player not found
    """
    timestamp = str(int(time.time() * 1000))
    params = {"fid": player_id, "time": timestamp}
    params["sign"] = generate_signature({"fid": player_id, "time": timestamp})
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{KINGSHOT_API_BASE}/player",
                data=params,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                }
            )
            response.raise_for_status()
            data = response.json()
            
            if data.get("code") == 0 and data.get("data"):
                return data["data"]
            elif data.get("msg") == "success" and data.get("data"):
                return data["data"]
            else:
                raise HTTPException(
                    status_code=404,
                    detail={
                        "error": "Player not found",
                        "code": "PLAYER_NOT_FOUND"
                    }
                )
                
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail={
                    "error": "Century Games API timeout",
                    "code": "UPSTREAM_TIMEOUT"
                }
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "error": "Rate limited by Century Games. Try again in 30 seconds.",
                        "code": "RATE_LIMITED"
                    }
                )
            raise HTTPException(
                status_code=502,
                detail={
                    "error": "Century Games API error",
                    "code": "UPSTREAM_ERROR"
                }
            )


@router.post(
    "/verify",
    response_model=PlayerProfileResponse,
    responses={
        404: {"model": PlayerVerifyError, "description": "Player not found"},
        429: {"model": PlayerVerifyError, "description": "Rate limited"},
        502: {"model": PlayerVerifyError, "description": "Upstream API error"},
    },
    summary="Verify Kingshot Player ID",
    description="Verify a Kingshot player ID and retrieve basic profile information including username, avatar, kingdom, and town center level."
)
@limiter.limit("10/minute")
async def verify_player(request: Request, body: PlayerVerifyRequest):
    """
    Verify a player ID against Century Games API
    
    This endpoint acts as a secure proxy, hiding the API secret from clients.
    Rate limited to 10 requests per minute per IP.
    """
    player_data = await fetch_player_from_century_games(body.player_id)
    
    return PlayerProfileResponse(
        player_id=str(player_data.get("fid", body.player_id)),
        username=player_data.get("nickname", "Unknown"),
        avatar_url=player_data.get("avatar_image"),
        kingdom=int(player_data.get("kid", 0)),
        town_center_level=int(player_data.get("stove_lv", 0)),
        verified=True
    )


@router.post(
    "/refresh",
    response_model=PlayerProfileResponse,
    responses={
        404: {"model": PlayerVerifyError, "description": "Player not found"},
        429: {"model": PlayerVerifyError, "description": "Rate limited"},
    },
    summary="Refresh Linked Player Data",
    description="Refresh the profile data for a previously linked player. More strictly rate limited than verify."
)
@limiter.limit("5/hour")
async def refresh_player(request: Request, body: PlayerVerifyRequest):
    """
    Refresh player data for an already-linked account
    
    This endpoint is more strictly rate limited (5/hour) to prevent abuse.
    Users should only need to refresh occasionally.
    """
    player_data = await fetch_player_from_century_games(body.player_id)
    
    return PlayerProfileResponse(
        player_id=str(player_data.get("fid", body.player_id)),
        username=player_data.get("nickname", "Unknown"),
        avatar_url=player_data.get("avatar_image"),
        kingdom=int(player_data.get("kid", 0)),
        town_center_level=int(player_data.get("stove_lv", 0)),
        verified=True
    )


# Gift code error code mapping
GIFT_CODE_MESSAGES = {
    20000: ("Success! Rewards sent to your in-game mailbox.", True),
    40005: ("This code has already been fully used.", False),
    40007: ("This code has expired.", False),
    40008: ("You've already redeemed this code.", False),
    40011: ("You've already redeemed this code.", False),
    40014: ("Invalid code — code not found.", False),
    40101: ("Too many attempts. Wait a moment and try again.", False),
    40103: ("Verification failed. Please try again.", False),
}


@router.post(
    "/redeem",
    response_model=GiftCodeRedeemResponse,
    summary="Redeem a Gift Code",
    description="Redeem a Kingshot gift code for a linked player account. Rate limited to prevent abuse."
)
@limiter.limit("30/minute")
async def redeem_gift_code(request: Request, body: GiftCodeRedeemRequest):
    """
    Proxy gift code redemption through Century Games API.
    
    Rate limited to 30 redemptions per minute per IP to support bulk
    operations across multiple alt accounts (up to 10 alts × N codes).
    This is a convenience proxy — the user's game client would do the same thing.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Step 1: "Login" the player — Century Games requires a /player
            # call in the same session before gift_code will work.
            # Without this, the API returns "NOT LOGIN".
            login_ts = str(int(time.time() * 1000))
            login_params = {"fid": body.player_id, "time": login_ts}
            login_params["sign"] = generate_signature({"fid": body.player_id, "time": login_ts})
            await client.post(
                f"{KINGSHOT_API_BASE}/player",
                data=login_params,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                }
            )

            # Step 2: Redeem the gift code (same session, cookies carry over)
            timestamp = str(int(time.time() * 1000))
            params = {"fid": body.player_id, "cdk": body.code, "time": timestamp}
            params["sign"] = generate_signature({"fid": body.player_id, "cdk": body.code, "time": timestamp})
            response = await client.post(
                f"{KINGSHOT_API_BASE}/gift_code",
                data=params,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                }
            )
            data = response.json()
            err_code = data.get("err_code", data.get("code", -1))
            
            # Map known error codes to messages
            if err_code in GIFT_CODE_MESSAGES:
                message, success = GIFT_CODE_MESSAGES[err_code]
            elif err_code == 0 or data.get("msg") == "success":
                message, success = GIFT_CODE_MESSAGES[20000]
            else:
                raw_msg = data.get("msg", "Unknown error occurred.")
                # Map common unmapped Century Games messages to friendly text
                msg_upper = raw_msg.upper().strip()
                if msg_upper in ("NOT LOGIN", "NOT_LOGIN", "NOTLOGIN"):
                    message = "Player not found or hasn't logged in recently. Please open the game first, then try again."
                elif "TIMEOUT" in msg_upper or "TIME OUT" in msg_upper:
                    message = "Century Games server timed out. Try again in a moment."
                else:
                    message = raw_msg
                success = False
            
            # Fire-and-forget analytics logging
            try:
                client_ip = get_remote_address(request)
                # Extract user_id from Authorization header if present
                auth_header = request.headers.get("authorization", "")
                req_user_id = request.headers.get("x-user-id") if auth_header.startswith("Bearer ") else None
                log_gift_code_redemption(
                    player_id=body.player_id,
                    code=body.code,
                    success=success,
                    error_code=err_code if not success else None,
                    message=message,
                    user_id=req_user_id,
                    ip_address=client_ip,
                )
            except Exception:
                pass  # Never block on analytics
            
            # Auto-deactivate expired codes in DB
            if err_code == 40007:
                try:
                    mark_gift_code_expired(body.code)
                except Exception:
                    pass

            return GiftCodeRedeemResponse(
                success=success,
                message=message,
                code=body.code,
                err_code=err_code if not success else None
            )
            
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail={"error": "Century Games API timeout", "code": "UPSTREAM_TIMEOUT"}
            )
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail={"error": "Rate limited by Century Games. Try again in 30 seconds.", "code": "RATE_LIMITED"}
                )
            raise HTTPException(
                status_code=502,
                detail={"error": "Century Games API error", "code": "UPSTREAM_ERROR"}
            )


@router.get(
    "/gift-codes",
    summary="Fetch Active Gift Codes",
    description="Fetch currently active Kingshot gift codes from public sources and database."
)
@limiter.limit("30/minute")
async def get_active_gift_codes(request: Request):
    """
    Fetch active gift codes by merging:
    1. Supabase gift_codes table (admin-added + previously synced)
    2. kingshot.net public API (auto-synced into DB)
    Returns deduplicated list.
    """
    seen_codes = set()
    blocked_codes = get_deactivated_gift_codes()  # codes marked inactive in DB
    merged = []
    source = "database"

    # 1. Fetch from Supabase gift_codes table first
    db_codes = get_gift_codes_from_db()
    for c in db_codes:
        code_str = c.get("code", "")
        if code_str and code_str not in seen_codes:
            seen_codes.add(code_str)
            merged.append({
                "code": code_str,
                "expire_date": c.get("expire_date"),
                "source": c.get("source", "database"),
                "is_expired": False,
            })

    # 2. Fetch from kingshot.net and auto-sync into DB
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://kingshot.net/api/gift-codes",
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict) and "data" in data and isinstance(data["data"], dict):
                raw_codes = data["data"].get("giftCodes", [])
            elif isinstance(data, list):
                raw_codes = data
            else:
                raw_codes = data.get("codes", data.get("giftCodes", []))

            # Normalize and merge
            normalized = []
            for c in raw_codes:
                code_str = c.get("code") or c.get("title") or ""
                if not code_str:
                    continue
                normalized.append({
                    "code": code_str,
                    "expire_date": c.get("expire_date") or c.get("expiresAt"),
                    "is_expired": c.get("is_expired", False),
                })
                if code_str not in seen_codes and code_str not in blocked_codes and not c.get("is_expired", False):
                    seen_codes.add(code_str)
                    merged.append({
                        "code": code_str,
                        "expire_date": c.get("expire_date") or c.get("expiresAt"),
                        "source": "kingshot.net",
                        "is_expired": False,
                    })

            # Fire-and-forget: sync fetched codes into Supabase
            try:
                upsert_gift_codes(normalized, source="kingshot.net")
            except Exception as e:
                logger.error("[gift-codes] upsert sync failed: %s", e)

            source = "merged"
    except Exception:
        # kingshot.net unavailable — still return DB codes
        if not merged:
            source = "unavailable"

    return {"codes": merged, "source": source}


class ManualGiftCodeRequest(BaseModel):
    """Request to add a manual gift code"""
    code: str = Field(..., min_length=3, max_length=50)
    expire_date: str | None = None


@router.post(
    "/gift-codes/add",
    summary="Add Manual Gift Code (Admin)",
    description="Admin endpoint to manually add a gift code to the database."
)
@limiter.limit("10/minute")
async def add_gift_code(request: Request, body: ManualGiftCodeRequest):
    """Add a gift code manually. Requires admin auth in production."""
    result = add_manual_gift_code(
        code=body.code,
        expire_date=body.expire_date,
    )
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    # Fire-and-forget: notify Discord about new code
    clean_code = body.code.strip().upper()
    asyncio.ensure_future(notify_discord_new_gift_code(clean_code))

    return {"success": True, "message": f"Code {clean_code} added."}


@router.post(
    "/gift-codes/deactivate",
    summary="Deactivate Gift Code (Admin)",
    description="Admin endpoint to deactivate a gift code."
)
@limiter.limit("10/minute")
async def deactivate_code(request: Request, code: str):
    """Deactivate a gift code."""
    success = deactivate_gift_code(code)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to deactivate code")
    return {"success": True, "message": f"Code {code} deactivated."}
