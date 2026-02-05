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
            from datetime import datetime, timezone
            data["processed_at"] = datetime.now(timezone.utc).isoformat()
        
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


def recalculate_kingdom_in_supabase(kingdom_number: int) -> bool:
    """
    Trigger recalculation of kingdom stats in Supabase.
    
    This calls the recalculate_kingdom_stats() function that updates
    the kingdoms table based on kvk_history data.
    
    Args:
        kingdom_number: The kingdom to recalculate stats for
        
    Returns:
        True if successful, False otherwise
    """
    client = get_supabase_admin()
    if not client:
        print(f"WARNING: Supabase not configured, cannot recalculate kingdom {kingdom_number}")
        return False
    
    try:
        # Call the RPC function to recalculate kingdom stats
        result = client.rpc('recalculate_kingdom_stats', {'p_kingdom_number': kingdom_number}).execute()
        print(f"Recalculated kingdom {kingdom_number} stats in Supabase")
        return True
    except Exception as e:
        print(f"Error recalculating kingdom {kingdom_number} in Supabase: {e}")
        # Fallback: Try to update directly if RPC fails
        return _update_kingdom_stats_directly(client, kingdom_number)


def _update_kingdom_stats_directly(client, kingdom_number: int) -> bool:
    """
    Fallback: Manually calculate and update kingdom stats if RPC is unavailable.
    """
    try:
        # Fetch all KvK records for this kingdom
        result = client.table('kvk_history').select('*').eq('kingdom_number', kingdom_number).execute()
        records = result.data or []
        
        if not records:
            return False
        
        total_kvks = len(records)
        prep_wins = sum(1 for r in records if r.get('prep_result') == 'W')
        prep_losses = sum(1 for r in records if r.get('prep_result') == 'L')
        battle_wins = sum(1 for r in records if r.get('battle_result') == 'W')
        battle_losses = sum(1 for r in records if r.get('battle_result') == 'L')
        dominations = sum(1 for r in records if r.get('prep_result') == 'W' and r.get('battle_result') == 'W')
        invasions = sum(1 for r in records if r.get('prep_result') == 'L' and r.get('battle_result') == 'L')
        reversals = sum(1 for r in records if r.get('prep_result') == 'L' and r.get('battle_result') == 'W')
        comebacks = sum(1 for r in records if r.get('prep_result') == 'W' and r.get('battle_result') == 'L')
        
        prep_win_rate = prep_wins / total_kvks if total_kvks > 0 else 0
        battle_win_rate = battle_wins / total_kvks if total_kvks > 0 else 0
        
        # Calculate streaks (sorted by kvk_number desc)
        sorted_records = sorted(records, key=lambda x: x.get('kvk_number', 0), reverse=True)
        prep_streak = 0
        battle_streak = 0
        for r in sorted_records:
            if r.get('prep_result') == 'W':
                prep_streak += 1
            else:
                break
        for r in sorted_records:
            if r.get('battle_result') == 'W':
                battle_streak += 1
            else:
                break
        
        # Calculate Atlas Score (simplified Bayesian formula)
        prior_mean = 0.5
        prior_strength = 3
        adj_prep_rate = (prep_wins + prior_strength * prior_mean) / (total_kvks + prior_strength)
        adj_battle_rate = (battle_wins + prior_strength * prior_mean) / (total_kvks + prior_strength)
        base_score = (adj_prep_rate + 2 * adj_battle_rate) / 3
        experience_factor = min(total_kvks, 5) / 5.0
        dominance_bonus = (dominations / max(total_kvks, 1)) * 0.1
        invasion_penalty = (invasions / max(total_kvks, 1)) * 0.1
        atlas_score = round((base_score * experience_factor + dominance_bonus - invasion_penalty) * 15, 2)
        atlas_score = max(0, min(15, atlas_score))
        
        # Upsert kingdom record
        update_data = {
            'kingdom_number': kingdom_number,
            'total_kvks': total_kvks,
            'prep_wins': prep_wins,
            'prep_losses': prep_losses,
            'prep_win_rate': round(prep_win_rate, 4),
            'prep_streak': prep_streak,
            'battle_wins': battle_wins,
            'battle_losses': battle_losses,
            'battle_win_rate': round(battle_win_rate, 4),
            'battle_streak': battle_streak,
            'dominations': dominations,
            'reversals': reversals,
            'comebacks': comebacks,
            'invasions': invasions,
            'atlas_score': atlas_score,
        }
        
        client.table('kingdoms').upsert(update_data, on_conflict='kingdom_number').execute()
        print(f"Directly updated kingdom {kingdom_number} in Supabase kingdoms table")
        return True
        
    except Exception as e:
        print(f"Error updating kingdom {kingdom_number} directly: {e}")
        return False


def get_kingdom_from_supabase(kingdom_number: int) -> Optional[dict]:
    """
    Fetch a kingdom's stats from Supabase (source of truth).
    
    Args:
        kingdom_number: The kingdom number to fetch
        
    Returns:
        Kingdom data dict or None
    """
    client = get_supabase_admin()
    if not client:
        return None
    
    try:
        # Use limit(1) instead of single() to avoid exception when not found
        result = client.table('kingdoms').select('*').eq('kingdom_number', kingdom_number).limit(1).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]
        return None
    except Exception as e:
        print(f"Error fetching kingdom {kingdom_number} from Supabase: {e}")
        return None


def get_kingdoms_from_supabase(
    limit: int = 100,
    sort_by: str = 'atlas_score',
    order: str = 'desc'
) -> list:
    """
    Fetch kingdoms from Supabase (source of truth).
    
    Args:
        limit: Max kingdoms to return
        sort_by: Field to sort by
        order: 'asc' or 'desc'
        
    Returns:
        List of kingdom dicts
    """
    client = get_supabase_admin()
    if not client:
        return []
    
    try:
        query = client.table('kingdoms').select('*')
        
        # Map field names (frontend uses overall_score, Supabase uses atlas_score)
        if sort_by == 'overall_score':
            sort_by = 'atlas_score'
        
        query = query.order(sort_by, desc=(order == 'desc')).limit(limit)
        result = query.execute()
        
        # Map atlas_score back to overall_score for API compatibility
        kingdoms = result.data or []
        for k in kingdoms:
            if 'atlas_score' in k:
                k['overall_score'] = k['atlas_score']
        
        return kingdoms
    except Exception as e:
        print(f"Error fetching kingdoms from Supabase: {e}")
        return []


def get_kvk_history_from_supabase(kingdom_number: int, limit: int = 10) -> list:
    """
    Fetch KvK history for a kingdom from Supabase.
    
    Args:
        kingdom_number: The kingdom to fetch history for
        limit: Max records to return
        
    Returns:
        List of KvK records
    """
    client = get_supabase_admin()
    if not client:
        return []
    
    try:
        result = client.table('kvk_history').select('*').eq(
            'kingdom_number', kingdom_number
        ).order('kvk_number', desc=True).limit(limit).execute()
        return result.data or []
    except Exception as e:
        print(f"Error fetching KvK history for kingdom {kingdom_number}: {e}")
        return []


def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> bool:
    """
    Create a notification for a user.
    
    Args:
        user_id: Supabase user ID to notify
        notification_type: Type of notification (admin_new_submission, submission_approved, etc.)
        title: Notification title
        message: Notification message
        link: Optional link to navigate to when clicked
        metadata: Optional additional data
        
    Returns:
        True if successful, False otherwise
    """
    client = get_supabase_admin()
    if not client:
        print(f"WARNING: Supabase not configured, cannot create notification for {user_id}")
        return False
    
    try:
        data = {
            "user_id": user_id,
            "type": notification_type,
            "title": title,
            "message": message,
            "read": False,
        }
        
        if link:
            data["link"] = link
        if metadata:
            data["metadata"] = metadata
        
        result = client.table("notifications").insert(data).execute()
        return bool(result.data)
        
    except Exception as e:
        print(f"Error creating notification for {user_id}: {e}")
        return False


def notify_admins(
    notification_type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> int:
    """
    Create notifications for all admin users.
    
    Args:
        notification_type: Type of notification
        title: Notification title
        message: Notification message
        link: Optional link to navigate to
        metadata: Optional additional data
        
    Returns:
        Number of admins notified
    """
    client = get_supabase_admin()
    if not client:
        print("WARNING: Supabase not configured, cannot notify admins")
        return 0
    
    try:
        # Get all admin user IDs
        result = client.table("profiles").select("id").eq("is_admin", True).execute()
        admin_ids = [row["id"] for row in (result.data or [])]
        
        if not admin_ids:
            print("No admins found to notify")
            return 0
        
        # Create notification for each admin
        notifications = []
        for admin_id in admin_ids:
            notif = {
                "user_id": admin_id,
                "type": notification_type,
                "title": title,
                "message": message,
                "read": False,
            }
            if link:
                notif["link"] = link
            if metadata:
                notif["metadata"] = metadata
            notifications.append(notif)
        
        # Batch insert
        client.table("notifications").insert(notifications).execute()
        print(f"Notified {len(admin_ids)} admins: {title}")
        return len(admin_ids)
        
    except Exception as e:
        print(f"Error notifying admins: {e}")
        return 0


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
        from datetime import datetime, timedelta, timezone
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        
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


def get_users_with_linked_kingshot_and_discord() -> list:
    """
    Get all users who have both a linked Kingshot account AND a Discord account.
    These are eligible for the Settler role backfill.
    
    Returns:
        List of user profiles with id, discord_id, linked_player_id, linked_username
    """
    client = get_supabase_admin()
    if not client:
        print("WARNING: Supabase not configured")
        return []
    
    try:
        # Query for users with both linked_player_id and discord_id not null
        # Using not_.is_ to check for IS NOT NULL (neq with string "null" was wrong)
        result = client.table("profiles").select(
            "id, discord_id, linked_player_id, linked_username, username"
        ).not_.is_("linked_player_id", "null").not_.is_("discord_id", "null").execute()
        
        users = result.data or []
        print(f"Found {len(users)} users with linked Kingshot and Discord accounts")
        return users
        
    except Exception as e:
        print(f"Error fetching linked users: {e}")
        return []
