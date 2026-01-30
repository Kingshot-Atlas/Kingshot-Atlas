"""
Supabase admin client for server-side operations.

This client uses the service role key to bypass Row Level Security,
enabling admin operations like updating user subscription tiers.
"""
import os
from typing import Optional

# Try to import supabase, gracefully handle if not installed
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

_supabase_client: Optional[Client] = None


def get_supabase_admin() -> Optional[Client]:
    """
    Get the Supabase admin client (singleton pattern).
    
    Returns None if Supabase is not configured.
    """
    global _supabase_client
    
    if not SUPABASE_AVAILABLE:
        return None
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    
    if _supabase_client is None:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    return _supabase_client


def update_user_subscription(
    user_id: str,
    tier: str,
    stripe_customer_id: Optional[str] = None,
    stripe_subscription_id: Optional[str] = None,
) -> bool:
    """
    Update a user's subscription tier in Supabase.
    
    Args:
        user_id: Supabase user ID
        tier: Subscription tier ('free', 'pro', 'recruiter')
        stripe_customer_id: Stripe customer ID
        stripe_subscription_id: Stripe subscription ID
        
    Returns:
        True if successful, False otherwise
    """
    client = get_supabase_admin()
    if not client:
        print(f"WARNING: Supabase not configured, cannot update subscription for {user_id}")
        return False
    
    try:
        update_data = {"subscription_tier": tier}
        
        if stripe_customer_id:
            update_data["stripe_customer_id"] = stripe_customer_id
        if stripe_subscription_id:
            update_data["stripe_subscription_id"] = stripe_subscription_id
        
        result = client.table("profiles").update(update_data).eq("id", user_id).execute()
        
        if result.data:
            print(f"Updated subscription for user {user_id}: tier={tier}")
            return True
        else:
            print(f"No profile found for user {user_id}")
            return False
            
    except Exception as e:
        print(f"Error updating subscription for {user_id}: {e}")
        return False


def get_user_profile(user_id: str) -> Optional[dict]:
    """
    Get a user's profile from Supabase.
    
    Args:
        user_id: Supabase user ID
        
    Returns:
        User profile dict or None
    """
    client = get_supabase_admin()
    if not client:
        return None
    
    try:
        result = client.table("profiles").select("*").eq("id", user_id).single().execute()
        return result.data
    except Exception as e:
        print(f"Error fetching profile for {user_id}: {e}")
        return None


def get_user_by_stripe_customer(customer_id: str) -> Optional[dict]:
    """
    Find a user by their Stripe customer ID.
    
    Args:
        customer_id: Stripe customer ID
        
    Returns:
        User profile dict or None
    """
    client = get_supabase_admin()
    if not client:
        return None
    
    try:
        result = client.table("profiles").select("*").eq("stripe_customer_id", customer_id).single().execute()
        return result.data
    except Exception as e:
        print(f"Error fetching user by Stripe customer {customer_id}: {e}")
        return None


def log_webhook_event(
    event_id: str,
    event_type: str,
    status: str = "received",
    payload: Optional[dict] = None,
    error_message: Optional[str] = None,
    processing_time_ms: Optional[int] = None,
    user_id: Optional[str] = None,
    customer_id: Optional[str] = None,
) -> bool:
    """
    Log a Stripe webhook event to the database.
    
    Args:
        event_id: Stripe event ID (evt_xxx)
        event_type: Event type (e.g., checkout.session.completed)
        status: Processing status (received, processed, failed)
        payload: Full event payload
        error_message: Error message if failed
        processing_time_ms: Processing duration
        user_id: Associated Supabase user ID
        customer_id: Stripe customer ID
        
    Returns:
        True if logged successfully
    """
    client = get_supabase_admin()
    if not client:
        print(f"WARNING: Supabase not configured, cannot log webhook {event_id}")
        return False
    
    try:
        data = {
            "event_id": event_id,
            "event_type": event_type,
            "status": status,
        }
        
        if payload:
            data["payload"] = payload
        if error_message:
            data["error_message"] = error_message
        if processing_time_ms is not None:
            data["processing_time_ms"] = processing_time_ms
        if user_id:
            data["user_id"] = user_id
        if customer_id:
            data["customer_id"] = customer_id
        if status == "processed":
            from datetime import datetime
            data["processed_at"] = datetime.utcnow().isoformat()
        
        result = client.table("webhook_events").upsert(data, on_conflict="event_id").execute()
        return bool(result.data)
        
    except Exception as e:
        print(f"Error logging webhook event {event_id}: {e}")
        return False


def get_webhook_events(
    limit: int = 50,
    event_type: Optional[str] = None,
    status: Optional[str] = None,
) -> list:
    """
    Get recent webhook events for admin dashboard.
    
    Args:
        limit: Max events to return
        event_type: Filter by event type
        status: Filter by status
        
    Returns:
        List of webhook events
    """
    client = get_supabase_admin()
    if not client:
        return []
    
    try:
        query = client.table("webhook_events").select("*").order("created_at", desc=True).limit(limit)
        
        if event_type:
            query = query.eq("event_type", event_type)
        if status:
            query = query.eq("status", status)
        
        result = query.execute()
        return result.data or []
        
    except Exception as e:
        print(f"Error fetching webhook events: {e}")
        return []


def get_webhook_stats() -> dict:
    """
    Get webhook health statistics for monitoring.
    
    Returns:
        Dict with counts by status and recent failure rate
    """
    client = get_supabase_admin()
    if not client:
        return {"total": 0, "processed": 0, "failed": 0, "failure_rate": 0}
    
    try:
        # Get all events from last 24 hours
        from datetime import datetime, timedelta
        since = (datetime.utcnow() - timedelta(hours=24)).isoformat()
        
        result = client.table("webhook_events").select("status").gte("created_at", since).execute()
        events = result.data or []
        
        total = len(events)
        processed = sum(1 for e in events if e.get("status") == "processed")
        failed = sum(1 for e in events if e.get("status") == "failed")
        
        return {
            "total_24h": total,
            "processed": processed,
            "failed": failed,
            "failure_rate": round((failed / max(total, 1)) * 100, 1),
            "health": "healthy" if failed == 0 else ("warning" if failed < 3 else "critical")
        }
        
    except Exception as e:
        print(f"Error fetching webhook stats: {e}")
        return {"total_24h": 0, "processed": 0, "failed": 0, "failure_rate": 0, "health": "unknown"}
