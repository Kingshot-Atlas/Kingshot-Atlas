"""
Admin API endpoints for dashboard analytics.

Provides subscription stats, revenue data, user metrics, and advanced analytics.
Industry-grade analytics for SaaS subscription tracking.
"""
import os
import stripe
from fastapi import APIRouter, HTTPException, Request, Header, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict
import csv
import io
from api.supabase_client import get_supabase_admin, get_webhook_events, get_webhook_stats
from api.atlas_score_formula import (
    calculate_atlas_score, extract_stats_from_kingdom, get_power_tier,
    calculate_tier_thresholds_from_scores, ScoreBreakdown, PowerTier
)
from database import get_db
from models import Kingdom, KVKRecord

router = APIRouter()

# Default KvK number (fallback if not set in database)
DEFAULT_CURRENT_KVK = 10

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


def require_admin(x_admin_key: Optional[str] = Header(None)):
    """FastAPI dependency to enforce admin authentication on endpoints."""
    if not verify_admin(x_admin_key):
        raise HTTPException(
            status_code=401,
            detail="Admin API key required. Set X-Admin-Key header."
        )


@router.get("/stats/subscriptions")
async def get_subscription_stats(x_admin_key: Optional[str] = Header(None)):
    """
    Get subscription statistics from Supabase.
    
    Returns counts by tier and list of active subscribers.
    """
    require_admin(x_admin_key)
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
            "id, username, email, subscription_tier, stripe_customer_id, created_at, linked_username, is_admin"
        ).execute()
        
        profiles = result.data or []
        
        # Count by tier and linked status
        tier_counts = {"free": 0, "pro": 0, "recruiter": 0}
        kingshot_linked_count = 0
        
        for profile in profiles:
            tier = profile.get("subscription_tier", "free") or "free"
            # Admins are auto-recruiter (single source of truth)
            if profile.get("is_admin"):
                tier = "recruiter"
            if tier in tier_counts:
                tier_counts[tier] += 1
            else:
                tier_counts["free"] += 1
            
            # Count users with linked Kingshot accounts
            if profile.get("linked_username"):
                kingshot_linked_count += 1
        
        # Admin usernames - exclude from recent subscribers (they're not paying)
        admin_usernames = ['gatreno']
        
        # Get recent subscribers (non-free, non-admin, last 30 days)
        recent = [
            {
                "username": p.get("username") or "Anonymous",
                "tier": p.get("subscription_tier"),
                "created_at": p.get("created_at")
            }
            for p in profiles
            if p.get("subscription_tier") and p.get("subscription_tier") != "free"
            and (p.get("username") or "").lower() not in admin_usernames
        ]
        recent.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        return {
            "total_users": len(profiles),
            "by_tier": tier_counts,
            "kingshot_linked": kingshot_linked_count,
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
    require_admin(x_admin_key)
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
    
    Uses Stripe as the source of truth for subscription counts to avoid
    sync issues between Stripe webhooks and Supabase profile updates.
    """
    require_admin(x_admin_key)
    # Get subscription stats from Supabase
    sub_stats = await get_subscription_stats(x_admin_key)
    
    # Get revenue stats from Stripe (source of truth for subscriptions)
    rev_stats = await get_revenue_stats(x_admin_key)
    
    # Calculate actual paid user counts from Stripe (source of truth)
    # This avoids discrepancies when webhooks fail to update profiles
    stripe_pro_count = 0
    stripe_recruiter_count = 0
    
    for tier_info in rev_stats.get("subscriptions_by_tier", []):
        tier_name = tier_info.get("tier", "").lower()
        count = tier_info.get("count", 0)
        if "pro" in tier_name:
            stripe_pro_count += count
        elif "recruiter" in tier_name:
            stripe_recruiter_count += count
    
    # Total users from Supabase, but paid counts from Stripe
    total_users = sub_stats.get("total_users", 0)
    paid_from_stripe = stripe_pro_count + stripe_recruiter_count
    
    # Free users = total users - paid users (from Stripe)
    free_users = max(0, total_users - paid_from_stripe)
    
    return {
        "users": {
            "total": total_users,
            "free": free_users,
            "pro": stripe_pro_count,
            "recruiter": stripe_recruiter_count,
            "kingshot_linked": sub_stats.get("kingshot_linked", 0),
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


@router.get("/stats/mrr-history")
async def get_mrr_history(
    days: int = 30,
    x_admin_key: Optional[str] = Header(None)
):
    """
    Get MRR history over time for charting.
    Returns daily MRR values for the specified number of days.
    """
    require_admin(x_admin_key)
    if not STRIPE_SECRET_KEY:
        return {"data": [], "error": "Stripe not configured"}
    
    try:
        # Get all invoices from the past N days
        start_date = datetime.now() - timedelta(days=days)
        start_timestamp = int(start_date.timestamp())
        
        invoices = stripe.Invoice.list(
            created={"gte": start_timestamp},
            status="paid",
            limit=100
        )
        
        # Group revenue by day
        daily_revenue: Dict[str, float] = defaultdict(float)
        
        for invoice in invoices.auto_paging_iter():
            date = datetime.fromtimestamp(invoice.created).strftime("%Y-%m-%d")
            daily_revenue[date] += invoice.amount_paid / 100
        
        # Calculate cumulative MRR (simplified - assumes monthly subscriptions)
        mrr_data = []
        current_date = start_date
        cumulative_mrr = 0
        
        while current_date <= datetime.now():
            date_str = current_date.strftime("%Y-%m-%d")
            # Add new subscriptions from this day
            cumulative_mrr += daily_revenue.get(date_str, 0)
            mrr_data.append({
                "date": date_str,
                "mrr": round(cumulative_mrr, 2),
                "revenue": round(daily_revenue.get(date_str, 0), 2)
            })
            current_date += timedelta(days=1)
        
        return {"data": mrr_data}
        
    except stripe.error.StripeError as e:
        return {"data": [], "error": str(e)}


@router.get("/stats/churn")
async def get_churn_stats(x_admin_key: Optional[str] = Header(None)):
    """
    Get churn rate and retention metrics.
    Industry-standard churn calculations.
    """
    require_admin(x_admin_key)
    if not STRIPE_SECRET_KEY:
        return {
            "churn_rate": 0,
            "retention_rate": 0,
            "churned_this_month": 0,
            "new_this_month": 0,
            "net_growth": 0,
            "error": "Stripe not configured"
        }
    
    try:
        now = datetime.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_start_ts = int(month_start.timestamp())
        
        # Get canceled subscriptions this month
        canceled = stripe.Subscription.list(
            status="canceled",
            created={"gte": month_start_ts},
            limit=100
        )
        churned_count = len(canceled.data)
        
        # Get new subscriptions this month
        new_subs = stripe.Subscription.list(
            status="active",
            created={"gte": month_start_ts},
            limit=100
        )
        new_count = len(new_subs.data)
        
        # Get total active at start of month (approximate)
        all_active = stripe.Subscription.list(status="active", limit=100)
        active_count = len(all_active.data)
        
        # Calculate churn rate: churned / (active + churned) * 100
        total_at_start = active_count + churned_count - new_count
        churn_rate = (churned_count / max(total_at_start, 1)) * 100
        retention_rate = 100 - churn_rate
        
        return {
            "churn_rate": round(churn_rate, 2),
            "retention_rate": round(retention_rate, 2),
            "churned_this_month": churned_count,
            "new_this_month": new_count,
            "net_growth": new_count - churned_count,
            "active_subscribers": active_count,
            "period": month_start.strftime("%B %Y")
        }
        
    except stripe.error.StripeError as e:
        return {
            "churn_rate": 0,
            "retention_rate": 0,
            "churned_this_month": 0,
            "new_this_month": 0,
            "net_growth": 0,
            "error": str(e)
        }


@router.get("/stats/forecast")
async def get_revenue_forecast(
    months: int = 6,
    x_admin_key: Optional[str] = Header(None)
):
    """
    Get revenue forecast based on current MRR and growth rate.
    Simple linear projection with growth assumptions.
    """
    require_admin(x_admin_key)
    if not STRIPE_SECRET_KEY:
        return {"forecast": [], "error": "Stripe not configured"}
    
    try:
        # Get current MRR
        subscriptions = stripe.Subscription.list(status="active", limit=100)
        
        current_mrr = 0
        for sub in subscriptions.data:
            for item in sub.get("items", {}).get("data", []):
                price = item.get("price", {})
                amount = price.get("unit_amount", 0) / 100
                interval = price.get("recurring", {}).get("interval", "month")
                if interval == "year":
                    current_mrr += amount / 12
                else:
                    current_mrr += amount
        
        # Calculate average growth rate (assume 5% monthly if no history)
        growth_rate = 0.05
        
        # Generate forecast
        forecast = []
        projected_mrr = current_mrr
        
        for i in range(months):
            future_date = datetime.now() + timedelta(days=30 * (i + 1))
            projected_mrr *= (1 + growth_rate)
            forecast.append({
                "month": future_date.strftime("%b %Y"),
                "projected_mrr": round(projected_mrr, 2),
                "projected_arr": round(projected_mrr * 12, 2),
                "confidence": max(0.9 - (i * 0.1), 0.5)  # Decreasing confidence
            })
        
        return {
            "current_mrr": round(current_mrr, 2),
            "current_arr": round(current_mrr * 12, 2),
            "growth_rate": growth_rate,
            "forecast": forecast
        }
        
    except stripe.error.StripeError as e:
        return {"forecast": [], "error": str(e)}


@router.get("/stats/cohort")
async def get_cohort_analysis(x_admin_key: Optional[str] = Header(None)):
    """
    Get subscriber cohort analysis by signup month.
    Shows retention by cohort over time.
    """
    require_admin(x_admin_key)
    if not STRIPE_SECRET_KEY:
        return {"cohorts": [], "error": "Stripe not configured"}
    
    try:
        # Get all subscriptions (active and canceled)
        all_subs = []
        
        active = stripe.Subscription.list(status="active", limit=100)
        all_subs.extend([(s, True) for s in active.data])
        
        canceled = stripe.Subscription.list(status="canceled", limit=100)
        all_subs.extend([(s, False) for s in canceled.data])
        
        # Group by signup month
        cohorts: Dict[str, Dict] = defaultdict(lambda: {"total": 0, "active": 0, "churned": 0})
        
        for sub, is_active in all_subs:
            signup_month = datetime.fromtimestamp(sub.created).strftime("%Y-%m")
            cohorts[signup_month]["total"] += 1
            if is_active:
                cohorts[signup_month]["active"] += 1
            else:
                cohorts[signup_month]["churned"] += 1
        
        # Calculate retention rate for each cohort
        cohort_data = []
        for month, data in sorted(cohorts.items()):
            retention = (data["active"] / max(data["total"], 1)) * 100
            cohort_data.append({
                "month": month,
                "total_signups": data["total"],
                "still_active": data["active"],
                "churned": data["churned"],
                "retention_rate": round(retention, 1)
            })
        
        return {"cohorts": cohort_data[-12:]}  # Last 12 months
        
    except stripe.error.StripeError as e:
        return {"cohorts": [], "error": str(e)}


@router.get("/export/subscribers")
async def export_subscribers_csv(x_admin_key: Optional[str] = Header(None)):
    """
    Export all subscriber data as CSV.
    """
    require_admin(x_admin_key)
    client = get_supabase_admin()
    
    if not client:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    try:
        result = client.table("profiles").select(
            "id, username, email, subscription_tier, stripe_customer_id, created_at, home_kingdom"
        ).execute()
        
        profiles = result.data or []
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=[
            "id", "username", "email", "subscription_tier", 
            "stripe_customer_id", "created_at", "home_kingdom"
        ])
        writer.writeheader()
        
        for profile in profiles:
            writer.writerow({
                "id": profile.get("id", ""),
                "username": profile.get("username", ""),
                "email": profile.get("email", ""),
                "subscription_tier": profile.get("subscription_tier", "free"),
                "stripe_customer_id": profile.get("stripe_customer_id", ""),
                "created_at": profile.get("created_at", ""),
                "home_kingdom": profile.get("home_kingdom", "")
            })
        
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=subscribers_{datetime.now().strftime('%Y%m%d')}.csv"
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/revenue")
async def export_revenue_csv(
    days: int = 90,
    x_admin_key: Optional[str] = Header(None)
):
    """
    Export revenue data as CSV.
    """
    require_admin(x_admin_key)
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    try:
        start_date = datetime.now() - timedelta(days=days)
        start_timestamp = int(start_date.timestamp())
        
        charges = stripe.Charge.list(
            created={"gte": start_timestamp},
            limit=100
        )
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=[
            "date", "amount", "currency", "status", "customer_email", "description"
        ])
        writer.writeheader()
        
        for charge in charges.auto_paging_iter():
            writer.writerow({
                "date": datetime.fromtimestamp(charge.created).isoformat(),
                "amount": charge.amount / 100,
                "currency": charge.currency.upper(),
                "status": charge.status,
                "customer_email": charge.billing_details.email if charge.billing_details else "",
                "description": charge.description or ""
            })
        
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=revenue_{datetime.now().strftime('%Y%m%d')}.csv"
            }
        )
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/kpis")
async def get_key_performance_indicators(x_admin_key: Optional[str] = Header(None)):
    """
    Get all key performance indicators in one call.
    Optimized for dashboard display.
    """
    require_admin(x_admin_key)
    # Gather all stats in parallel-ish fashion
    sub_stats = await get_subscription_stats(x_admin_key)
    rev_stats = await get_revenue_stats(x_admin_key)
    churn_stats = await get_churn_stats(x_admin_key)
    
    mrr = rev_stats.get("mrr", 0)
    active_subs = rev_stats.get("active_subscriptions", 0)
    
    # Calculate ARPU (Average Revenue Per User)
    arpu = mrr / max(active_subs, 1)
    
    # Calculate LTV (Lifetime Value) - simplified: ARPU / churn_rate
    churn_rate = churn_stats.get("churn_rate", 5) / 100  # Default 5%
    ltv = arpu / max(churn_rate, 0.01)
    
    return {
        "mrr": round(mrr, 2),
        "arr": round(mrr * 12, 2),
        "arpu": round(arpu, 2),
        "ltv": round(ltv, 2),
        "total_users": sub_stats.get("total_users", 0),
        "paid_users": sub_stats.get("paid_users", 0),
        "conversion_rate": round(
            (sub_stats.get("paid_users", 0) / max(sub_stats.get("total_users", 1), 1)) * 100, 
            2
        ),
        "churn_rate": churn_stats.get("churn_rate", 0),
        "retention_rate": churn_stats.get("retention_rate", 100),
        "net_growth": churn_stats.get("net_growth", 0),
        "active_subscriptions": active_subs
    }


@router.get("/webhooks/events")
async def get_webhook_events_list(
    limit: int = 50,
    event_type: Optional[str] = None,
    status: Optional[str] = None,
    x_admin_key: Optional[str] = Header(None)
):
    """
    Get recent webhook events for monitoring.
    
    Args:
        limit: Max events to return (default 50)
        event_type: Filter by event type
        status: Filter by status (received, processed, failed)
    """
    require_admin(x_admin_key)
    events = get_webhook_events(limit=limit, event_type=event_type, status=status)
    return {"events": events, "count": len(events)}


@router.get("/webhooks/stats")
async def get_webhook_health_stats(x_admin_key: Optional[str] = Header(None)):
    """
    Get webhook health statistics for monitoring dashboard.
    
    Returns:
        - Total events in last 24 hours
        - Processed count
        - Failed count
        - Failure rate percentage
        - Health status (healthy/warning/critical)
    """
    require_admin(x_admin_key)
    stats = get_webhook_stats()
    return stats


@router.post("/subscriptions/sync-all")
async def sync_all_subscriptions(x_admin_key: Optional[str] = Header(None)):
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
    require_admin(x_admin_key)
    
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
            tier = sub.get("metadata", {}).get("tier", "pro")
            user_id = sub.get("metadata", {}).get("user_id")
            
            # Try to find user by metadata user_id first
            profile = None
            if user_id:
                try:
                    result = client.table("profiles").select("id, username, subscription_tier, stripe_customer_id").eq("id", user_id).single().execute()
                    profile = result.data
                except:
                    pass
            
            # If no profile found by user_id, try by stripe_customer_id
            if not profile and customer_id:
                try:
                    result = client.table("profiles").select("id, username, subscription_tier, stripe_customer_id").eq("stripe_customer_id", customer_id).single().execute()
                    profile = result.data
                except:
                    pass
            
            # If still no profile, try to find by email from Stripe customer
            if not profile and customer_id:
                try:
                    customer = stripe.Customer.retrieve(customer_id)
                    if customer.email:
                        result = client.table("profiles").select("id, username, subscription_tier, stripe_customer_id").eq("email", customer.email).single().execute()
                        profile = result.data
                except:
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
        
        return {
            "synced": synced,
            "failed": failed,
            "skipped": skipped,
            "total_subscriptions": len(subscriptions.data),
            "details": details
        }
        
    except stripe.error.StripeError as e:
        return {"error": str(e), "synced": synced, "failed": failed}


# ============================================================================
# ATLAS SCORE MANAGEMENT
# ============================================================================

@router.post("/scores/recalculate")
async def recalculate_all_scores(
    x_admin_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Recalculate Atlas Scores for all kingdoms using the v2.0 formula.
    
    This endpoint recalculates scores based on:
    - Base win rates with Bayesian adjustment
    - Domination/Invasion multipliers
    - Recent form (last 5 KvKs)
    - Streak bonuses
    - Experience factor
    """
    require_admin(x_admin_key)
    
    try:
        # Get all kingdoms
        kingdoms = db.query(Kingdom).all()
        
        updated = 0
        errors = []
        score_changes = []
        
        for kingdom in kingdoms:
            try:
                # Get KvK records for this kingdom
                kvk_records = db.query(KVKRecord).filter(
                    KVKRecord.kingdom_number == kingdom.kingdom_number
                ).order_by(KVKRecord.kvk_number.desc()).all()
                
                # Convert to dict format
                kvk_dicts = [
                    {
                        'kvk_number': r.kvk_number,
                        'prep_result': r.prep_result,
                        'battle_result': r.battle_result
                    }
                    for r in kvk_records
                ]
                
                kingdom_dict = {
                    'total_kvks': kingdom.total_kvks,
                    'prep_wins': kingdom.prep_wins,
                    'prep_losses': kingdom.prep_losses,
                    'battle_wins': kingdom.battle_wins,
                    'battle_losses': kingdom.battle_losses,
                    'dominations': kingdom.dominations,
                    'invasions': kingdom.invasions,
                }
                
                # Calculate new score
                stats = extract_stats_from_kingdom(kingdom_dict, kvk_dicts)
                breakdown = calculate_atlas_score(stats)
                
                old_score = kingdom.overall_score
                new_score = breakdown.final_score
                
                # Track significant changes
                if abs(new_score - old_score) > 0.1:
                    score_changes.append({
                        'kingdom': kingdom.kingdom_number,
                        'old_score': round(old_score, 2),
                        'new_score': round(new_score, 2),
                        'change': round(new_score - old_score, 2),
                        'old_tier': get_power_tier(old_score).value,
                        'new_tier': breakdown.tier.value
                    })
                
                # Update the score
                kingdom.overall_score = new_score
                updated += 1
                
            except Exception as e:
                errors.append({
                    'kingdom': kingdom.kingdom_number,
                    'error': str(e)
                })
        
        # Commit all changes
        db.commit()
        
        # Sort changes by magnitude
        score_changes.sort(key=lambda x: abs(x['change']), reverse=True)
        
        return {
            'success': True,
            'updated': updated,
            'errors': len(errors),
            'error_details': errors[:10],  # First 10 errors
            'significant_changes': score_changes[:20],  # Top 20 changes
            'total_kingdoms': len(kingdoms)
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Score recalculation failed: {str(e)}")


@router.get("/scores/distribution")
async def get_score_distribution(
    x_admin_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Get Atlas Score distribution statistics.
    
    Returns score distribution, tier counts, and percentile thresholds.
    """
    require_admin(x_admin_key)
    
    try:
        kingdoms = db.query(Kingdom).all()
        scores = [k.overall_score for k in kingdoms if k.overall_score is not None]
        
        if not scores:
            return {'error': 'No scores found'}
        
        # Sort for percentile calculations
        sorted_scores = sorted(scores)
        total = len(sorted_scores)
        
        # Calculate tier counts
        tier_counts = {tier.value: 0 for tier in PowerTier}
        for score in scores:
            tier = get_power_tier(score)
            tier_counts[tier.value] += 1
        
        # Calculate dynamic thresholds based on actual distribution
        dynamic_thresholds = calculate_tier_thresholds_from_scores(scores)
        
        # Score distribution buckets
        buckets = {
            '0-2': 0,
            '2-4': 0,
            '4-6': 0,
            '6-8': 0,
            '8-10': 0,
            '10+': 0
        }
        for score in scores:
            if score < 2:
                buckets['0-2'] += 1
            elif score < 4:
                buckets['2-4'] += 1
            elif score < 6:
                buckets['4-6'] += 1
            elif score < 8:
                buckets['6-8'] += 1
            elif score < 10:
                buckets['8-10'] += 1
            else:
                buckets['10+'] += 1
        
        return {
            'total_kingdoms': total,
            'tier_counts': tier_counts,
            'tier_percentages': {k: round(v / total * 100, 1) for k, v in tier_counts.items()},
            'score_buckets': buckets,
            'statistics': {
                'min': round(min(scores), 2),
                'max': round(max(scores), 2),
                'mean': round(sum(scores) / len(scores), 2),
                'median': round(sorted_scores[total // 2], 2),
                'p10': round(sorted_scores[int(total * 0.10)], 2),
                'p25': round(sorted_scores[int(total * 0.25)], 2),
                'p50': round(sorted_scores[int(total * 0.50)], 2),
                'p75': round(sorted_scores[int(total * 0.75)], 2),
                'p90': round(sorted_scores[int(total * 0.90)], 2),
                'p97': round(sorted_scores[int(total * 0.97)], 2) if total > 33 else None,
            },
            'dynamic_thresholds': {k.value: round(v, 2) for k, v in dynamic_thresholds.items()}
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get distribution: {str(e)}")


@router.get("/scores/movers")
async def get_score_movers(
    days: int = 7,
    limit: int = 20,
    x_admin_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Get kingdoms with the biggest score changes in the last N days.
    
    Requires score_history table to be populated.
    """
    require_admin(x_admin_key)
    
    client = get_supabase_admin()
    if not client:
        return {'error': 'Supabase not configured', 'movers': []}
    
    try:
        # Get score history from Supabase
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        
        result = client.table("score_history").select(
            "kingdom_number, score, recorded_at"
        ).gte("recorded_at", cutoff).order("recorded_at").execute()
        
        if not result.data:
            return {'movers': [], 'message': 'No score history found'}
        
        # Group by kingdom and find first/last scores
        kingdom_scores = defaultdict(list)
        for record in result.data:
            kingdom_scores[record['kingdom_number']].append({
                'score': record['score'],
                'recorded_at': record['recorded_at']
            })
        
        # Calculate changes
        movers = []
        for kingdom_num, scores in kingdom_scores.items():
            if len(scores) >= 2:
                scores.sort(key=lambda x: x['recorded_at'])
                first_score = scores[0]['score']
                last_score = scores[-1]['score']
                change = last_score - first_score
                
                if abs(change) > 0.05:  # Minimum threshold
                    movers.append({
                        'kingdom': kingdom_num,
                        'old_score': round(first_score, 2),
                        'new_score': round(last_score, 2),
                        'change': round(change, 2),
                        'change_percent': round((change / first_score) * 100, 1) if first_score > 0 else 0,
                        'old_tier': get_power_tier(first_score).value,
                        'new_tier': get_power_tier(last_score).value,
                        'tier_changed': get_power_tier(first_score) != get_power_tier(last_score)
                    })
        
        # Sort by absolute change
        movers.sort(key=lambda x: abs(x['change']), reverse=True)
        
        return {
            'period_days': days,
            'total_movers': len(movers),
            'tier_changes': sum(1 for m in movers if m['tier_changed']),
            'movers': movers[:limit]
        }
        
    except Exception as e:
        return {'error': str(e), 'movers': []}


# ============================================================================
# KVK CONFIG MANAGEMENT
# ============================================================================

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
    x_admin_key: Optional[str] = Header(None)
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
    require_admin(x_admin_key)
    
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
async def increment_current_kvk(x_admin_key: Optional[str] = Header(None)):
    """
    Increment the current KvK number by 1 (admin only).
    
    Convenience endpoint for after a KvK battle phase ends.
    Gets the current value and increments it.
    
    Returns:
        The old and new KvK numbers
    """
    require_admin(x_admin_key)
    
    # Get current value
    current_result = await get_current_kvk()
    current_kvk = current_result.get("current_kvk", DEFAULT_CURRENT_KVK)
    
    # Increment
    new_kvk = current_kvk + 1
    
    # Set new value
    result = await set_current_kvk(new_kvk, x_admin_key)
    
    return {
        "success": True,
        "old_kvk": current_kvk,
        "new_kvk": new_kvk,
        "message": f"KvK incremented from #{current_kvk} to #{new_kvk}"
    }
