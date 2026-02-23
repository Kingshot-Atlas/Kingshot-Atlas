"""
Shared utilities for admin API endpoints.

Provides admin authentication, rate limiting, and audit logging.
"""
import os
import logging
import time
import contextvars
from fastapi import HTTPException, Request, Header
from typing import Optional, List, Dict, Any

from api.config import ADMIN_EMAILS
from api.supabase_client import get_supabase_admin

logger = logging.getLogger("atlas.admin")

# Admin API key for authentication
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")

# Default KvK number (fallback if not set in database)
DEFAULT_CURRENT_KVK = 10

# Per-request admin info using contextvars (thread/async-safe)
_current_admin_info_var: contextvars.ContextVar[Dict[str, Any]] = contextvars.ContextVar(
    "_current_admin_info_var", default={}
)


def _get_admin_info() -> Dict[str, Any]:
    return _current_admin_info_var.get()


def _set_admin_info(info: Dict[str, Any]) -> None:
    _current_admin_info_var.set(info)

# Simple in-memory rate limiter for admin endpoints
_rate_limit_store: Dict[str, List[float]] = {}
ADMIN_RATE_LIMIT = 60  # max requests per window
ADMIN_RATE_WINDOW = 60  # seconds


def check_rate_limit(client_ip: str = "unknown"):
    """Check rate limit for admin endpoints. Raises 429 if exceeded."""
    now = time.time()
    key = f"admin:{client_ip}"
    timestamps = _rate_limit_store.get(key, [])
    # Remove expired timestamps
    timestamps = [t for t in timestamps if now - t < ADMIN_RATE_WINDOW]
    if len(timestamps) >= ADMIN_RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")
    timestamps.append(now)
    _rate_limit_store[key] = timestamps


def audit_log(action: str, resource_type: str = None, resource_id: str = None, details: dict = None):
    """Log an admin action to the admin_audit_log table in Supabase."""
    try:
        client = get_supabase_admin()
        if not client:
            return
        entry = {
            "action": action,
            "admin_user_id": _get_admin_info().get("user_id"),
            "admin_email": _get_admin_info().get("email"),
            "resource_type": resource_type,
            "resource_id": str(resource_id) if resource_id else None,
            "details": details or {},
        }
        client.table("admin_audit_log").insert(entry).execute()
    except Exception as e:
        logger.warning(f"Failed to write audit log: {e}")


def verify_admin(api_key: Optional[str]) -> bool:
    """Verify admin API key. Requires key in production, warns in dev mode."""
    if not ADMIN_API_KEY:
        # Check if we're in production (Render sets this)
        if os.getenv("RENDER") or os.getenv("PRODUCTION"):
            logger.error("SECURITY: ADMIN_API_KEY not set in production! Denying access.")
            return False
        logger.warning("SECURITY: ADMIN_API_KEY not set - dev mode, allowing access")
        return True  # Dev mode only
    return api_key == ADMIN_API_KEY


def _verify_admin_jwt(authorization: Optional[str]) -> bool:
    """Verify admin access via Supabase JWT.
    Checks profiles.is_admin in database first, falls back to ADMIN_EMAILS env var."""
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
            user_id = user_response.user.id
            user_email = user_response.user.email
            # Primary check: database is_admin flag
            try:
                profile = client.table("profiles").select("is_admin").eq("id", user_id).single().execute()
                if profile.data and profile.data.get("is_admin") is True:
                    logger.info(f"Admin JWT auth via DB flag for {user_email}")
                    _set_admin_info({"user_id": user_id, "email": user_email})
                    return True
            except Exception as db_err:
                logger.warning(f"DB admin check failed, falling back to email list: {db_err}")
            # Fallback: hardcoded email list (bootstrap / DB unavailable)
            if user_email and user_email.lower() in [e.lower() for e in ADMIN_EMAILS]:
                logger.info(f"Admin JWT auth via email list for {user_email}")
                _set_admin_info({"user_id": user_id, "email": user_email})
                return True
            logger.warning(f"JWT valid but user {user_email} is not admin")
    except Exception as e:
        logger.warning(f"Admin JWT verification failed: {e}")
    return False


def require_admin(
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    request: Request = None
):
    """FastAPI dependency to enforce admin authentication on endpoints.
    Accepts either X-Admin-Key header OR Authorization Bearer JWT from an admin user."""
    # Rate limit check
    client_ip = "unknown"
    if request:
        client_ip = request.client.host if request.client else "unknown"
    check_rate_limit(client_ip)
    
    if verify_admin(x_admin_key):
        return
    if _verify_admin_jwt(authorization):
        return
    raise HTTPException(
        status_code=401,
        detail="Admin authentication required. Use X-Admin-Key or Authorization header."
    )
