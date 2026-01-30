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
