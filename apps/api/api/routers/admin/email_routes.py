"""
Admin email system endpoints.

Support inbox, send email, templates, churn alerts, weekly digest.
"""
import os
import logging
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone

from api.config import RESEND_API_KEY
from api.supabase_client import get_supabase_admin
from ._shared import require_admin, audit_log

logger = logging.getLogger("atlas.admin")

router = APIRouter()

SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "support@ks-atlas.com")


class EmailSendRequest(BaseModel):
    to: str
    subject: str
    body_text: str
    body_html: Optional[str] = None
    in_reply_to: Optional[str] = None


@router.get("/email/inbox")
async def get_email_inbox(
    status: Optional[str] = None,
    direction: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Get emails from the support inbox. Supports search on subject + body."""
    require_admin(x_admin_key, authorization)
    
    client = get_supabase_admin()
    if not client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        query = client.table("support_emails").select("*").order("created_at", desc=True).limit(limit)
        if status and status != "all":
            query = query.eq("status", status)
        if direction and direction != "all":
            query = query.eq("direction", direction)
        if search:
            query = query.or_(f"subject.ilike.%{search}%,body_text.ilike.%{search}%,from_email.ilike.%{search}%")
        
        result = query.execute()
        
        # Count unread
        unread_result = client.table("support_emails").select("id", count="exact").eq("status", "unread").eq("direction", "inbound").execute()
        
        return {
            "emails": result.data or [],
            "total": len(result.data or []),
            "unread": unread_result.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/email/send")
async def send_email(
    payload: EmailSendRequest,
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Send an email via Resend and store in outbox."""
    require_admin(x_admin_key, authorization)
    
    client = get_supabase_admin()
    if not client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    email_record = {
        "direction": "outbound",
        "from_email": SUPPORT_EMAIL,
        "to_email": payload.to,
        "subject": payload.subject,
        "body_text": payload.body_text,
        "body_html": payload.body_html,
        "status": "sent",
        "in_reply_to": payload.in_reply_to,
        "thread_id": payload.in_reply_to,  # Group with parent
    }
    
    # Send via Resend if configured
    if RESEND_API_KEY:
        import httpx
        try:
            async with httpx.AsyncClient() as http:
                resend_payload = {
                    "from": f"Kingshot Atlas <{SUPPORT_EMAIL}>",
                    "to": [payload.to],
                    "subject": payload.subject,
                    "text": payload.body_text,
                }
                if payload.body_html:
                    resend_payload["html"] = payload.body_html
                
                resp = await http.post(
                    "https://api.resend.com/emails",
                    json=resend_payload,
                    headers={"Authorization": f"Bearer {RESEND_API_KEY}"}
                )
                
                if resp.status_code not in (200, 201):
                    email_record["status"] = "failed"
                    email_record["metadata"] = {"error": resp.text}
                else:
                    resp_data = resp.json()
                    email_record["metadata"] = {"resend_id": resp_data.get("id")}
                    
        except Exception as e:
            email_record["status"] = "failed"
            email_record["metadata"] = {"error": str(e)}
    else:
        email_record["status"] = "failed"
        email_record["metadata"] = {"error": "RESEND_API_KEY not configured"}
    
    # Store in Supabase
    try:
        result = client.table("support_emails").insert(email_record).execute()
        
        # If replying, mark original as replied
        if payload.in_reply_to:
            client.table("support_emails").update({"status": "replied"}).eq("id", payload.in_reply_to).execute()
        
        audit_log("email_sent", "email", payload.to, {"subject": payload.subject, "status": email_record["status"]})
        
        return {
            "success": email_record["status"] == "sent",
            "status": email_record["status"],
            "email": result.data[0] if result.data else None,
            "error": email_record.get("metadata", {}).get("error")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/email/{email_id}/read")
async def mark_email_read(
    email_id: str,
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Mark an email as read."""
    require_admin(x_admin_key, authorization)
    
    client = get_supabase_admin()
    if not client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        result = client.table("support_emails").update({"status": "read"}).eq("id", email_id).execute()
        return {"success": True, "email": result.data[0] if result.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/email/{email_id}")
async def delete_email(
    email_id: str,
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Delete an email from the support inbox."""
    require_admin(x_admin_key, authorization)
    
    client = get_supabase_admin()
    if not client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        result = client.table("support_emails").delete().eq("id", email_id).execute()
        return {"success": True, "deleted": bool(result.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/email/stats")
async def get_email_stats(
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Get email inbox statistics with response time tracking (S3.1)."""
    require_admin(x_admin_key, authorization)
    
    client = get_supabase_admin()
    if not client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    try:
        all_emails = client.table("support_emails").select("direction, status, created_at, in_reply_to, thread_id").execute()
        emails = all_emails.data or []
        
        inbound = [e for e in emails if e["direction"] == "inbound"]
        outbound = [e for e in emails if e["direction"] == "outbound"]
        
        # S3.1: Calculate average response time (inbound → first reply)
        avg_response_minutes = None
        if inbound and outbound:
            response_times = []
            inbound_by_thread = {}
            for e in inbound:
                tid = e.get("thread_id") or e.get("id", "")
                if tid and tid not in inbound_by_thread:
                    inbound_by_thread[tid] = e["created_at"]
            for e in outbound:
                tid = e.get("thread_id")
                if tid and tid in inbound_by_thread:
                    try:
                        inbound_time = datetime.fromisoformat(inbound_by_thread[tid].replace("Z", "+00:00"))
                        reply_time = datetime.fromisoformat(e["created_at"].replace("Z", "+00:00"))
                        diff = (reply_time - inbound_time).total_seconds() / 60
                        if diff > 0:
                            response_times.append(diff)
                    except Exception:
                        pass
            if response_times:
                avg_response_minutes = round(sum(response_times) / len(response_times), 1)
        
        return {
            "total": len(emails),
            "inbound": len(inbound),
            "outbound": len(outbound),
            "unread": len([e for e in inbound if e["status"] == "unread"]),
            "sent": len([e for e in outbound if e["status"] == "sent"]),
            "failed": len([e for e in emails if e["status"] == "failed"]),
            "avg_response_minutes": avg_response_minutes,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- S1.5: Canned Responses CRUD ---

@router.get("/email/templates")
async def get_canned_responses(
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Get all canned email response templates."""
    require_admin(x_admin_key, authorization)
    client = get_supabase_admin()
    if not client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        result = client.table("canned_responses").select("*").order("usage_count", desc=True).execute()
        return {"templates": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/email/templates")
async def create_canned_response(
    payload: dict,
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Create a new canned response template."""
    require_admin(x_admin_key, authorization)
    client = get_supabase_admin()
    if not client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        data = {
            "label": payload.get("label", ""),
            "subject": payload.get("subject", ""),
            "body": payload.get("body", ""),
            "tags": payload.get("tags", []),
        }
        result = client.table("canned_responses").insert(data).execute()
        return {"success": True, "template": result.data[0] if result.data else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/email/templates/{template_id}")
async def delete_canned_response(
    template_id: str,
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Delete a canned response template."""
    require_admin(x_admin_key, authorization)
    client = get_supabase_admin()
    if not client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        client.table("canned_responses").delete().eq("id", template_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/email/templates/{template_id}/use")
async def increment_template_usage(
    template_id: str,
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Increment usage count when a template is used."""
    require_admin(x_admin_key, authorization)
    client = get_supabase_admin()
    if not client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        current = client.table("canned_responses").select("usage_count").eq("id", template_id).execute()
        count = (current.data[0]["usage_count"] if current.data else 0) + 1
        client.table("canned_responses").update({"usage_count": count}).eq("id", template_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- S3.2: Subscriber Churn Tracking ---

@router.get("/churn-alerts")
async def get_churn_alerts(
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Get recent subscription cancellations from webhook events."""
    require_admin(x_admin_key, authorization)
    client = get_supabase_admin()
    if not client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    try:
        # Check webhook_events for subscription cancellation events
        result = client.table("webhook_events").select("*").in_("event_type", [
            "customer.subscription.deleted",
            "customer.subscription.updated"
        ]).order("created_at", desc=True).limit(20).execute()
        
        cancellations = []
        for event in (result.data or []):
            payload = event.get("payload", {})
            sub_data = payload.get("data", {}).get("object", {})
            if event["event_type"] == "customer.subscription.deleted" or sub_data.get("cancel_at_period_end"):
                cancellations.append({
                    "event_id": event.get("event_id"),
                    "customer_id": event.get("customer_id") or sub_data.get("customer"),
                    "canceled_at": event.get("created_at"),
                    "reason": sub_data.get("cancellation_details", {}).get("reason", "unknown"),
                })
        
        return {"cancellations": cancellations, "total": len(cancellations)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- S3.3: Weekly Digest Email ---

@router.post("/email/weekly-digest")
async def send_weekly_digest(
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
    """Compile and send a weekly admin digest email summarizing key metrics."""
    require_admin(x_admin_key, authorization)
    
    client = get_supabase_admin()
    if not client:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY not configured")
    
    try:
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        
        # Gather weekly stats
        new_users = client.table("profiles").select("id", count="exact").gte("created_at", week_ago).execute()
        new_feedback = client.table("feedback").select("id", count="exact").gte("created_at", week_ago).execute()
        pending_corrections = client.table("kvk_corrections").select("id", count="exact").eq("status", "pending").execute()
        unread_emails = client.table("support_emails").select("id", count="exact").eq("status", "unread").eq("direction", "inbound").execute()
        
        # Build digest body
        body = f"""Weekly Admin Digest — {datetime.now(timezone.utc).strftime('%b %d, %Y')}

New Users (7d): {new_users.count or 0}
New Feedback (7d): {new_feedback.count or 0}
Pending Corrections: {pending_corrections.count or 0}
Unread Emails: {unread_emails.count or 0}

— Kingshot Atlas Admin"""

        import httpx
        async with httpx.AsyncClient() as http:
            res = await http.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
                json={
                    "from": "Kingshot Atlas <support@ks-atlas.com>",
                    "to": ["support@ks-atlas.com"],
                    "subject": f"Weekly Digest — {datetime.now(timezone.utc).strftime('%b %d')}",
                    "text": body,
                }
            )
        
        if res.status_code in (200, 201):
            return {"success": True, "message": "Weekly digest sent"}
        else:
            return {"success": False, "error": res.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
