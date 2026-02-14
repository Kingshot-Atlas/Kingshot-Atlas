"""
Admin CSV export endpoints.

Subscriber and revenue data exports.
"""
import logging
import stripe
import csv
import io
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, timedelta

from api.config import STRIPE_SECRET_KEY
from api.supabase_client import get_supabase_admin
from ._shared import require_admin

logger = logging.getLogger("atlas.admin")

router = APIRouter()

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


@router.get("/export/subscribers")
async def export_subscribers_csv(x_admin_key: Optional[str] = Header(None), authorization: Optional[str] = Header(None)):
    """
    Export all subscriber data as CSV.
    """
    require_admin(x_admin_key, authorization)
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
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """
    Export revenue data as CSV.
    """
    require_admin(x_admin_key, authorization)
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
