"""
Admin webhook monitoring and audit log endpoints.

Webhook events, health stats, and audit log viewing.
"""
import logging
from fastapi import APIRouter, HTTPException, Header
from typing import Optional

from api.supabase_client import get_supabase_admin, get_webhook_events, get_webhook_stats
from ._shared import require_admin

logger = logging.getLogger("atlas.admin")

router = APIRouter()


@router.get("/webhooks/events")
async def get_webhook_events_list(
    limit: int = 50,
    event_type: Optional[str] = None,
    status: Optional[str] = None,
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """
    Get recent webhook events for monitoring.
    
    Args:
        limit: Max events to return (default 50)
        event_type: Filter by event type
        status: Filter by status (received, processed, failed)
    """
    require_admin(x_admin_key, authorization)
    events = get_webhook_events(limit=limit, event_type=event_type, status=status)
    return {"events": events, "count": len(events)}


@router.get("/audit-log")
async def get_audit_log(
    limit: int = 20,
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Get recent admin actions from the audit log."""
    require_admin(x_admin_key, authorization)
    client = get_supabase_admin()
    if not client:
        return {"entries": [], "error": "Database not configured"}
    try:
        result = client.table("admin_audit_log").select(
            "id, admin_email, action, resource_type, resource_id, details, created_at"
        ).order("created_at", desc=True).limit(limit).execute()
        return {"entries": result.data or []}
    except Exception as e:
        return {"entries": [], "error": str(e)}


@router.get("/webhooks/stats")
async def get_webhook_health_stats(x_admin_key: Optional[str] = Header(None), authorization: Optional[str] = Header(None)):
    """
    Get webhook health statistics for monitoring dashboard.
    
    Returns:
        - Total events in last 24 hours
        - Processed count
        - Failed count
        - Failure rate percentage
        - Health status (healthy/warning/critical)
    """
    require_admin(x_admin_key, authorization)
    stats = get_webhook_stats()
    return stats
