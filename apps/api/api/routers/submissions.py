import os
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime
import secrets
from jose import jwt, JWTError

from database import get_db
from models import KVKSubmission, KVKRecord, Kingdom, KingdomClaim, User
from slowapi import Limiter
from slowapi.util import get_remote_address
from schemas import (
    KVKSubmissionCreate, KVKSubmission as KVKSubmissionSchema,
    SubmissionReview, KingdomClaimCreate, KingdomClaimUpdate,
    KingdomClaim as KingdomClaimSchema
)

# Supabase JWT configuration for secure user ID extraction
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SUPABASE_ISSUER = os.getenv("SUPABASE_URL", "").rstrip("/") + "/auth/v1"

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def _recalculate_kingdom_stats(kingdom: Kingdom, db: Session) -> None:
    """Recalculate aggregate stats for a kingdom based on all its KVK records."""
    records = db.query(KVKRecord).filter(
        KVKRecord.kingdom_number == kingdom.kingdom_number
    ).order_by(KVKRecord.kvk_number.desc()).all()
    
    if not records:
        return
    
    # Count wins/losses
    prep_wins = sum(1 for r in records if r.prep_result == 'W')
    prep_losses = sum(1 for r in records if r.prep_result == 'L')
    battle_wins = sum(1 for r in records if r.battle_result == 'W')
    battle_losses = sum(1 for r in records if r.battle_result == 'L')
    
    total_kvks = len(records)
    
    # Calculate win rates
    kingdom.prep_wins = prep_wins
    kingdom.prep_losses = prep_losses
    kingdom.prep_win_rate = prep_wins / total_kvks if total_kvks > 0 else 0.0
    
    kingdom.battle_wins = battle_wins
    kingdom.battle_losses = battle_losses
    kingdom.battle_win_rate = battle_wins / total_kvks if total_kvks > 0 else 0.0
    
    kingdom.total_kvks = total_kvks
    
    # Calculate current streaks (from most recent records)
    prep_streak = 0
    for r in records:  # Already sorted desc by kvk_number
        if r.prep_result == 'W':
            prep_streak += 1
        else:
            break
    kingdom.prep_streak = prep_streak
    
    battle_streak = 0
    for r in records:
        if r.battle_result == 'W':
            battle_streak += 1
        else:
            break
    kingdom.battle_streak = battle_streak
    
    # Count dominations (W+W) and defeats (L+L)
    kingdom.dominations = sum(1 for r in records if r.prep_result == 'W' and r.battle_result == 'W')
    kingdom.defeats = sum(1 for r in records if r.prep_result == 'L' and r.battle_result == 'L')
    
    # Recalculate overall score (prep:battle = 1:2 weighting)
    kingdom.overall_score = round((kingdom.prep_win_rate + 2 * kingdom.battle_win_rate) / 3 * 15, 2)
    
    kingdom.last_updated = datetime.utcnow()


def verify_supabase_jwt(token: str) -> Optional[str]:
    """
    Validate Supabase JWT token and extract user ID.
    Returns user_id (sub claim) if valid, None otherwise.
    
    Security: This validates the JWT signature if SUPABASE_JWT_SECRET is set.
    In development without the secret, it will decode without verification (less secure).
    """
    if not token:
        return None
    
    try:
        # Remove "Bearer " prefix if present
        if token.startswith("Bearer "):
            token = token[7:]
        
        if SUPABASE_JWT_SECRET:
            # Production: Verify JWT signature
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}  # Supabase doesn't always set audience
            )
        else:
            # Development fallback: Decode without verification (log warning)
            import logging
            logging.warning("SUPABASE_JWT_SECRET not set - JWT signature not verified!")
            payload = jwt.decode(token, options={"verify_signature": False})
        
        # Extract user ID from 'sub' claim
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        return user_id
    except JWTError as e:
        import logging
        logging.warning(f"JWT validation failed: {e}")
        return None


def verify_moderator_role(user_id: str, db: Session) -> bool:
    """Verify user has moderator or admin role. Returns True if authorized."""
    if not user_id:
        return False
    
    # Query by Supabase UUID (string) - check profiles or users table
    # For now, we check the local User table
    try:
        # Try as integer ID first (legacy support)
        if user_id.isdigit():
            user = db.query(User).filter(User.id == int(user_id)).first()
        else:
            # UUID from Supabase - would need profiles table lookup
            # For now, return False as we can't verify UUID against local User table
            return False
        
        if user and user.role in ['moderator', 'admin']:
            return True
    except Exception:
        pass
    
    return False


def verify_admin_role(user_id: str, db: Session) -> bool:
    """Verify user has admin role. Returns True if authorized."""
    if not user_id:
        return False
    
    try:
        if user_id.isdigit():
            user = db.query(User).filter(User.id == int(user_id)).first()
        else:
            return False
        
        if user and user.role == 'admin':
            return True
    except Exception:
        pass
    
    return False


def get_verified_user_id(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id")
) -> Optional[str]:
    """
    Securely extract user ID from request.
    
    Priority:
    1. If Authorization header contains valid JWT, extract user_id from token
    2. If no valid JWT but X-User-Id provided, use it (development only with warning)
    
    Security: Always prefer JWT validation over trusting X-User-Id header.
    """
    # Try JWT validation first (most secure)
    if authorization:
        jwt_user_id = verify_supabase_jwt(authorization)
        if jwt_user_id:
            return jwt_user_id
    
    # Fallback to X-User-Id header (less secure, for development)
    if x_user_id:
        if SUPABASE_JWT_SECRET:
            # In production (secret is set), don't trust unverified headers
            import logging
            logging.warning("X-User-Id header rejected - use Authorization with valid JWT")
            return None
        else:
            # Development mode - allow but log warning
            import logging
            logging.warning("Using unverified X-User-Id header - development mode only!")
            return x_user_id
    
    return None


# ==================== SUBMISSIONS ====================

@router.post("/submissions", response_model=KVKSubmissionSchema)
def create_submission(
    submission: KVKSubmissionCreate,
    db: Session = Depends(get_db),
    verified_user_id: Optional[str] = Depends(get_verified_user_id),
    user_name: Optional[str] = Header(None, alias="X-User-Name")
):
    """Submit a KVK result for moderation"""
    # Require authenticated user
    if not verified_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    user_id = verified_user_id
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
    db: Session = Depends(get_db),
    verified_user_id: Optional[str] = Depends(get_verified_user_id)
):
    """Get current user's submissions"""
    if not verified_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return db.query(KVKSubmission).filter(
        KVKSubmission.submitter_id == verified_user_id
    ).order_by(desc(KVKSubmission.created_at)).all()


@router.post("/submissions/{submission_id}/review")
def review_submission(
    submission_id: int,
    review: SubmissionReview,
    db: Session = Depends(get_db),
    verified_user_id: Optional[str] = Depends(get_verified_user_id)
):
    """Approve or reject a submission (moderators only)"""
    if not verified_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    reviewer_id = verified_user_id
    # Authorization check - only moderators/admins can review
    if not verify_moderator_role(reviewer_id, db):
        raise HTTPException(
            status_code=403,
            detail="Moderator or admin role required to review submissions"
        )
    submission = db.query(KVKSubmission).filter(KVKSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if review.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")
    
    submission.status = review.status
    submission.reviewed_by = reviewer_id
    submission.review_notes = review.review_notes
    submission.reviewed_at = datetime.utcnow()
    
    # If approved, create the actual KVK record and update kingdom stats
    if review.status == "approved":
        # Calculate overall result - use W/L format to match existing data
        # W = won overall (battle win takes priority), L = lost overall
        overall_result = "W" if submission.battle_result == "W" else "L"
        
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
        
        # CRITICAL: Recalculate kingdom aggregate stats after adding new KVK record
        kingdom = db.query(Kingdom).filter(Kingdom.kingdom_number == submission.kingdom_number).first()
        if kingdom:
            _recalculate_kingdom_stats(kingdom, db)
    
    db.commit()
    return {"message": f"Submission {review.status}", "submission_id": submission_id}


# ==================== KINGDOM CLAIMS ====================

@router.post("/claims", response_model=KingdomClaimSchema)
@limiter.limit("5/hour")
def create_claim(
    request: Request,
    claim: KingdomClaimCreate,
    db: Session = Depends(get_db),
    verified_user_id: Optional[str] = Depends(get_verified_user_id)
):
    """Claim a kingdom as its manager. Rate limited: 5/hour"""
    if not verified_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    user_id = verified_user_id
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
    db: Session = Depends(get_db),
    verified_user_id: Optional[str] = Depends(get_verified_user_id)
):
    """Get current user's kingdom claims"""
    if not verified_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return db.query(KingdomClaim).filter(KingdomClaim.user_id == verified_user_id).all()


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
    db: Session = Depends(get_db),
    verified_user_id: Optional[str] = Depends(get_verified_user_id)
):
    """Update kingdom customization (premium feature)"""
    if not verified_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    claim = db.query(KingdomClaim).filter(
        KingdomClaim.kingdom_number == kingdom_number,
        KingdomClaim.user_id == verified_user_id
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
    db: Session = Depends(get_db),
    verified_user_id: Optional[str] = Depends(get_verified_user_id)
):
    """Verify a kingdom claim (admin only)"""
    if not verified_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    reviewer_id = verified_user_id
    # Authorization check - only admins can verify claims
    if not verify_admin_role(reviewer_id, db):
        raise HTTPException(
            status_code=403,
            detail="Admin role required to verify kingdom claims"
        )
    claim = db.query(KingdomClaim).filter(KingdomClaim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    claim.status = "verified"
    claim.verified_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Claim verified", "kingdom_number": claim.kingdom_number}
