"""
Admin analytics endpoints.

Subscription stats, revenue, overview, MRR history, churn, forecast, cohort analysis, KPIs.
"""
import os
import logging
import stripe
from fastapi import APIRouter, Header
from typing import Optional, Dict
from datetime import datetime, timedelta
from collections import defaultdict

from api.config import STRIPE_SECRET_KEY
from api.supabase_client import get_supabase_admin
from ._shared import require_admin

logger = logging.getLogger("atlas.admin")

router = APIRouter()

# Plausible Analytics configuration
PLAUSIBLE_API_KEY = os.getenv("PLAUSIBLE_API_KEY", "")
PLAUSIBLE_SITE_ID = os.getenv("PLAUSIBLE_SITE_ID", "ks-atlas.com")

# Stripe configuration
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


@router.get("/stats/subscriptions")
async def get_subscription_stats(x_admin_key: Optional[str] = Header(None), authorization: Optional[str] = Header(None)):
    """
    Get subscription statistics from Supabase.
    
    Returns counts by tier and list of active subscribers.
    """
    require_admin(x_admin_key, authorization)
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
            "id, username, email, subscription_tier, stripe_customer_id, created_at, linked_username, is_admin, subscription_started_at"
        ).execute()
        
        profiles = result.data or []
        
        # Count by tier and linked status
        tier_counts = {"free": 0, "supporter": 0, "pro": 0, "recruiter": 0}
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
                "username": p.get("linked_username") or p.get("username") or "Anonymous",
                "tier": p.get("subscription_tier"),
                "created_at": p.get("subscription_started_at") or p.get("created_at")
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
            "paid_users": tier_counts["supporter"] + tier_counts["pro"] + tier_counts["recruiter"]
        }
        
    except Exception as e:
        return {
            "total_users": 0,
            "by_tier": {"free": 0, "supporter": 0, "pro": 0, "recruiter": 0},
            "recent_subscribers": [],
            "error": str(e)
        }


@router.get("/stats/revenue")
async def get_revenue_stats(x_admin_key: Optional[str] = Header(None), authorization: Optional[str] = Header(None)):
    """
    Get revenue statistics from Stripe.
    
    Returns MRR, total revenue, and subscription breakdown.
    """
    require_admin(x_admin_key, authorization)
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
        tier_counts = {"supporter_monthly": 0, "supporter_yearly": 0, "recruiter_monthly": 0, "recruiter_yearly": 0}
        
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
                tier = sub.get("metadata", {}).get("tier", "supporter")
                # Normalize legacy "pro" tier to "supporter"
                if tier == "pro":
                    tier = "supporter"
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
async def get_admin_overview(x_admin_key: Optional[str] = Header(None), authorization: Optional[str] = Header(None)):
    """
    Get combined overview stats for admin dashboard.
    
    Uses Stripe as the source of truth for subscription counts to avoid
    sync issues between Stripe webhooks and Supabase profile updates.
    """
    require_admin(x_admin_key, authorization)
    # Get subscription stats from Supabase
    sub_stats = await get_subscription_stats(x_admin_key, authorization)
    
    # Get revenue stats from Stripe (source of truth for subscriptions)
    rev_stats = await get_revenue_stats(x_admin_key, authorization)
    
    # Calculate actual paid user counts from Stripe (source of truth)
    # This avoids discrepancies when webhooks fail to update profiles
    stripe_supporter_count = 0
    stripe_recruiter_count = 0
    
    for tier_info in rev_stats.get("subscriptions_by_tier", []):
        tier_name = tier_info.get("tier", "").lower()
        count = tier_info.get("count", 0)
        if "supporter" in tier_name:
            stripe_supporter_count += count
        elif "recruiter" in tier_name:
            stripe_recruiter_count += count
    
    # Total users from Supabase, but paid counts from Stripe
    total_users = sub_stats.get("total_users", 0)
    paid_from_stripe = stripe_supporter_count + stripe_recruiter_count
    
    # Free users = total users - paid users (from Stripe)
    free_users = max(0, total_users - paid_from_stripe)
    
    return {
        "users": {
            "total": total_users,
            "free": free_users,
            "pro": stripe_supporter_count,
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
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """
    Get MRR history over time for charting.
    Returns daily MRR values for the specified number of days.
    """
    require_admin(x_admin_key, authorization)
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
async def get_churn_stats(x_admin_key: Optional[str] = Header(None), authorization: Optional[str] = Header(None)):
    """
    Get churn rate and retention metrics.
    Industry-standard churn calculations.
    """
    require_admin(x_admin_key, authorization)
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
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """
    Get revenue forecast based on current MRR and growth rate.
    Simple linear projection with growth assumptions.
    """
    require_admin(x_admin_key, authorization)
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
async def get_cohort_analysis(x_admin_key: Optional[str] = Header(None), authorization: Optional[str] = Header(None)):
    """
    Get subscriber cohort analysis by signup month.
    Shows retention by cohort over time.
    """
    require_admin(x_admin_key, authorization)
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


@router.get("/stats/kpis")
async def get_key_performance_indicators(x_admin_key: Optional[str] = Header(None), authorization: Optional[str] = Header(None)):
    """
    Get all key performance indicators in one call.
    Optimized for dashboard display.
    """
    require_admin(x_admin_key, authorization)
    # Gather all stats in parallel-ish fashion
    sub_stats = await get_subscription_stats(x_admin_key, authorization)
    rev_stats = await get_revenue_stats(x_admin_key, authorization)
    churn_stats = await get_churn_stats(x_admin_key, authorization)
    
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


@router.get("/stats/plausible")
async def get_plausible_stats(
    period: str = "30d",
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Proxy Plausible Analytics API to get real visitor stats.
    Requires PLAUSIBLE_API_KEY env var to be set."""
    require_admin(x_admin_key, authorization)
    if not PLAUSIBLE_API_KEY:
        return {"error": "PLAUSIBLE_API_KEY not configured", "visitors": 0, "pageviews": 0, "bounce_rate": 0, "visit_duration": 0}
    try:
        import urllib.request
        import json as json_lib
        url = f"https://plausible.io/api/v1/stats/aggregate?site_id={PLAUSIBLE_SITE_ID}&period={period}&metrics=visitors,pageviews,bounce_rate,visit_duration"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {PLAUSIBLE_API_KEY}"})
        with urllib.request.urlopen(req, timeout=10) as resp:  # nosec B310 - URL is hardcoded plausible.io API
            data = json_lib.loads(resp.read().decode())
        results = data.get("results", {})
        return {
            "visitors": results.get("visitors", {}).get("value", 0),
            "pageviews": results.get("pageviews", {}).get("value", 0),
            "bounce_rate": results.get("bounce_rate", {}).get("value", 0),
            "visit_duration": results.get("visit_duration", {}).get("value", 0),
            "period": period,
            "source": "plausible"
        }
    except Exception as e:
        logger.warning(f"Plausible API error: {e}")
        return {"error": str(e), "visitors": 0, "pageviews": 0, "bounce_rate": 0, "visit_duration": 0}


@router.get("/stats/plausible/breakdown")
async def get_plausible_breakdown(
    property: str = "visit:source",
    period: str = "30d",
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Get Plausible breakdown by property (source, country, page, etc.)."""
    require_admin(x_admin_key, authorization)
    if not PLAUSIBLE_API_KEY:
        return {"error": "PLAUSIBLE_API_KEY not configured", "results": []}
    try:
        import urllib.request
        import json as json_lib
        url = f"https://plausible.io/api/v1/stats/breakdown?site_id={PLAUSIBLE_SITE_ID}&period={period}&property={property}&limit=10"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {PLAUSIBLE_API_KEY}"})
        with urllib.request.urlopen(req, timeout=10) as resp:  # nosec B310 - URL is hardcoded plausible.io API
            data = json_lib.loads(resp.read().decode())
        return {"results": data.get("results", []), "property": property, "period": period}
    except Exception as e:
        logger.warning(f"Plausible breakdown error: {e}")
        return {"error": str(e), "results": []}
