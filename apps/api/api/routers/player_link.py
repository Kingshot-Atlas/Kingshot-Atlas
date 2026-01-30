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
import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter()

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
    return hashlib.md5((param_string + KINGSHOT_API_SALT).encode()).hexdigest()


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
