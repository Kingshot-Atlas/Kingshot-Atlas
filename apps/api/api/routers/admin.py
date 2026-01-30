"""
Admin API endpoints for dashboard analytics.

Provides subscription stats, revenue data, and user metrics.
"""
import os
import stripe
from fastapi import APIRouter, HTTPException, Request, Header
from typing import Optional
from datetime import datetime, timedelta
from api.supabase_client import get_supabase_admin

router = APIRouter()

# Stripe configuration
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# Admin API key for authentication
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")


def verify_admin(api_key: Optional[str]) -> bool:
    """Verify admin API key or allow if not configured (dev mode)."""
    if not ADMIN_API_KEY:
        return True  # Dev mode - no auth required
    return api_key == ADMIN_API_KEY


@router.get("/stats/subscriptions")
async def get_subscription_stats(x_admin_key: Optional[str] = Header(None)):
    """
    Get subscription statistics from Supabase.
    
    Returns counts by tier and list of active subscribers.
    """
    client = get_supabase_admin()
    
    if not client:
        return {
            "total_users": 0,
            "by_tier": {"free": 0, "pro": 0, "recruiter": 0},
            "recent_subscribers": [],
            "error": "Supabase not configured"
        }
    
    try:
        # Get all profiles with subscription info
        result = client.table("profiles").select(
            "id, username, email, subscription_tier, stripe_customer_id, created_at"
        ).execute()
        
        profiles = result.data or []
        
        # Count by tier
        tier_counts = {"free": 0, "pro": 0, "recruiter": 0}
        for profile in profiles:
            tier = profile.get("subscription_tier", "free") or "free"
            if tier in tier_counts:
                tier_counts[tier] += 1
            else:
                tier_counts["free"] += 1
        
        # Get recent subscribers (non-free, last 30 days)
        recent = [
            {
                "username": p.get("username") or "Anonymous",
                "tier": p.get("subscription_tier"),
                "created_at": p.get("created_at")
            }
            for p in profiles
            if p.get("subscription_tier") and p.get("subscription_tier") != "free"
        ]
        recent.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return {
            "total_users": len(profiles),
            "by_tier": tier_counts,
            "recent_subscribers": recent[:10],  # Last 10
            "paid_users": tier_counts["pro"] + tier_counts["recruiter"]
        }
        
    except Exception as e:
        return {
            "total_users": 0,
            "by_tier": {"free": 0, "pro": 0, "recruiter": 0},
            "recent_subscribers": [],
            "error": str(e)
        }


@router.get("/stats/revenue")
async def get_revenue_stats(x_admin_key: Optional[str] = Header(None)):
    """
    Get revenue statistics from Stripe.
    
    Returns MRR, total revenue, and subscription breakdown.
    """
    if not STRIPE_SECRET_KEY:
        return {
            "mrr": 0,
            "total_revenue": 0,
            "active_subscriptions": 0,
            "subscriptions_by_tier": [],
            "recent_payments": [],
            "error": "Stripe not configured"
        }
    
    try:
        # Get active subscriptions
        subscriptions = stripe.Subscription.list(status="active", limit=100)
        
        mrr = 0
        tier_counts = {"pro_monthly": 0, "pro_yearly": 0, "recruiter_monthly": 0, "recruiter_yearly": 0}
        
        for sub in subscriptions.data:
            # Calculate MRR from subscription
            for item in sub.get("items", {}).get("data", []):
                price = item.get("price", {})
                amount = price.get("unit_amount", 0) / 100  # Convert cents to dollars
                interval = price.get("recurring", {}).get("interval", "month")
                
                if interval == "year":
                    mrr += amount / 12
                else:
                    mrr += amount
                
                # Count by tier from metadata
                tier = sub.get("metadata", {}).get("tier", "pro")
                billing = "yearly" if interval == "year" else "monthly"
                key = f"{tier}_{billing}"
                if key in tier_counts:
                    tier_counts[key] += 1
        
        # Get recent charges for total revenue
        charges = stripe.Charge.list(limit=100)
        total_revenue = sum(
            c.amount / 100 for c in charges.data 
            if c.status == "succeeded" and not c.refunded
        )
        
        # Get recent successful payments
        recent_payments = [
            {
                "amount": c.amount / 100,
                "currency": c.currency.upper(),
                "date": datetime.fromtimestamp(c.created).isoformat(),
                "customer_email": c.billing_details.get("email") if c.billing_details else None
            }
            for c in charges.data[:10]
            if c.status == "succeeded"
        ]
        
        return {
            "mrr": round(mrr, 2),
            "total_revenue": round(total_revenue, 2),
            "active_subscriptions": len(subscriptions.data),
            "subscriptions_by_tier": [
                {"tier": k.replace("_", " ").title(), "count": v}
                for k, v in tier_counts.items() if v > 0
            ],
            "recent_payments": recent_payments
        }
        
    except stripe.error.StripeError as e:
        return {
            "mrr": 0,
            "total_revenue": 0,
            "active_subscriptions": 0,
            "subscriptions_by_tier": [],
            "recent_payments": [],
            "error": str(e)
        }


@router.get("/stats/overview")
async def get_admin_overview(x_admin_key: Optional[str] = Header(None)):
    """
    Get combined overview stats for admin dashboard.
    """
    # Get subscription stats
    sub_stats = await get_subscription_stats(x_admin_key)
    
    # Get revenue stats
    rev_stats = await get_revenue_stats(x_admin_key)
    
    return {
        "users": {
            "total": sub_stats.get("total_users", 0),
            "free": sub_stats.get("by_tier", {}).get("free", 0),
            "pro": sub_stats.get("by_tier", {}).get("pro", 0),
            "recruiter": sub_stats.get("by_tier", {}).get("recruiter", 0),
        },
        "revenue": {
            "mrr": rev_stats.get("mrr", 0),
            "total": rev_stats.get("total_revenue", 0),
            "active_subscriptions": rev_stats.get("active_subscriptions", 0),
        },
        "subscriptions": rev_stats.get("subscriptions_by_tier", []),
        "recent_subscribers": sub_stats.get("recent_subscribers", []),
        "recent_payments": rev_stats.get("recent_payments", []),
    }
