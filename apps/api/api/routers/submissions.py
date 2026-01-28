from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime
import secrets

from database import get_db
from models import KVKSubmission, KVKRecord, Kingdom, KingdomClaim
from schemas import (
    KVKSubmissionCreate, KVKSubmission as KVKSubmissionSchema,
    SubmissionReview, KingdomClaimCreate, KingdomClaimUpdate,
    KingdomClaim as KingdomClaimSchema
)

router = APIRouter()


def get_current_user_id(authorization: Optional[str] = Header(None)) -> Optional[str]:
    """Extract user ID from Supabase JWT token header"""
    if not authorization:
        return None
    # In production, validate the JWT and extract user_id
    # For now, we accept the user_id directly in a custom header
    return authorization.replace("Bearer ", "") if authorization else None


# ==================== SUBMISSIONS ====================

@router.post("/submissions", response_model=KVKSubmissionSchema)
def create_submission(
    submission: KVKSubmissionCreate,
    user_id: str = Header(..., alias="X-User-Id"),
    user_name: Optional[str] = Header(None, alias="X-User-Name"),
    db: Session = Depends(get_db)
):
    """Submit a KVK result for moderation"""
    # Validate prep_result and battle_result
    if submission.prep_result not in ["W", "L"]:
        raise HTTPException(status_code=400, detail="prep_result must be W or L")
    if submission.battle_result not in ["W", "L"]:
        raise HTTPException(status_code=400, detail="battle_result must be W or L")
    
    # Check if kingdom exists
    kingdom = db.query(Kingdom).filter(Kingdom.kingdom_number == submission.kingdom_number).first()
    if not kingdom:
        raise HTTPException(status_code=404, detail=f"Kingdom {submission.kingdom_number} not found")
    
    db_submission = KVKSubmission(
        submitter_id=user_id,
        submitter_name=user_name,
        kingdom_number=submission.kingdom_number,
        kvk_number=submission.kvk_number,
        opponent_kingdom=submission.opponent_kingdom,
        prep_result=submission.prep_result,
        battle_result=submission.battle_result,
        date_or_order_index=submission.date_or_order_index,
        screenshot_url=submission.screenshot_url,
        notes=submission.notes,
        status="pending"
    )
    
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    return db_submission


@router.get("/submissions", response_model=List[KVKSubmissionSchema])
def get_submissions(
    status: Optional[str] = Query(None, description="Filter by status: pending, approved, rejected"),
    kingdom_number: Optional[int] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    """Get submissions (for moderation queue)"""
    query = db.query(KVKSubmission)
    
    if status:
        query = query.filter(KVKSubmission.status == status)
    if kingdom_number:
        query = query.filter(KVKSubmission.kingdom_number == kingdom_number)
    
    query = query.order_by(desc(KVKSubmission.created_at))
    return query.offset(offset).limit(limit).all()


@router.get("/submissions/my", response_model=List[KVKSubmissionSchema])
def get_my_submissions(
    user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    """Get current user's submissions"""
    return db.query(KVKSubmission).filter(
        KVKSubmission.submitter_id == user_id
    ).order_by(desc(KVKSubmission.created_at)).all()


@router.post("/submissions/{submission_id}/review")
def review_submission(
    submission_id: int,
    review: SubmissionReview,
    reviewer_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    """Approve or reject a submission (moderators only)"""
    submission = db.query(KVKSubmission).filter(KVKSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if review.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    
    submission.status = review.status
    submission.reviewed_by = reviewer_id
    submission.review_notes = review.review_notes
    submission.reviewed_at = datetime.utcnow()
    
    # If approved, create the actual KVK record
    if review.status == "approved":
        # Calculate overall result
        if submission.prep_result == "W" and submission.battle_result == "W":
            overall_result = "Domination"
        elif submission.prep_result == "L" and submission.battle_result == "L":
            overall_result = "Defeat"
        elif submission.battle_result == "W":
            overall_result = "Battle"
        else:
            overall_result = "Prep"
        
        kvk_record = KVKRecord(
            kingdom_number=submission.kingdom_number,
            kvk_number=submission.kvk_number,
            opponent_kingdom=submission.opponent_kingdom,
            prep_result=submission.prep_result,
            battle_result=submission.battle_result,
            overall_result=overall_result,
            date_or_order_index=submission.date_or_order_index or f"Submitted {datetime.utcnow().strftime('%b %d, %Y')}"
        )
        db.add(kvk_record)
    
    db.commit()
    return {"message": f"Submission {review.status}", "submission_id": submission_id}


# ==================== KINGDOM CLAIMS ====================

@router.post("/claims", response_model=KingdomClaimSchema)
def create_claim(
    claim: KingdomClaimCreate,
    user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    """Claim a kingdom as its manager"""
    # Check if kingdom exists
    kingdom = db.query(Kingdom).filter(Kingdom.kingdom_number == claim.kingdom_number).first()
    if not kingdom:
        raise HTTPException(status_code=404, detail=f"Kingdom {claim.kingdom_number} not found")
    
    # Check if already claimed
    existing = db.query(KingdomClaim).filter(KingdomClaim.kingdom_number == claim.kingdom_number).first()
    if existing:
        if existing.user_id == user_id:
            raise HTTPException(status_code=400, detail="You already have a claim on this kingdom")
        raise HTTPException(status_code=400, detail="This kingdom has already been claimed")
    
    # Generate verification code (to be posted in kingdom chat)
    verification_code = f"ATLAS-{secrets.token_hex(4).upper()}"
    
    db_claim = KingdomClaim(
        kingdom_number=claim.kingdom_number,
        user_id=user_id,
        verification_code=verification_code,
        status="pending"
    )
    
    db.add(db_claim)
    db.commit()
    db.refresh(db_claim)
    return db_claim


@router.get("/claims/my", response_model=List[KingdomClaimSchema])
def get_my_claims(
    user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    """Get current user's kingdom claims"""
    return db.query(KingdomClaim).filter(KingdomClaim.user_id == user_id).all()


@router.get("/claims/{kingdom_number}", response_model=KingdomClaimSchema)
def get_kingdom_claim(
    kingdom_number: int,
    db: Session = Depends(get_db)
):
    """Get claim info for a kingdom (if verified)"""
    claim = db.query(KingdomClaim).filter(
        KingdomClaim.kingdom_number == kingdom_number,
        KingdomClaim.status == "verified"
    ).first()
    if not claim:
        raise HTTPException(status_code=404, detail="No verified claim for this kingdom")
    return claim


@router.put("/claims/{kingdom_number}", response_model=KingdomClaimSchema)
def update_claim(
    kingdom_number: int,
    updates: KingdomClaimUpdate,
    user_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    """Update kingdom customization (premium feature)"""
    claim = db.query(KingdomClaim).filter(
        KingdomClaim.kingdom_number == kingdom_number,
        KingdomClaim.user_id == user_id
    ).first()
    
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found or you don't own it")
    
    if claim.status != "verified":
        raise HTTPException(status_code=400, detail="Claim must be verified first")
    
    # Update fields
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(claim, field, value)
    
    db.commit()
    db.refresh(claim)
    return claim


@router.post("/claims/{claim_id}/verify")
def verify_claim(
    claim_id: int,
    reviewer_id: str = Header(..., alias="X-User-Id"),
    db: Session = Depends(get_db)
):
    """Verify a kingdom claim (admin only)"""
    claim = db.query(KingdomClaim).filter(KingdomClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    claim.status = "verified"
    claim.verified_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Claim verified", "kingdom_number": claim.kingdom_number}
