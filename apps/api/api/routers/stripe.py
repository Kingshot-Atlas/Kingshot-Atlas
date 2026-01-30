"""
Stripe payment router for Atlas Pro/Recruiter subscriptions.

Handles:
- Checkout session creation
- Webhook processing for subscription events
- Subscription status queries
"""
import os
import stripe
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# Stripe configuration
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# Price IDs for each tier/billing cycle (live mode)
PRICE_IDS = {
    "pro_monthly": "price_1SuX3zL7R9uCnPH3m4PyIrNI",
    "pro_yearly": "price_1SuX4HL7R9uCnPH3HgVWRN51",
    "recruiter_monthly": "price_1SuX57L7R9uCnPH30D6ar75H",
    "recruiter_yearly": "price_1SuX5OL7R9uCnPH3QJBqlFNh",
}

# Frontend URLs
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://ks-atlas.com")


class CheckoutRequest(BaseModel):
    """Request body for creating a checkout session."""
    tier: str  # "pro" or "recruiter"
    billing_cycle: str  # "monthly" or "yearly"
    user_id: str  # Supabase user ID
    user_email: Optional[str] = None


class CheckoutResponse(BaseModel):
    """Response containing the checkout session URL."""
    checkout_url: str
    session_id: str


@router.post("/checkout", response_model=CheckoutResponse)
@limiter.limit("10/minute")
async def create_checkout_session(request: Request, checkout: CheckoutRequest):
    """
    Create a Stripe Checkout session for subscription purchase.
    
    Args:
        checkout: Contains tier, billing_cycle, user_id, and optional user_email
        
    Returns:
        checkout_url: URL to redirect user to Stripe Checkout
        session_id: Stripe session ID for tracking
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail={"error": "Payment service not configured", "code": "SERVICE_UNAVAILABLE"}
        )
    
    # Validate tier
    if checkout.tier not in ["pro", "recruiter"]:
        raise HTTPException(
            status_code=400,
            detail={"error": "Invalid tier. Must be 'pro' or 'recruiter'", "code": "INVALID_TIER"}
        )
    
    # Validate billing cycle
    if checkout.billing_cycle not in ["monthly", "yearly"]:
        raise HTTPException(
            status_code=400,
            detail={"error": "Invalid billing cycle. Must be 'monthly' or 'yearly'", "code": "INVALID_BILLING"}
        )
    
    # Get the price ID
    price_key = f"{checkout.tier}_{checkout.billing_cycle}"
    price_id = PRICE_IDS.get(price_key)
    
    if not price_id:
        raise HTTPException(
            status_code=400,
            detail={"error": f"Price not found for {price_key}", "code": "PRICE_NOT_FOUND"}
        )
    
    try:
        # Create Stripe Checkout session
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{
                "price": price_id,
                "quantity": 1,
            }],
            success_url=f"{FRONTEND_URL}/upgrade?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/upgrade?canceled=true",
            client_reference_id=checkout.user_id,
            customer_email=checkout.user_email,
            metadata={
                "user_id": checkout.user_id,
                "tier": checkout.tier,
                "billing_cycle": checkout.billing_cycle,
            },
            subscription_data={
                "metadata": {
                    "user_id": checkout.user_id,
                    "tier": checkout.tier,
                }
            },
            allow_promotion_codes=True,
        )
        
        return CheckoutResponse(
            checkout_url=session.url,
            session_id=session.id
        )
        
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": str(e), "code": "STRIPE_ERROR"}
        )


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature")
):
    """
    Handle Stripe webhook events.
    
    Events handled:
    - checkout.session.completed: New subscription created
    - customer.subscription.updated: Subscription changed (upgrade/downgrade)
    - customer.subscription.deleted: Subscription canceled
    - invoice.payment_failed: Payment failed
    """
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=503,
            detail={"error": "Webhook not configured", "code": "SERVICE_UNAVAILABLE"}
        )
    
    payload = await request.body()
    
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    event_type = event["type"]
    data = event["data"]["object"]
    
    # Handle different event types
    if event_type == "checkout.session.completed":
        await handle_checkout_completed(data)
    elif event_type == "customer.subscription.updated":
        await handle_subscription_updated(data)
    elif event_type == "customer.subscription.deleted":
        await handle_subscription_deleted(data)
    elif event_type == "invoice.payment_failed":
        await handle_payment_failed(data)
    
    return {"received": True}


async def handle_checkout_completed(session: dict):
    """
    Handle successful checkout - create/update subscription in Supabase.
    
    This is called when a customer completes payment through Stripe Checkout.
    We need to update the user's tier in Supabase.
    """
    user_id = session.get("client_reference_id") or session.get("metadata", {}).get("user_id")
    tier = session.get("metadata", {}).get("tier", "pro")
    subscription_id = session.get("subscription")
    customer_id = session.get("customer")
    
    if not user_id:
        print(f"WARNING: No user_id in checkout session {session.get('id')}")
        return
    
    print(f"Checkout completed: user={user_id}, tier={tier}, subscription={subscription_id}")
    
    # TODO: Update user's subscription tier in Supabase
    # This requires Supabase admin client - will be implemented when we have
    # the Supabase service role key configured
    #
    # Example:
    # supabase.from_("profiles").update({
    #     "subscription_tier": tier,
    #     "stripe_customer_id": customer_id,
    #     "stripe_subscription_id": subscription_id,
    # }).eq("id", user_id).execute()


async def handle_subscription_updated(subscription: dict):
    """
    Handle subscription updates (upgrades, downgrades, renewals).
    """
    subscription_id = subscription.get("id")
    customer_id = subscription.get("customer")
    status = subscription.get("status")
    tier = subscription.get("metadata", {}).get("tier")
    user_id = subscription.get("metadata", {}).get("user_id")
    
    print(f"Subscription updated: id={subscription_id}, status={status}, tier={tier}, user={user_id}")
    
    # TODO: Update user's subscription status in Supabase


async def handle_subscription_deleted(subscription: dict):
    """
    Handle subscription cancellation - downgrade user to free tier.
    """
    subscription_id = subscription.get("id")
    user_id = subscription.get("metadata", {}).get("user_id")
    
    print(f"Subscription deleted: id={subscription_id}, user={user_id}")
    
    # TODO: Set user's tier back to 'free' in Supabase


async def handle_payment_failed(invoice: dict):
    """
    Handle failed payment - notify user and potentially suspend access.
    """
    subscription_id = invoice.get("subscription")
    customer_id = invoice.get("customer")
    
    print(f"Payment failed: subscription={subscription_id}, customer={customer_id}")
    
    # TODO: Send notification to user about failed payment


@router.get("/subscription/{user_id}")
@limiter.limit("30/minute")
async def get_subscription_status(request: Request, user_id: str):
    """
    Get a user's current subscription status.
    
    Returns tier, status, and billing info if subscribed.
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail={"error": "Payment service not configured", "code": "SERVICE_UNAVAILABLE"}
        )
    
    # TODO: Look up user's Stripe customer ID from Supabase
    # Then fetch their subscription from Stripe
    
    # For now, return a placeholder
    return {
        "user_id": user_id,
        "tier": "free",
        "status": "none",
        "message": "Subscription lookup not yet implemented"
    }


@router.post("/portal")
@limiter.limit("10/minute")
async def create_portal_session(request: Request, user_id: str = None, customer_id: str = None):
    """
    Create a Stripe Customer Portal session for managing subscriptions.
    
    Allows users to:
    - Update payment method
    - Cancel subscription
    - View billing history
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail={"error": "Payment service not configured", "code": "SERVICE_UNAVAILABLE"}
        )
    
    if not customer_id:
        # TODO: Look up customer_id from Supabase using user_id
        raise HTTPException(
            status_code=400,
            detail={"error": "Customer ID required", "code": "MISSING_CUSTOMER_ID"}
        )
    
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{FRONTEND_URL}/profile",
        )
        
        return {"portal_url": session.url}
        
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": str(e), "code": "STRIPE_ERROR"}
        )
