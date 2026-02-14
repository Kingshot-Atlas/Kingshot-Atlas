"""
Admin KvK configuration management endpoints.

Get/set/increment current KvK number.
"""
import logging
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from datetime import datetime

from api.supabase_client import get_supabase_admin
from ._shared import require_admin, audit_log, DEFAULT_CURRENT_KVK

logger = logging.getLogger("atlas.admin")

router = APIRouter()


@router.get("/config/current-kvk")
async def get_current_kvk():
    """
    Get the current KvK number.
    
    This is a public endpoint (no admin auth required) since all users
    need to know the current KvK number for data submission.
    
    Returns the value from Supabase app_config table, or falls back to
    the DEFAULT_CURRENT_KVK constant if not configured.
    """
    client = get_supabase_admin()
    
    if not client:
        return {"current_kvk": DEFAULT_CURRENT_KVK, "source": "default"}
    
    try:
        # Try to get from app_config table
        result = client.table("app_config").select("value").eq("key", "current_kvk").single().execute()
        
        if result.data and result.data.get("value"):
            return {
                "current_kvk": int(result.data["value"]),
                "source": "database"
            }
        else:
            return {"current_kvk": DEFAULT_CURRENT_KVK, "source": "default"}
            
    except Exception as e:
        # Table might not exist yet, return default
        return {"current_kvk": DEFAULT_CURRENT_KVK, "source": "default", "note": str(e)}


@router.post("/config/current-kvk")
async def set_current_kvk(
    kvk_number: int,
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """
    Set the current KvK number (admin only).
    
    This updates the app_config table in Supabase. The table will be
    created automatically if it doesn't exist (upsert behavior).
    
    Args:
        kvk_number: The new current KvK number (must be > 0)
    
    Returns:
        Success status and the new KvK number
    """
    require_admin(x_admin_key, authorization)
    
    if kvk_number < 1:
        raise HTTPException(status_code=400, detail="KvK number must be positive")
    
    if kvk_number > 100:
        raise HTTPException(status_code=400, detail="KvK number seems too high - sanity check failed")
    
    client = get_supabase_admin()
    
    if not client:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        # Upsert the config value
        result = client.table("app_config").upsert({
            "key": "current_kvk",
            "value": str(kvk_number),
            "updated_at": datetime.now().isoformat()
        }, on_conflict="key").execute()
        
        audit_log("set_current_kvk", "config", "current_kvk", {"kvk_number": kvk_number})
        return {
            "success": True,
            "current_kvk": kvk_number,
            "message": f"Current KvK updated to #{kvk_number}"
        }
        
    except Exception as e:
        # If table doesn't exist, try to create it
        error_str = str(e)
        if "app_config" in error_str and ("does not exist" in error_str or "42P01" in error_str):
            raise HTTPException(
                status_code=500, 
                detail="app_config table not found. Please create it in Supabase with columns: key (text, primary), value (text), updated_at (timestamptz)"
            )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config/increment-kvk")
async def increment_current_kvk(x_admin_key: Optional[str] = Header(None), authorization: Optional[str] = Header(None)):
    """
    Increment the current KvK number by 1 (admin only).
    
    Convenience endpoint for after a KvK battle phase ends.
    Gets the current value and increments it.
    
    Returns:
        The old and new KvK numbers
    """
    require_admin(x_admin_key, authorization)
    
    # Get current value
    current_result = await get_current_kvk()
    current_kvk = current_result.get("current_kvk", DEFAULT_CURRENT_KVK)
    
    # Increment
    new_kvk = current_kvk + 1
    
    # Set new value
    result = await set_current_kvk(new_kvk, x_admin_key, authorization)
    
    return {
        "success": True,
        "old_kvk": current_kvk,
        "new_kvk": new_kvk,
        "message": f"KvK incremented from #{current_kvk} to #{new_kvk}"
    }
