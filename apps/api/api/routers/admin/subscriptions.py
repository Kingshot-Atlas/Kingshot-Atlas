"""
Admin subscription management endpoints.

Sync-all, manual grant, grant-by-email.
"""
import logging
import stripe
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Optional

from api.config import STRIPE_SECRET_KEY
from api.supabase_client import get_supabase_admin
from ._shared import require_admin, audit_log

logger = logging.getLogger("atlas.admin")

router = APIRouter()

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


class ManualSubscriptionRequest(BaseModel):
    """Request body for manually granting/revoking supporter status."""
    user_id: str
    tier: str  # 'supporter' or 'free'
    source: str = "manual"  # 'kofi', 'manual', 'stripe'
    reason: Optional[str] = None


class ManualSubscriptionByEmailRequest(BaseModel):
    """Request body for granting supporter status by email."""
    email: str
    tier: str  # 'supporter' or 'free'
    source: str = "manual"
    reason: Optional[str] = None


@router.post("/subscriptions/sync-all")
async def sync_all_subscriptions(x_admin_key: Optional[str] = Header(None), authorization: Optional[str] = Header(None)):
    """
    Sync all active Stripe subscriptions with Supabase profiles.
    
    Use this to fix discrepancies between Stripe (source of truth) and
    Supabase profiles when webhooks fail to update profile subscription_tier.
    
    Returns:
        - synced: Number of profiles successfully updated
        - failed: Number of sync failures
        - skipped: Number of subscriptions without matching profiles
        - details: List of sync operations
    """
    require_admin(x_admin_key, authorization)
    
    if not STRIPE_SECRET_KEY:
        return {"error": "Stripe not configured", "synced": 0, "failed": 0}
    
    client = get_supabase_admin()
    if not client:
        return {"error": "Supabase not configured", "synced": 0, "failed": 0}
    
    synced = 0
    failed = 0
    skipped = 0
    details = []
    
    try:
        # Get all active subscriptions from Stripe
        subscriptions = stripe.Subscription.list(status="active", limit=100)
        
        for sub in subscriptions.data:
            sub_id = sub.id
            customer_id = sub.customer
            tier = sub.get("metadata", {}).get("tier", "supporter")
            # Normalize legacy "pro" tier to "supporter"
            if tier == "pro":
                tier = "supporter"
            user_id = sub.get("metadata", {}).get("user_id")
            
            # Try to find user by metadata user_id first
            profile = None
            if user_id:
                try:
                    result = client.table("profiles").select("id, username, subscription_tier, stripe_customer_id").eq("id", user_id).single().execute()
                    profile = result.data
                except Exception:
                    pass
            
            # If no profile found by user_id, try by stripe_customer_id
            if not profile and customer_id:
                try:
                    result = client.table("profiles").select("id, username, subscription_tier, stripe_customer_id").eq("stripe_customer_id", customer_id).single().execute()
                    profile = result.data
                except Exception:
                    pass
            
            # If still no profile, try to find by email from Stripe customer
            if not profile and customer_id:
                try:
                    customer = stripe.Customer.retrieve(customer_id)
                    if customer.email:
                        result = client.table("profiles").select("id, username, subscription_tier, stripe_customer_id").eq("email", customer.email).single().execute()
                        profile = result.data
                except Exception:
                    pass
            
            if profile:
                current_tier = profile.get("subscription_tier", "free")
                if current_tier != tier:
                    # Update the profile
                    try:
                        update_data = {
                            "subscription_tier": tier,
                            "stripe_subscription_id": sub_id,
                        }
                        if customer_id and not profile.get("stripe_customer_id"):
                            update_data["stripe_customer_id"] = customer_id
                        
                        client.table("profiles").update(update_data).eq("id", profile["id"]).execute()
                        synced += 1
                        details.append({
                            "user_id": profile["id"],
                            "username": profile.get("username"),
                            "action": "updated",
                            "from_tier": current_tier,
                            "to_tier": tier
                        })
                    except Exception as e:
                        failed += 1
                        details.append({
                            "user_id": profile["id"],
                            "action": "failed",
                            "error": str(e)
                        })
                else:
                    details.append({
                        "user_id": profile["id"],
                        "username": profile.get("username"),
                        "action": "already_synced",
                        "tier": tier
                    })
            else:
                skipped += 1
                details.append({
                    "subscription_id": sub_id,
                    "customer_id": customer_id,
                    "action": "skipped",
                    "reason": "No matching profile found"
                })
        
        result = {
            "synced": synced,
            "failed": failed,
            "skipped": skipped,
            "total_subscriptions": len(subscriptions.data),
            "details": details
        }
        audit_log("sync_subscriptions", "subscriptions", None, {"synced": synced, "failed": failed, "skipped": skipped})
        return result
        
    except stripe.error.StripeError as e:
        return {"error": str(e), "synced": synced, "failed": failed}


@router.post("/subscriptions/grant")
async def grant_subscription(
    request: Request,
    body: ManualSubscriptionRequest,
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
):
    """
    Manually grant or revoke supporter status for a user.
    
    Use cases:
    - Ko-Fi subscribers who need supporter perks
    - Manual grants for community contributors
    - Revoking access when needed
    
    Args:
        body.user_id: Supabase user ID
        body.tier: 'supporter' or 'free'
        body.source: 'kofi', 'manual', or 'stripe'
        body.reason: Optional reason for the change
    """
    require_admin(x_admin_key, authorization)
    
    if body.tier not in ("supporter", "free"):
        raise HTTPException(status_code=400, detail="Tier must be 'supporter' or 'free'")
    if body.source not in ("kofi", "manual", "stripe"):
        raise HTTPException(status_code=400, detail="Source must be 'kofi', 'manual', or 'stripe'")
    
    client = get_supabase_admin()
    if not client:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        # Verify user exists
        profile_result = client.table("profiles").select(
            "id, username, email, subscription_tier, subscription_source"
        ).eq("id", body.user_id).single().execute()
        
        if not profile_result.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        profile = profile_result.data
        old_tier = profile.get("subscription_tier", "free")
        
        # Update subscription tier and source
        update_data = {
            "subscription_tier": body.tier,
            "subscription_source": body.source if body.tier != "free" else None,
        }
        
        client.table("profiles").update(update_data).eq("id", body.user_id).execute()
        
        # Sync Discord role if configured
        from api.discord_role_sync import sync_user_discord_role, is_discord_sync_configured
        discord_synced = False
        if is_discord_sync_configured():
            try:
                old_tier_for_removal = old_tier if body.tier == "free" else None
                discord_result = await sync_user_discord_role(
                    body.user_id, body.tier, old_tier_for_removal
                )
                discord_synced = bool(discord_result)
            except Exception as e:
                logger.warning(f"Discord role sync failed during manual grant: {e}")
        
        audit_log(
            "manual_subscription_grant",
            "profiles",
            body.user_id,
            {
                "username": profile.get("username"),
                "old_tier": old_tier,
                "new_tier": body.tier,
                "source": body.source,
                "reason": body.reason,
                "discord_synced": discord_synced,
            }
        )
        
        return {
            "success": True,
            "user_id": body.user_id,
            "username": profile.get("username"),
            "old_tier": old_tier,
            "new_tier": body.tier,
            "source": body.source,
            "discord_synced": discord_synced,
            "message": f"Subscription updated: {old_tier} → {body.tier} (source: {body.source})"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subscriptions/grant-by-email")
async def grant_subscription_by_email(
    request: Request,
    body: ManualSubscriptionByEmailRequest,
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
):
    """
    Manually grant or revoke supporter status by email address.
    Useful when you don't know the user's Supabase ID.
    """
    require_admin(x_admin_key, authorization)
    
    if body.tier not in ("supporter", "free"):
        raise HTTPException(status_code=400, detail="Tier must be 'supporter' or 'free'")
    if body.source not in ("kofi", "manual", "stripe"):
        raise HTTPException(status_code=400, detail="Source must be 'kofi', 'manual', or 'stripe'")
    
    client = get_supabase_admin()
    if not client:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        # Find user by email
        profile_result = client.table("profiles").select(
            "id, username, email, subscription_tier, subscription_source"
        ).eq("email", body.email).single().execute()
        
        if not profile_result.data:
            raise HTTPException(status_code=404, detail=f"No user found with email: {body.email}")
        
        # Delegate to the grant-by-id endpoint logic
        grant_request = ManualSubscriptionRequest(
            user_id=profile_result.data["id"],
            tier=body.tier,
            source=body.source,
            reason=body.reason,
        )
        return await grant_subscription(request, grant_request, x_admin_key, authorization)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
