"""
Email Service for Kingshot Atlas

Uses Resend for transactional emails.
Set RESEND_API_KEY environment variable to enable.

Email Types:
- Welcome email on subscription start
- Renewal reminder 3 days before billing
- Cancellation confirmation
- Payment failed alert
"""
import os
from typing import Optional
import httpx

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FROM_EMAIL = os.getenv("FROM_EMAIL", "Atlas <noreply@ks-atlas.com>")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://ks-atlas.com")


def is_email_configured() -> bool:
    """Check if email service is configured."""
    return bool(RESEND_API_KEY)


async def send_email(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None
) -> bool:
    """
    Send an email via Resend API.
    
    Args:
        to: Recipient email
        subject: Email subject
        html: HTML content
        text: Plain text fallback (optional)
        
    Returns:
        True if sent successfully
    """
    if not RESEND_API_KEY:
        print(f"Email not configured. Would send to {to}: {subject}")
        return False
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": FROM_EMAIL,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                    "text": text or subject
                }
            )
            
            if response.status_code == 200:
                print(f"Email sent to {to}: {subject}")
                return True
            else:
                print(f"Email failed ({response.status_code}): {response.text}")
                return False
                
    except Exception as e:
        print(f"Email error: {e}")
        return False


# Email Templates

def get_welcome_email(username: str, tier: str) -> tuple[str, str]:
    """Generate welcome email for new subscribers."""
    tier_name = "Pro" if tier == "pro" else "Recruiter"
    
    subject = f"🎉 Welcome to Atlas {tier_name}!"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #111; border-radius: 12px; padding: 30px; }}
            .header {{ text-align: center; margin-bottom: 30px; }}
            .logo {{ font-size: 32px; font-weight: bold; color: #22d3ee; }}
            h1 {{ color: #22d3ee; margin: 0 0 10px; }}
            p {{ color: #9ca3af; line-height: 1.6; }}
            .tier-badge {{ display: inline-block; padding: 8px 16px; background: {'#a855f720' if tier == 'recruiter' else '#22d3ee20'}; color: {'#a855f7' if tier == 'recruiter' else '#22d3ee'}; border-radius: 20px; font-weight: 600; margin: 20px 0; }}
            .cta {{ display: inline-block; padding: 12px 24px; background: #22d3ee; color: #000; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }}
            .features {{ background: #1a1a1a; border-radius: 8px; padding: 20px; margin: 20px 0; }}
            .feature {{ display: flex; align-items: center; gap: 10px; margin: 10px 0; color: #fff; }}
            .check {{ color: #22c55e; }}
            .footer {{ text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">⚔️ ATLAS</div>
            </div>
            
            <h1>Welcome, {username}!</h1>
            <p>Thank you for upgrading to Atlas. You now have access to premium features that will help you dominate KvK.</p>
            
            <div class="tier-badge">✨ Atlas {tier_name}</div>
            
            <div class="features">
                <div class="feature"><span class="check">✓</span> Unlimited kingdom comparisons</div>
                <div class="feature"><span class="check">✓</span> Advanced analytics & filters</div>
                <div class="feature"><span class="check">✓</span> Priority support</div>
                {'<div class="feature"><span class="check">✓</span> Recruiter tools & alliance insights</div>' if tier == 'recruiter' else ''}
            </div>
            
            <p>Start exploring your new features:</p>
            <a href="{FRONTEND_URL}/upgrade" class="cta">View Your Benefits →</a>
            
            <div class="footer">
                <p>Questions? Reply to this email or contact support@ks-atlas.com</p>
                <p>Stop guessing. Start winning.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return subject, html


def get_renewal_reminder_email(username: str, tier: str, days_until: int, amount: str) -> tuple[str, str]:
    """Generate renewal reminder email."""
    tier_name = "Pro" if tier == "pro" else "Recruiter"
    
    subject = f"⏰ Your Atlas {tier_name} renews in {days_until} days"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #111; border-radius: 12px; padding: 30px; }}
            .header {{ text-align: center; margin-bottom: 30px; }}
            .logo {{ font-size: 32px; font-weight: bold; color: #22d3ee; }}
            h1 {{ color: #fff; margin: 0 0 10px; }}
            p {{ color: #9ca3af; line-height: 1.6; }}
            .amount {{ font-size: 24px; font-weight: bold; color: #22d3ee; }}
            .cta {{ display: inline-block; padding: 12px 24px; background: #22d3ee; color: #000; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }}
            .secondary {{ display: inline-block; padding: 12px 24px; background: transparent; color: #9ca3af; text-decoration: none; border: 1px solid #333; border-radius: 8px; margin-top: 10px; }}
            .footer {{ text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">⚔️ ATLAS</div>
            </div>
            
            <h1>Renewal Reminder</h1>
            <p>Hey {username}, your Atlas {tier_name} subscription will automatically renew in <strong>{days_until} days</strong>.</p>
            
            <p class="amount">{amount}</p>
            
            <p>No action needed if you want to continue. Your premium features will continue uninterrupted.</p>
            
            <a href="{FRONTEND_URL}/profile" class="cta">Manage Subscription</a>
            
            <div class="footer">
                <p>Want to cancel? You can do so anytime from your profile page.</p>
                <p>Questions? Contact support@ks-atlas.com</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return subject, html


def get_cancellation_email(username: str, tier: str) -> tuple[str, str]:
    """Generate cancellation confirmation email."""
    tier_name = "Pro" if tier == "pro" else "Recruiter"
    
    subject = f"😢 Your Atlas {tier_name} has been cancelled"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #111; border-radius: 12px; padding: 30px; }}
            .header {{ text-align: center; margin-bottom: 30px; }}
            .logo {{ font-size: 32px; font-weight: bold; color: #22d3ee; }}
            h1 {{ color: #fff; margin: 0 0 10px; }}
            p {{ color: #9ca3af; line-height: 1.6; }}
            .cta {{ display: inline-block; padding: 12px 24px; background: #22d3ee; color: #000; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }}
            .winback {{ background: #1e3a5f20; border: 1px solid #22d3ee30; border-radius: 8px; padding: 20px; margin: 20px 0; }}
            .footer {{ text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">⚔️ ATLAS</div>
            </div>
            
            <h1>We're sorry to see you go</h1>
            <p>Hey {username}, your Atlas {tier_name} subscription has been cancelled. You'll continue to have access until the end of your current billing period.</p>
            
            <p>After that, you'll be switched to the free tier with limited features.</p>
            
            <div class="winback">
                <p style="color: #22d3ee; margin: 0 0 10px; font-weight: 600;">Changed your mind?</p>
                <p style="margin: 0;">You can resubscribe anytime to get your premium features back.</p>
            </div>
            
            <a href="{FRONTEND_URL}/upgrade" class="cta">Resubscribe →</a>
            
            <div class="footer">
                <p>We'd love to hear your feedback. What could we have done better?</p>
                <p>Reply to this email or contact support@ks-atlas.com</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return subject, html


def get_payment_failed_email(username: str, tier: str) -> tuple[str, str]:
    """Generate payment failed alert email."""
    tier_name = "Pro" if tier == "pro" else "Recruiter"
    
    subject = f"⚠️ Payment failed for Atlas {tier_name}"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #111; border-radius: 12px; padding: 30px; }}
            .header {{ text-align: center; margin-bottom: 30px; }}
            .logo {{ font-size: 32px; font-weight: bold; color: #22d3ee; }}
            .alert {{ background: #ef444420; border: 1px solid #ef444450; border-radius: 8px; padding: 20px; margin: 20px 0; }}
            h1 {{ color: #ef4444; margin: 0 0 10px; }}
            p {{ color: #9ca3af; line-height: 1.6; }}
            .cta {{ display: inline-block; padding: 12px 24px; background: #22d3ee; color: #000; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }}
            .footer {{ text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">⚔️ ATLAS</div>
            </div>
            
            <div class="alert">
                <h1>Payment Failed</h1>
                <p style="color: #fff; margin: 0;">We couldn't process your payment for Atlas {tier_name}.</p>
            </div>
            
            <p>Hey {username}, your recent payment didn't go through. This could be due to:</p>
            <ul style="color: #9ca3af;">
                <li>Expired card</li>
                <li>Insufficient funds</li>
                <li>Bank security block</li>
            </ul>
            
            <p>Please update your payment method to keep your premium features:</p>
            
            <a href="{FRONTEND_URL}/profile" class="cta">Update Payment Method</a>
            
            <div class="footer">
                <p>We'll retry the payment automatically in a few days.</p>
                <p>Questions? Contact support@ks-atlas.com</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return subject, html


# High-level email functions

async def send_welcome_email(email: str, username: str, tier: str) -> bool:
    """Send welcome email to new subscriber."""
    subject, html = get_welcome_email(username or "Champion", tier)
    return await send_email(email, subject, html)


async def send_renewal_reminder(email: str, username: str, tier: str, days_until: int, amount: str) -> bool:
    """Send renewal reminder email."""
    subject, html = get_renewal_reminder_email(username or "Champion", tier, days_until, amount)
    return await send_email(email, subject, html)


async def send_cancellation_email(email: str, username: str, tier: str) -> bool:
    """Send cancellation confirmation email."""
    subject, html = get_cancellation_email(username or "Champion", tier)
    return await send_email(email, subject, html)


async def send_payment_failed_email(email: str, username: str, tier: str) -> bool:
    """Send payment failed alert email."""
    subject, html = get_payment_failed_email(username or "Champion", tier)
    return await send_email(email, subject, html)
