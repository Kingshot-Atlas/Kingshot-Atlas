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
from api.supabase_client import update_user_subscription, get_user_by_stripe_customer, get_user_profile, log_webhook_event
from api.email_service import send_welcome_email, send_cancellation_email, send_payment_failed_email
import time

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
    
    All events are logged to the webhook_events table for monitoring.
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
    
    event_id = event["id"]
    event_type = event["type"]
    data = event["data"]["object"]
    
    # Extract user and customer IDs for logging
    user_id = data.get("client_reference_id") or data.get("metadata", {}).get("user_id")
    customer_id = data.get("customer")
    
    # Log event as received
    log_webhook_event(
        event_id=event_id,
        event_type=event_type,
        status="received",
        payload=dict(event),
        user_id=user_id,
        customer_id=customer_id,
    )
    
    # Process the event with timing
    start_time = time.time()
    error_message = None
    
    try:
        if event_type == "checkout.session.completed":
            await handle_checkout_completed(data)
        elif event_type == "customer.subscription.updated":
            await handle_subscription_updated(data)
        elif event_type == "customer.subscription.deleted":
            await handle_subscription_deleted(data)
        elif event_type == "invoice.payment_failed":
            await handle_payment_failed(data)
        
        # Log successful processing
        processing_time_ms = int((time.time() - start_time) * 1000)
        log_webhook_event(
            event_id=event_id,
            event_type=event_type,
            status="processed",
            processing_time_ms=processing_time_ms,
            user_id=user_id,
            customer_id=customer_id,
        )
        
    except Exception as e:
        # Log failed processing
        error_message = str(e)
        processing_time_ms = int((time.time() - start_time) * 1000)
        log_webhook_event(
            event_id=event_id,
            event_type=event_type,
            status="failed",
            error_message=error_message,
            processing_time_ms=processing_time_ms,
            user_id=user_id,
            customer_id=customer_id,
        )
        print(f"Webhook processing failed for {event_id}: {error_message}")
    
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
    
    # Update user's subscription tier in Supabase
    success = update_user_subscription(
        user_id=user_id,
        tier=tier,
        stripe_customer_id=customer_id,
        stripe_subscription_id=subscription_id,
    )
    
    if success:
        print(f"Successfully updated subscription for user {user_id} to {tier}")
        # Send welcome email
        profile = get_user_profile(user_id)
        if profile and profile.get("email"):
            await send_welcome_email(
                email=profile["email"],
                username=profile.get("username", "Champion"),
                tier=tier
            )
    else:
        print(f"Failed to update subscription for user {user_id}")


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
    
    # If subscription is active and we have a tier, update the user
    if status == "active" and tier and user_id:
        update_user_subscription(
            user_id=user_id,
            tier=tier,
            stripe_subscription_id=subscription_id,
        )
    elif status in ("canceled", "unpaid", "past_due"):
        # If subscription is no longer active, check if we should downgrade
        if user_id:
            # For past_due, we might want to give a grace period
            # For now, only downgrade on explicit cancellation
            if status == "canceled":
                update_user_subscription(user_id=user_id, tier="free")
                print(f"Downgraded user {user_id} to free tier due to cancellation")


async def handle_subscription_deleted(subscription: dict):
    """
    Handle subscription cancellation - downgrade user to free tier.
    """
    subscription_id = subscription.get("id")
    customer_id = subscription.get("customer")
    user_id = subscription.get("metadata", {}).get("user_id")
    previous_tier = subscription.get("metadata", {}).get("tier", "pro")
    
    print(f"Subscription deleted: id={subscription_id}, user={user_id}")
    
    profile = None
    
    # Try to find user by metadata first, then by Stripe customer ID
    if user_id:
        profile = get_user_profile(user_id)
        update_user_subscription(user_id=user_id, tier="free")
        print(f"Downgraded user {user_id} to free tier")
    elif customer_id:
        # Look up user by Stripe customer ID
        profile = get_user_by_stripe_customer(customer_id)
        if profile:
            update_user_subscription(user_id=profile["id"], tier="free")
            print(f"Downgraded user {profile['id']} to free tier (found by customer ID)")
        else:
            print(f"Could not find user for Stripe customer {customer_id}")
    
    # Send cancellation email
    if profile and profile.get("email"):
        await send_cancellation_email(
            email=profile["email"],
            username=profile.get("username", "Champion"),
            tier=previous_tier
        )


async def handle_payment_failed(invoice: dict):
    """
    Handle failed payment - notify user to update payment method.
    """
    subscription_id = invoice.get("subscription")
    customer_id = invoice.get("customer")
    attempt_count = invoice.get("attempt_count", 0)
    
    print(f"Payment failed: subscription={subscription_id}, customer={customer_id}, attempt={attempt_count}")
    
    # Send payment failed email on first attempt
    if attempt_count == 1 and customer_id:
        profile = get_user_by_stripe_customer(customer_id)
        if profile and profile.get("email"):
            tier = profile.get("subscription_tier", "pro")
            await send_payment_failed_email(
                email=profile["email"],
                username=profile.get("username", "Champion"),
                tier=tier
            )


@router.get("/subscription/{user_id}")
@limiter.limit("30/minute")
async def get_subscription_status(request: Request, user_id: str):
    """
    Get a user's current subscription status.
    
    Returns tier, status, and billing info if subscribed.
    """
    # Get user profile from Supabase
    profile = get_user_profile(user_id)
    
    if not profile:
        return {
            "user_id": user_id,
            "tier": "free",
            "status": "none",
            "message": "User profile not found"
        }
    
    tier = profile.get("subscription_tier", "free")
    stripe_subscription_id = profile.get("stripe_subscription_id")
    
    # If no Stripe subscription, return basic info
    if not stripe_subscription_id or not STRIPE_SECRET_KEY:
        return {
            "user_id": user_id,
            "tier": tier,
            "status": "active" if tier != "free" else "none",
            "stripe_connected": False
        }
    
    # Fetch subscription details from Stripe
    try:
        subscription = stripe.Subscription.retrieve(stripe_subscription_id)
        return {
            "user_id": user_id,
            "tier": tier,
            "status": subscription.status,
            "stripe_connected": True,
            "current_period_end": subscription.current_period_end,
            "cancel_at_period_end": subscription.cancel_at_period_end,
        }
    except stripe.error.StripeError as e:
        return {
            "user_id": user_id,
            "tier": tier,
            "status": "unknown",
            "stripe_connected": True,
            "error": str(e)
        }


@router.get("/health")
async def stripe_health_check():
    """
    Health check endpoint for Stripe configuration.
    Returns status of all required configuration.
    """
    return {
        "stripe_configured": bool(STRIPE_SECRET_KEY),
        "webhook_configured": bool(STRIPE_WEBHOOK_SECRET),
        "frontend_url": FRONTEND_URL,
        "price_ids_configured": bool(PRICE_IDS.get("pro_monthly")),
    }


class PortalRequest(BaseModel):
    """Request body for creating a portal session."""
    user_id: str


@router.post("/portal")
@limiter.limit("10/minute")
async def create_portal_session(request: Request, portal_request: PortalRequest):
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
    
    # Look up customer_id from Supabase using user_id
    profile = get_user_profile(portal_request.user_id)
    
    if not profile:
        raise HTTPException(
            status_code=404,
            detail={"error": "User profile not found", "code": "USER_NOT_FOUND"}
        )
    
    customer_id = profile.get("stripe_customer_id")
    
    if not customer_id:
        raise HTTPException(
            status_code=400,
            detail={"error": "No Stripe customer found for this user", "code": "NO_STRIPE_CUSTOMER"}
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


class SyncRequest(BaseModel):
    """Request body for syncing subscription from Stripe."""
    user_id: str


@router.post("/sync")
@limiter.limit("5/minute")
async def sync_subscription(request: Request, sync_request: SyncRequest):
    """
    Sync a user's subscription status from Stripe.
    
    Use this when:
    - Webhook failed to update subscription
    - User reports subscription not showing
    - Manual recovery needed
    
    Returns the synced subscription status.
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail={"error": "Payment service not configured", "code": "SERVICE_UNAVAILABLE"}
        )
    
    profile = get_user_profile(sync_request.user_id)
    
    if not profile:
        raise HTTPException(
            status_code=404,
            detail={"error": "User profile not found", "code": "USER_NOT_FOUND"}
        )
    
    customer_id = profile.get("stripe_customer_id")
    current_tier = profile.get("subscription_tier", "free")
    
    # If no customer_id, try to find by email
    if not customer_id and profile.get("email"):
        try:
            customers = stripe.Customer.list(email=profile["email"], limit=1)
            if customers.data:
                customer_id = customers.data[0].id
                # Store the customer ID for future use
                update_user_subscription(
                    user_id=sync_request.user_id,
                    tier=current_tier,
                    stripe_customer_id=customer_id
                )
        except stripe.error.StripeError:
            pass
    
    if not customer_id:
        return {
            "user_id": sync_request.user_id,
            "synced": False,
            "tier": "free",
            "message": "No Stripe customer found. User may not have subscribed yet."
        }
    
    try:
        # Get active subscriptions for this customer
        subscriptions = stripe.Subscription.list(
            customer=customer_id,
            status="active",
            limit=1
        )
        
        if subscriptions.data:
            sub = subscriptions.data[0]
            # Determine tier from price metadata or default to pro
            tier = sub.get("metadata", {}).get("tier", "pro")
            
            # Update the user's subscription in Supabase
            update_user_subscription(
                user_id=sync_request.user_id,
                tier=tier,
                stripe_customer_id=customer_id,
                stripe_subscription_id=sub.id
            )
            
            return {
                "user_id": sync_request.user_id,
                "synced": True,
                "tier": tier,
                "subscription_id": sub.id,
                "status": sub.status,
                "message": f"Subscription synced successfully. Tier updated to {tier}."
            }
        else:
            # No active subscription - set to free
            update_user_subscription(
                user_id=sync_request.user_id,
                tier="free"
            )
            
            return {
                "user_id": sync_request.user_id,
                "synced": True,
                "tier": "free",
                "message": "No active subscription found. Tier set to free."
            }
            
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": str(e), "code": "STRIPE_ERROR"}
        )
