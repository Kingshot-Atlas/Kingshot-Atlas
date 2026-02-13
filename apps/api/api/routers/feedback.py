"""
Feedback API Router
Handles user feedback submission and retrieval
"""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import os

logger = logging.getLogger("atlas.feedback")

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

# Try to import supabase client
try:
    from ..supabase_client import get_supabase_admin
except ImportError:
    get_supabase_admin = None


class FeedbackSubmission(BaseModel):
    type: str  # 'bug', 'feature', 'general'
    message: str
    email: Optional[str] = None
    user_id: Optional[str] = None
    page_url: Optional[str] = None
    user_agent: Optional[str] = None


class FeedbackResponse(BaseModel):
    success: bool
    message: str
    id: Optional[str] = None


@router.post("", response_model=FeedbackResponse)
async def submit_feedback(feedback: FeedbackSubmission):
    """Submit user feedback"""
    
    # Validate feedback type
    if feedback.type not in ['bug', 'feature', 'general']:
        raise HTTPException(status_code=400, detail="Invalid feedback type")
    
    # Validate message
    if not feedback.message or len(feedback.message.strip()) < 5:
        raise HTTPException(status_code=400, detail="Feedback message too short")
    
    if len(feedback.message) > 5000:
        raise HTTPException(status_code=400, detail="Feedback message too long")
    
    # Try to store in Supabase
    if get_supabase_admin:
        try:
            supabase = get_supabase_admin()
            if supabase:
                result = supabase.table('feedback').insert({
                    'type': feedback.type,
                    'message': feedback.message.strip(),
                    'email': feedback.email,
                    'user_id': feedback.user_id,
                    'page_url': feedback.page_url,
                    'user_agent': feedback.user_agent,
                    'status': 'new'
                }).execute()
                
                if result.data:
                    return FeedbackResponse(
                        success=True,
                        message="Feedback submitted successfully",
                        id=result.data[0].get('id')
                    )
        except Exception as e:
            # Log error but don't fail - fall through to success
            logger.error("Error storing feedback in Supabase: %s", e)
    
    # If Supabase unavailable, still return success
    # (feedback could be logged elsewhere or we accept the loss)
    return FeedbackResponse(
        success=True,
        message="Feedback received"
    )


@router.get("/stats")
async def get_feedback_stats():
    """Get feedback statistics (admin only in future)"""
    
    if not get_supabase_admin:
        return {"total": 0, "by_type": {}, "by_status": {}}
    
    try:
        supabase = get_supabase_admin()
        if not supabase:
            return {"total": 0, "by_type": {}, "by_status": {}}
        
        # Get all feedback
        result = supabase.table('feedback').select('type, status').execute()
        
        if not result.data:
            return {"total": 0, "by_type": {}, "by_status": {}}
        
        # Count by type and status
        by_type = {}
        by_status = {}
        
        for item in result.data:
            t = item.get('type', 'unknown')
            s = item.get('status', 'unknown')
            by_type[t] = by_type.get(t, 0) + 1
            by_status[s] = by_status.get(s, 0) + 1
        
        return {
            "total": len(result.data),
            "by_type": by_type,
            "by_status": by_status
        }
    except Exception as e:
        logger.error("Error getting feedback stats: %s", e)
        return {"total": 0, "by_type": {}, "by_status": {}, "error": str(e)}
