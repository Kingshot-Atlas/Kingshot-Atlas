"""
Supabase admin client for server-side operations.

This client uses the service role key to bypass Row Level Security,
enabling admin operations like updating user subscription tiers.
"""
import os
import logging
from typing import Optional

logger = logging.getLogger("atlas.supabase")

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
    source: Optional[str] = None,
) -> bool:
    """
    Update a user's subscription tier in Supabase.
    
    Args:
        user_id: Supabase user ID
        tier: Subscription tier ('free' or 'supporter')
        stripe_customer_id: Stripe customer ID
        stripe_subscription_id: Stripe subscription ID
        source: Subscription source ('stripe', 'kofi', 'manual')
        
    Returns:
        True if successful, False otherwise
    """
    client = get_supabase_admin()
    if not client:
        logger.warning("Supabase not configured, cannot update subscription for %s", user_id)
        return False
    
    try:
        update_data = {"subscription_tier": tier}
        
        if stripe_customer_id:
            update_data["stripe_customer_id"] = stripe_customer_id
        if stripe_subscription_id:
            update_data["stripe_subscription_id"] = stripe_subscription_id
        if source:
            update_data["subscription_source"] = source
        elif tier != "free" and stripe_customer_id:
            update_data["subscription_source"] = "stripe"
        
        # Set subscription_started_at on first subscription (don't overwrite if already set)
        if tier != "free":
            from datetime import datetime, timezone
            existing = client.table("profiles").select("subscription_started_at").eq("id", user_id).single().execute()
            if existing.data and not existing.data.get("subscription_started_at"):
                update_data["subscription_started_at"] = datetime.now(timezone.utc).isoformat()
        
        result = client.table("profiles").update(update_data).eq("id", user_id).execute()
        
        if result.data:
            logger.info("Updated subscription for user %s: tier=%s", user_id, tier)
            # Send welcome notification on first subscription
            if tier != "free" and "subscription_started_at" in update_data:
                try:
                    create_notification(
                        user_id=user_id,
                        notification_type="system_announcement",
                        title="Welcome to Atlas Supporter! 💖",
                        message="Thank you for supporting Kingshot Atlas! You now have access to all Supporter perks including ad-free browsing, 5-kingdom comparisons, and your Supporter badge.",
                        link="/support",
                    )
                except Exception as notif_err:
                    logger.warning("Non-fatal: Could not send welcome notification: %s", notif_err)
            return True
        else:
            logger.warning("No profile found for user %s", user_id)
            return False
            
    except Exception as e:
        logger.error("Error updating subscription for %s: %s", user_id, e)
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
        logger.error("Error fetching profile for %s: %s", user_id, e)
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
        logger.error("Error fetching user by Stripe customer %s: %s", customer_id, e)
        return None


def is_webhook_event_processed(event_id: str) -> bool:
    """
    Check if a webhook event has already been successfully processed.
    Used as an idempotency guard to prevent duplicate processing on retries.
    
    Args:
        event_id: Stripe event ID (evt_xxx)
        
    Returns:
        True if the event was already processed
    """
    client = get_supabase_admin()
    if not client:
        return False
    
    try:
        result = client.table("webhook_events").select("status").eq("event_id", event_id).eq("status", "processed").execute()
        return bool(result.data)
    except Exception as e:
        logger.warning("Error checking webhook idempotency for %s: %s", event_id, e)
        return False


def get_user_by_email(email: str) -> Optional[dict]:
    """
    Find a user by their email address.
    Used as a fallback when client_reference_id and stripe_customer_id are unavailable.
    
    Args:
        email: User's email address
        
    Returns:
        User profile dict or None
    """
    client = get_supabase_admin()
    if not client:
        return None
    
    try:
        result = client.table("profiles").select("*").eq("email", email).limit(1).execute()
        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        logger.error("Error fetching user by email %s: %s", email, e)
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
        logger.warning("Supabase not configured, cannot log webhook %s", event_id)
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
        logger.error("Error logging webhook event %s: %s", event_id, e)
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
        logger.error("Error fetching webhook events: %s", e)
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
        logger.warning("Supabase not configured, cannot recalculate kingdom %s", kingdom_number)
        return False
    
    try:
        # Call the RPC function to recalculate kingdom stats
        result = client.rpc('recalculate_kingdom_stats', {'p_kingdom_number': kingdom_number}).execute()
        logger.info("Recalculated kingdom %d stats in Supabase", kingdom_number)
        return True
    except Exception as e:
        logger.error("Error recalculating kingdom %d in Supabase: %s", kingdom_number, e)
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
        logger.info("Directly updated kingdom %d in Supabase kingdoms table", kingdom_number)
        return True
        
    except Exception as e:
        logger.error("Error updating kingdom %d directly: %s", kingdom_number, e)
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
        logger.error("Error fetching kingdom %d from Supabase: %s", kingdom_number, e)
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
        logger.error("Error fetching kingdoms from Supabase: %s", e)
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
        logger.error("Error fetching KvK history for kingdom %d: %s", kingdom_number, e)
        return []


def _check_notification_preference(client, user_id: str, notification_type: str) -> bool:
    """
    Check if a user has enabled notifications for this type.
    Maps notification types to preference keys in user_data.settings.
    Returns True if the notification should be sent (default: send).
    """
    # Map notification types to preference keys
    PREFERENCE_MAP = {
        "submission_approved": "submission_updates",
        "submission_rejected": "submission_updates",
        "claim_verified": "submission_updates",
        "claim_rejected": "submission_updates",
        "system_announcement": "system_announcements",
        # favorite_score_change is handled by DB trigger, not this function
    }

    pref_key = PREFERENCE_MAP.get(notification_type)
    if not pref_key:
        # No preference mapping = always send (e.g. admin types)
        return True

    try:
        result = (
            client.table("user_data")
            .select("settings")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not result.data or not result.data.get("settings"):
            return True  # No settings = default to enabled

        prefs = result.data["settings"].get("notification_preferences", {})
        # Default to True if key not present
        return prefs.get(pref_key, True) is not False
    except Exception as e:
        logger.error("Error checking notification preference for %s: %s", user_id, e)
        return True  # Fail open — send the notification


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
    Respects user notification preferences stored in user_data.settings.
    
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
        logger.warning("Supabase not configured, cannot create notification for %s", user_id)
        return False
    
    # Check user preference before creating notification
    if not _check_notification_preference(client, user_id, notification_type):
        logger.info("Notification skipped for %s: %s (disabled by preference)", user_id, notification_type)
        return True  # Return True — preference was respected, not an error
    
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
        logger.error("Error creating notification for %s: %s", user_id, e)
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
        logger.warning("Supabase not configured, cannot notify admins")
        return 0
    
    try:
        # Get all admin user IDs
        result = client.table("profiles").select("id").eq("is_admin", True).execute()
        admin_ids = [row["id"] for row in (result.data or [])]
        
        if not admin_ids:
            logger.info("No admins found to notify")
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
        logger.info("Notified %d admins: %s", len(admin_ids), title)
        return len(admin_ids)
        
    except Exception as e:
        logger.error("Error notifying admins: %s", e)
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
        logger.error("Error fetching webhook stats: %s", e)
        return {"total_24h": 0, "processed": 0, "failed": 0, "failure_rate": 0, "health": "unknown"}


def credit_kingdom_fund(
    kingdom_number: int,
    amount: float,
    user_id: Optional[str] = None,
    stripe_payment_intent_id: Optional[str] = None,
) -> bool:
    """
    Credit a kingdom fund balance and log the contribution.
    Also recalculates the fund tier based on new balance.

    Args:
        kingdom_number: The kingdom to credit
        amount: Dollar amount to add
        user_id: Supabase user ID of contributor (optional for anonymous)
        stripe_payment_intent_id: Stripe payment intent ID for tracking

    Returns:
        True if successful
    """
    client = get_supabase_admin()
    if not client:
        logger.warning("Supabase not configured, cannot credit fund for kingdom %d", kingdom_number)
        return False

    try:
        # 1. Get or create the kingdom fund record
        fund_result = client.table("kingdom_funds").select("kingdom_number, balance").eq(
            "kingdom_number", kingdom_number
        ).limit(1).execute()

        if fund_result.data and len(fund_result.data) > 0:
            current_balance = float(fund_result.data[0].get("balance", 0))
            new_balance = current_balance + amount
            new_tier = _calculate_fund_tier(new_balance)

            # Use RPC to atomically increment contributor_count and total_contributed
            client.table("kingdom_funds").update({
                "balance": new_balance,
                "tier": new_tier,
            }).eq("kingdom_number", kingdom_number).execute()

            # Increment total_contributed and contributor_count via raw SQL
            client.rpc("increment_fund_totals", {
                "p_kingdom_number": kingdom_number,
                "p_amount": amount,
            }).execute()
        else:
            # Create new fund record
            new_balance = amount
            new_tier = _calculate_fund_tier(new_balance)

            client.table("kingdom_funds").insert({
                "kingdom_number": kingdom_number,
                "balance": new_balance,
                "tier": new_tier,
                "total_contributed": amount,
                "contributor_count": 1,
                "is_recruiting": False,
                "recruitment_tags": [],
                "secondary_languages": [],
                "event_times": [],
                "highlighted_stats": [],
                "banner_theme": "default",
            }).execute()

        # 2. Log the contribution
        contribution_data = {
            "kingdom_number": kingdom_number,
            "amount": amount,
        }
        if user_id:
            contribution_data["user_id"] = user_id
        if stripe_payment_intent_id:
            contribution_data["stripe_payment_intent_id"] = stripe_payment_intent_id

        client.table("kingdom_fund_contributions").insert(contribution_data).execute()

        # 3. Notify the kingdom's active editor about the contribution
        try:
            editor_result = client.table("kingdom_editors").select("user_id").eq(
                "kingdom_number", kingdom_number
            ).eq("status", "active").limit(1).execute()

            if editor_result.data and len(editor_result.data) > 0:
                editor_user_id = editor_result.data[0]["user_id"]
                # Get contributor name if available
                contributor_name = "Someone"
                if user_id:
                    profile_result = client.table("profiles").select("linked_username, username").eq(
                        "id", user_id
                    ).limit(1).execute()
                    if profile_result.data:
                        contributor_name = profile_result.data[0].get("linked_username") or profile_result.data[0].get("username") or "Someone"

                client.table("notifications").insert({
                    "user_id": editor_user_id,
                    "type": "fund_contribution",
                    "title": f"Kingdom {kingdom_number} Fund Contribution",
                    "message": f"{contributor_name} contributed ${amount:.0f} to Kingdom {kingdom_number}'s fund. New balance: ${new_balance:.0f}.",
                    "link": "/transfer-hub",
                    "metadata": {
                        "kingdom_number": kingdom_number,
                        "amount": amount,
                        "new_balance": new_balance,
                        "contributor_user_id": user_id,
                    },
                }).execute()
        except Exception as notify_err:
            logger.warning("Non-blocking: failed to notify editor for K%d: %s", kingdom_number, notify_err)

        logger.info("Credited kingdom %d fund: +$%s -> $%s (tier: %s)", kingdom_number, amount, new_balance, new_tier)
        return True

    except Exception as e:
        logger.error("Error crediting kingdom fund %d: %s", kingdom_number, e)
        return False


def _calculate_fund_tier(balance: float) -> str:
    """Calculate fund tier based on balance."""
    if balance >= 100:
        return "gold"
    elif balance >= 50:
        return "silver"
    elif balance >= 25:
        return "bronze"
    return "standard"


def get_supporter_users_with_discord() -> list:
    """
    Get all users who have an active supporter subscription AND a linked Discord account.
    These are eligible for the Supporter Discord role.
    
    Returns:
        List of user profiles with id, discord_id, username, subscription_tier
    """
    client = get_supabase_admin()
    if not client:
        logger.warning("Supabase not configured")
        return []
    
    try:
        result = client.table("profiles").select(
            "id, discord_id, username, linked_username, subscription_tier"
        ).eq("subscription_tier", "supporter").not_.is_("discord_id", "null").execute()
        
        users = result.data or []
        logger.info("Found %d supporter users with Discord accounts", len(users))
        return users
        
    except Exception as e:
        logger.error("Error fetching supporter users: %s", e)
        return []


def log_gift_code_redemption(
    player_id: str,
    code: str,
    success: bool,
    error_code: Optional[int] = None,
    message: Optional[str] = None,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> bool:
    """
    Log a gift code redemption attempt to Supabase for analytics.
    
    Args:
        player_id: Kingshot player ID
        code: Gift code attempted
        success: Whether redemption succeeded
        error_code: Century Games error code (if failed)
        message: Human-readable result message
        user_id: Supabase user ID (if authenticated)
        ip_address: Client IP address
        
    Returns:
        True if logged successfully
    """
    client = get_supabase_admin()
    if not client:
        return False
    
    try:
        data = {
            "player_id": player_id,
            "code": code,
            "success": success,
        }
        if error_code is not None:
            data["error_code"] = error_code
        if message:
            data["message"] = message
        if user_id:
            data["user_id"] = user_id
        if ip_address:
            data["ip_address"] = ip_address
        
        client.table("gift_code_redemptions").insert(data).execute()
        return True
    except Exception as e:
        logger.error("Error logging gift code redemption: %s", e)
        return False


def get_gift_codes_from_db() -> list:
    """Fetch all active gift codes from Supabase gift_codes table."""
    client = get_supabase_admin()
    if not client:
        return []
    try:
        result = client.table("gift_codes").select("*").eq("is_active", True).execute()
        return result.data or []
    except Exception as e:
        logger.error("Error fetching gift codes: %s", e)
        return []


def get_deactivated_gift_codes() -> set:
    """Fetch codes marked is_active=False so they can be excluded from external sources."""
    client = get_supabase_admin()
    if not client:
        return set()
    try:
        result = client.table("gift_codes").select("code").eq("is_active", False).execute()
        return {r["code"] for r in (result.data or [])}
    except Exception as e:
        logger.error("Error fetching deactivated gift codes: %s", e)
        return set()


def upsert_gift_codes(codes: list, source: str = "kingshot.net") -> bool:
    """
    Upsert gift codes into the gift_codes table.
    Codes are matched by the 'code' column (UNIQUE).
    Only updates if the code already exists and source matches.
    """
    client = get_supabase_admin()
    if not client or not codes:
        return False
    try:
        for c in codes:
            row = {
                "code": c.get("code", ""),
                "source": source,
                "is_active": not c.get("is_expired", False),
            }
            expire = c.get("expire_date") or c.get("expiresAt")
            if expire:
                row["expire_date"] = expire
            if not row["code"]:
                continue
            # Upsert: insert or update on conflict
            client.table("gift_codes").upsert(
                row, on_conflict="code"
            ).execute()
        return True
    except Exception as e:
        logger.error("Error upserting gift codes: %s", e)
        return False


def add_manual_gift_code(code: str, expire_date: str = None, added_by: str = None) -> dict:
    """Add a manually-entered gift code to the database."""
    client = get_supabase_admin()
    if not client:
        return {"error": "Supabase not configured"}
    try:
        row = {
            "code": code.strip().upper(),
            "source": "manual",
            "is_active": True,
        }
        if expire_date:
            row["expire_date"] = expire_date
        if added_by:
            row["added_by"] = added_by
        result = client.table("gift_codes").upsert(row, on_conflict="code").execute()
        return {"success": True, "data": result.data}
    except Exception as e:
        return {"error": str(e)}


def deactivate_gift_code(code: str) -> bool:
    """Mark a gift code as inactive."""
    client = get_supabase_admin()
    if not client:
        return False
    try:
        client.table("gift_codes").update({"is_active": False}).eq("code", code).execute()
        return True
    except Exception as e:
        logger.error("Error deactivating gift code: %s", e)
        return False


def mark_gift_code_expired(code: str) -> bool:
    """Mark a gift code as expired/inactive when Century Games API returns err_code 40007."""
    client = get_supabase_admin()
    if not client:
        return False
    try:
        client.table("gift_codes").update({"is_active": False}).eq("code", code).execute()
        logger.info("[gift-codes] Auto-deactivated expired code: %s", code)
        return True
    except Exception as e:
        logger.error("Error marking gift code expired: %s", e)
        return False


def get_user_by_discord_id(discord_id: str) -> Optional[dict]:
    """Look up a user profile by their Discord ID. Returns profile dict or None."""
    client = get_supabase_admin()
    if not client:
        return None
    try:
        result = client.table("profiles").select(
            "id, discord_id, linked_player_id, linked_username, username, alt_accounts, subscription_tier, linked_kingdom"
        ).eq("discord_id", discord_id).limit(1).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]
        return None
    except Exception as e:
        logger.error("Error looking up user by discord_id: %s", e)
        return None


def get_users_with_linked_kingshot_and_discord() -> list:
    """
    Get all users who have both a linked Kingshot account AND a Discord account.
    These are eligible for the Settler role backfill.
    
    Returns:
        List of user profiles with id, discord_id, linked_player_id, linked_username
    """
    client = get_supabase_admin()
    if not client:
        logger.warning("Supabase not configured")
        return []
    
    try:
        # Query for users with both linked_player_id and discord_id not null
        # Using not_.is_ to check for IS NOT NULL (neq with string "null" was wrong)
        result = client.table("profiles").select(
            "id, discord_id, linked_player_id, linked_username, username, referral_tier"
        ).not_.is_("linked_player_id", "null").not_.is_("discord_id", "null").execute()
        
        users = result.data or []
        logger.info("Found %d users with linked Kingshot and Discord accounts", len(users))
        return users
        
    except Exception as e:
        logger.error("Error fetching linked users: %s", e)
        return []
