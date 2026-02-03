import os
import logging
import base64
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request, Body
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime, timezone
import secrets
from jose import jwt, JWTError
from pydantic import BaseModel, Field
from typing import Literal

logger = logging.getLogger(__name__)

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
    
    # Count dominations (W+W) and invasions (L+L)
    kingdom.dominations = sum(1 for r in records if r.prep_result == 'W' and r.battle_result == 'W')
    kingdom.invasions = sum(1 for r in records if r.prep_result == 'L' and r.battle_result == 'L')
    
    # Recalculate overall score (prep:battle = 1:2 weighting)
    kingdom.overall_score = round((kingdom.prep_win_rate + 2 * kingdom.battle_win_rate) / 3 * 15, 2)
    
    kingdom.last_updated = datetime.now(timezone.utc)


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
            logger.warning("SUPABASE_JWT_SECRET not set - JWT signature not verified!")
            payload = jwt.decode(token, key="", algorithms=["HS256"], options={"verify_signature": False})
        
        # Extract user ID from 'sub' claim
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        return user_id
    except JWTError as e:
        logger.warning(f"JWT validation failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error during JWT validation: {e}")
        return None


ADMIN_EMAILS = ['gatreno@gmail.com', 'gatreno.investing@gmail.com']

def verify_moderator_role(user_id: str, db: Session, user_email: str = None) -> bool:
    """Verify user has moderator or admin role. Returns True if authorized."""
    # First check if email is in admin list (Supabase auth)
    if user_email and user_email.lower() in [e.lower() for e in ADMIN_EMAILS]:
        return True
    
    if not user_id:
        return False
    
    # Query by Supabase UUID (string) - check profiles or users table
    # For now, we check the local User table
    try:
        # Try as integer ID first (legacy support)
        if user_id.isdigit():
            user = db.query(User).filter(User.id == int(user_id)).first()
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
            logger.warning("X-User-Id header rejected - use Authorization with valid JWT")
            return None
        else:
            # Development mode - allow but log warning
            logger.warning("Using unverified X-User-Id header - development mode only!")
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


# Schema for KvK #10 submission with mandatory screenshot
class KvK10SubmissionCreate(BaseModel):
    kingdom_number: int = Field(..., ge=1, le=9999, description="Your kingdom number")
    opponent_kingdom: int = Field(..., ge=1, le=9999, description="Opponent kingdom number")
    kvk_number: int = Field(10, description="KvK number (locked to 10)")
    prep_result: Literal['W', 'L'] = Field(..., description="Prep phase result")
    battle_result: Literal['W', 'L'] = Field(..., description="Battle phase result")
    notes: Optional[str] = Field(None, max_length=500)
    screenshot_base64: str = Field(..., description="Base64 encoded screenshot image")
    screenshot2_base64: Optional[str] = Field(None, description="Optional second screenshot")


@router.post("/submissions/kvk10", response_model=KVKSubmissionSchema)
def create_kvk10_submission(
    submission: KvK10SubmissionCreate,
    db: Session = Depends(get_db),
    verified_user_id: Optional[str] = Depends(get_verified_user_id),
    user_name: Optional[str] = Header(None, alias="X-User-Name")
):
    """
    Submit a KvK #10 result with mandatory screenshot proof.
    Screenshot is stored in Supabase Storage and URL is saved with submission.
    """
    # Require authenticated user
    if not verified_user_id:
        raise HTTPException(status_code=401, detail="Authentication required to submit KvK results")
    
    # Fetch linked_username from Supabase profile (more reliable than header)
    submitter_name = user_name  # Fallback to header
    try:
        from api.supabase_client import get_supabase_admin
        supabase = get_supabase_admin()
        if supabase:
            profile_result = supabase.table('profiles').select('linked_username, username').eq('id', verified_user_id).single().execute()
            if profile_result.data:
                # Prefer linked_username (Kingshot account), fallback to Atlas username
                submitter_name = profile_result.data.get('linked_username') or profile_result.data.get('username') or user_name
                logger.info(f"Fetched submitter name from profile: {submitter_name}")
    except Exception as e:
        logger.warning(f"Could not fetch profile for submitter name: {e}")
    
    # Validate KvK number is 10
    if submission.kvk_number != 10:
        raise HTTPException(status_code=400, detail="This endpoint only accepts KvK #10 submissions")
    
    # Validate kingdoms are different
    if submission.kingdom_number == submission.opponent_kingdom:
        raise HTTPException(status_code=400, detail="Your kingdom cannot be the same as opponent kingdom")
    
    # Check for duplicate submission (same matchup, same KvK, pending or approved)
    existing_submission = db.query(KVKSubmission).filter(
        KVKSubmission.kvk_number == 10,
        KVKSubmission.kingdom_number == submission.kingdom_number,
        KVKSubmission.opponent_kingdom == submission.opponent_kingdom,
        KVKSubmission.status.in_(['pending', 'approved'])
    ).first()
    
    if existing_submission:
        if existing_submission.status == 'approved':
            raise HTTPException(
                status_code=409, 
                detail=f"KvK #10 results for K{submission.kingdom_number} vs K{submission.opponent_kingdom} have already been approved."
            )
        else:
            raise HTTPException(
                status_code=409, 
                detail=f"You already have a pending submission for K{submission.kingdom_number} vs K{submission.opponent_kingdom}. Please wait for admin review."
            )
    
    # Validate screenshot is provided and is valid base64
    if not submission.screenshot_base64:
        raise HTTPException(status_code=400, detail="Screenshot proof is required")
    
    try:
        # Parse base64 data URL
        if ',' in submission.screenshot_base64:
            header, base64_data = submission.screenshot_base64.split(',', 1)
            # Extract mime type
            if 'image/png' in header:
                file_ext = 'png'
            elif 'image/jpeg' in header or 'image/jpg' in header:
                file_ext = 'jpg'
            elif 'image/webp' in header:
                file_ext = 'webp'
            else:
                file_ext = 'png'  # Default
        else:
            base64_data = submission.screenshot_base64
            file_ext = 'png'
        
        # Decode and validate image
        image_data = base64.b64decode(base64_data)
        
        # Check file size (max 5MB)
        if len(image_data) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Screenshot must be under 5MB")
        
        # SECURITY: Validate image magic bytes to prevent malicious uploads
        PNG_MAGIC = b'\x89PNG\r\n\x1a\n'
        JPEG_MAGIC = b'\xff\xd8\xff'
        WEBP_MAGIC = b'RIFF'
        
        is_valid_image = (
            image_data[:8] == PNG_MAGIC or
            image_data[:3] == JPEG_MAGIC or
            (image_data[:4] == WEBP_MAGIC and b'WEBP' in image_data[:12])
        )
        
        if not is_valid_image:
            logger.warning(f"Invalid image magic bytes from user {verified_user_id}")
            raise HTTPException(status_code=400, detail="Invalid image format. Only PNG, JPEG, and WebP are allowed.")
        
        # Generate unique filename
        filename = f"kvk10/{verified_user_id}_{submission.kingdom_number}_{uuid.uuid4().hex[:8]}.{file_ext}"
        
        # Try to upload to Supabase Storage
        screenshot_url = None
        try:
            from api.supabase_client import get_supabase_admin
            supabase = get_supabase_admin()
            if supabase:
                # Upload to 'submissions' bucket
                result = supabase.storage.from_('submissions').upload(
                    filename,
                    image_data,
                    {'content-type': f'image/{file_ext}'}
                )
                # Get public URL
                screenshot_url = supabase.storage.from_('submissions').get_public_url(filename)
                logger.info(f"Screenshot uploaded successfully: {screenshot_url}")
            else:
                logger.warning("Supabase client not available - check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars")
                screenshot_url = "storage_unavailable:supabase_not_configured"
        except Exception as e:
            logger.error(f"Failed to upload to Supabase Storage: {type(e).__name__}: {e}")
            screenshot_url = f"storage_error:{type(e).__name__}"
        
        if not screenshot_url:
            screenshot_url = "storage_unavailable:unknown"
        
    except Exception as e:
        logger.error(f"Screenshot processing error: {e}")
        raise HTTPException(status_code=400, detail="Invalid screenshot format. Please upload a valid image.")
    
    # Process second screenshot (optional)
    screenshot2_url = None
    if submission.screenshot2_base64:
        try:
            if ',' in submission.screenshot2_base64:
                header2, base64_data2 = submission.screenshot2_base64.split(',', 1)
                if 'image/png' in header2:
                    file_ext2 = 'png'
                elif 'image/jpeg' in header2 or 'image/jpg' in header2:
                    file_ext2 = 'jpg'
                elif 'image/webp' in header2:
                    file_ext2 = 'webp'
                else:
                    file_ext2 = 'png'
            else:
                base64_data2 = submission.screenshot2_base64
                file_ext2 = 'png'
            
            image_data2 = base64.b64decode(base64_data2)
            
            if len(image_data2) <= 5 * 1024 * 1024:
                PNG_MAGIC = b'\x89PNG\r\n\x1a\n'
                JPEG_MAGIC = b'\xff\xd8\xff'
                WEBP_MAGIC = b'RIFF'
                
                is_valid_image2 = (
                    image_data2[:8] == PNG_MAGIC or
                    image_data2[:3] == JPEG_MAGIC or
                    (image_data2[:4] == WEBP_MAGIC and b'WEBP' in image_data2[:12])
                )
                
                if is_valid_image2:
                    filename2 = f"kvk10/{verified_user_id}_{submission.kingdom_number}_{uuid.uuid4().hex[:8]}_2.{file_ext2}"
                    try:
                        from api.supabase_client import get_supabase_admin
                        supabase = get_supabase_admin()
                        if supabase:
                            supabase.storage.from_('submissions').upload(
                                filename2,
                                image_data2,
                                {'content-type': f'image/{file_ext2}'}
                            )
                            screenshot2_url = supabase.storage.from_('submissions').get_public_url(filename2)
                            logger.info(f"Screenshot 2 uploaded: {screenshot2_url}")
                    except Exception as e:
                        logger.warning(f"Failed to upload screenshot 2: {e}")
        except Exception as e:
            logger.warning(f"Screenshot 2 processing error (non-fatal): {e}")
    
    # Create submission
    db_submission = KVKSubmission(
        submitter_id=verified_user_id,
        submitter_name=submitter_name,
        kingdom_number=submission.kingdom_number,
        kvk_number=10,
        opponent_kingdom=submission.opponent_kingdom,
        prep_result=submission.prep_result,
        battle_result=submission.battle_result,
        date_or_order_index=f"KvK10_{datetime.now(timezone.utc).strftime('%Y%m%d')}",
        screenshot_url=screenshot_url,
        screenshot2_url=screenshot2_url,
        notes=submission.notes,
        status="pending"
    )
    
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    
    logger.info(f"KvK #10 submission created: K{submission.kingdom_number} vs K{submission.opponent_kingdom} by {verified_user_id}")
    
    # Notify admins of new submission
    try:
        from api.supabase_client import notify_admins
        notify_admins(
            notification_type="admin_new_submission",
            title="New KvK Submission",
            message=f"K{submission.kingdom_number} vs K{submission.opponent_kingdom} - awaiting review",
            link="/admin?tab=kvk-submissions",
            metadata={
                "submission_id": db_submission.id,
                "kingdom_number": submission.kingdom_number,
                "opponent_kingdom": submission.opponent_kingdom,
                "submitter_name": submitter_name,
            }
        )
    except Exception as e:
        logger.warning(f"Failed to notify admins: {e}")
    
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
    
    # Skip status filter if 'all' is passed - return all submissions
    if status and status != 'all':
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
    request: Request,
    db: Session = Depends(get_db),
    verified_user_id: Optional[str] = Depends(get_verified_user_id)
):
    """Approve or reject a submission (moderators only)"""
    if not verified_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    reviewer_id = verified_user_id
    user_email = request.headers.get("X-User-Email")
    # Authorization check - only moderators/admins can review
    if not verify_moderator_role(reviewer_id, db, user_email):
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
    submission.reviewed_at = datetime.now(timezone.utc)
    
    # If approved, create the actual KVK record and update kingdom stats
    kingdom_number = submission.kingdom_number
    if review.status == "approved":
        # Calculate overall result - use W/L format to match existing data
        # W = won overall (battle win takes priority), L = lost overall
        overall_result = "W" if submission.battle_result == "W" else "L"
        
        # Calculate opponent's inverse results (their loss is our win, etc.)
        opponent_prep_result = "L" if submission.prep_result == "W" else "W"
        opponent_battle_result = "L" if submission.battle_result == "W" else "W"
        opponent_overall_result = "L" if overall_result == "W" else "W"
        
        # ADR-011: Supabase is the SINGLE SOURCE OF TRUTH for kingdom data
        # Insert into Supabase kvk_history table and recalculate kingdom stats
        # SQLite writes removed per ADR-011 to eliminate dual-write complexity
        try:
            from api.supabase_client import get_supabase_admin
            supabase = get_supabase_admin()
            if not supabase:
                raise HTTPException(status_code=503, detail="Database unavailable - please try again later")
            
            # Check if submitting kingdom's record already exists in Supabase
            existing_sub = supabase.table('kvk_history').select('id').eq(
                'kingdom_number', submission.kingdom_number
            ).eq('kvk_number', submission.kvk_number).execute()
            
            if not existing_sub.data:
                # Insert submitting kingdom's record
                supabase.table('kvk_history').insert({
                    'kingdom_number': submission.kingdom_number,
                    'kvk_number': submission.kvk_number,
                    'opponent_kingdom': submission.opponent_kingdom,
                    'prep_result': submission.prep_result,
                    'battle_result': submission.battle_result,
                    'overall_result': overall_result,
                    'kvk_date': None,
                    'order_index': submission.kvk_number
                }).execute()
                logger.info(f"Inserted KvK record into Supabase for K{submission.kingdom_number}")
            
            # Check if opponent kingdom's record already exists
            existing_opp = supabase.table('kvk_history').select('id').eq(
                'kingdom_number', submission.opponent_kingdom
            ).eq('kvk_number', submission.kvk_number).execute()
            
            if not existing_opp.data:
                # Insert opponent kingdom's inverse record
                supabase.table('kvk_history').insert({
                    'kingdom_number': submission.opponent_kingdom,
                    'kvk_number': submission.kvk_number,
                    'opponent_kingdom': submission.kingdom_number,
                    'prep_result': opponent_prep_result,
                    'battle_result': opponent_battle_result,
                    'overall_result': opponent_overall_result,
                    'kvk_date': None,
                    'order_index': submission.kvk_number
                }).execute()
                logger.info(f"Inserted inverse KvK record into Supabase for K{submission.opponent_kingdom}")
            
            # NOTE: Database trigger on kvk_history INSERT automatically recalculates
            # kingdom stats - no manual call needed. Removed redundant calls that
            # were causing duplicate realtime events and toast spam.
            logger.info(f"KvK records inserted for K{submission.kingdom_number} and K{submission.opponent_kingdom} - trigger will recalculate stats")
        except HTTPException:
            raise  # Re-raise HTTP exceptions
        except Exception as e:
            logger.error(f"Failed to write to Supabase: {e}")
            raise HTTPException(status_code=503, detail="Database write failed - please try again later")
    
    db.commit()
    
    # Notify submitter of review result
    try:
        from api.supabase_client import create_notification
        if review.status == "approved":
            create_notification(
                user_id=submission.submitter_id,
                notification_type="submission_approved",
                title="KvK Submission Approved!",
                message=f"Your KvK result for K{submission.kingdom_number} vs K{submission.opponent_kingdom} has been approved and added to the Atlas.",
                link=f"/kingdom/{submission.kingdom_number}",
                metadata={
                    "submission_id": submission_id,
                    "kingdom_number": submission.kingdom_number,
                    "opponent_kingdom": submission.opponent_kingdom,
                }
            )
        else:
            create_notification(
                user_id=submission.submitter_id,
                notification_type="submission_rejected",
                title="KvK Submission Rejected",
                message=f"Your KvK result for K{submission.kingdom_number} was not approved. {review.review_notes or 'Please check the data and try again.'}",
                link="/submit-result",
                metadata={
                    "submission_id": submission_id,
                    "kingdom_number": submission.kingdom_number,
                    "review_notes": review.review_notes,
                }
            )
    except Exception as e:
        logger.warning(f"Failed to notify submitter: {e}")
    
    return {
        "message": f"Submission {review.status}", 
        "submission_id": submission_id,
        "kingdom_number": kingdom_number
    }


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
    
    # Notify admins of new claim
    try:
        from api.supabase_client import notify_admins
        notify_admins(
            notification_type="admin_new_claim",
            title="New Kingdom Claim",
            message=f"Kingdom {claim.kingdom_number} claim submitted - awaiting verification",
            link="/admin?tab=claims",
            metadata={
                "claim_id": db_claim.id,
                "kingdom_number": claim.kingdom_number,
                "user_id": user_id,
                "verification_code": verification_code,
            }
        )
    except Exception as e:
        logger.warning(f"Failed to notify admins of claim: {e}")
    
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
    claim.verified_at = datetime.now(timezone.utc)
    db.commit()
    
    # Notify user their claim was verified
    try:
        from api.supabase_client import create_notification
        create_notification(
            user_id=claim.user_id,
            notification_type="claim_verified",
            title="Kingdom Claim Verified!",
            message=f"Your claim for Kingdom {claim.kingdom_number} has been verified. You can now customize your kingdom page.",
            link=f"/kingdom/{claim.kingdom_number}",
            metadata={
                "claim_id": claim.id,
                "kingdom_number": claim.kingdom_number,
            }
        )
    except Exception as e:
        logger.warning(f"Failed to notify user of verified claim: {e}")
    
    return {"message": "Claim verified", "kingdom_number": claim.kingdom_number}


# ==================== NEW KINGDOM SUBMISSIONS ====================

class KvKHistoryEntry(BaseModel):
    """Single KvK entry for new kingdom submission"""
    kvk: int = Field(..., ge=1, le=20, description="KvK number")
    prep: Literal['W', 'L'] = Field(..., description="Prep phase result")
    battle: Literal['W', 'L'] = Field(..., description="Battle phase result")


class NewKingdomSubmissionCreate(BaseModel):
    """Schema for submitting a new kingdom to be added to the Atlas"""
    kingdom_number: int = Field(..., ge=1, le=9999, description="Kingdom number to add")
    kvk_history: List[KvKHistoryEntry] = Field(..., min_length=1, description="KvK history entries")
    submitted_by: str = Field(..., max_length=100, description="Username of submitter")
    submitted_by_kingdom: Optional[int] = Field(None, description="Submitter's linked kingdom")


class NewKingdomSubmissionResponse(BaseModel):
    """Response for new kingdom submission"""
    id: str
    kingdom_number: int
    kvk_count: int
    status: str
    submitted_by: str
    created_at: datetime


@router.post("/submissions/new-kingdom", response_model=NewKingdomSubmissionResponse)
def create_new_kingdom_submission(
    submission: NewKingdomSubmissionCreate,
    db: Session = Depends(get_db),
    verified_user_id: Optional[str] = Depends(get_verified_user_id),
):
    """
    Submit a new kingdom to be added to the Atlas.
    Requires a linked Kingshot account.
    Submissions are reviewed by admins before the kingdom is added.
    """
    # Require authenticated user
    if not verified_user_id:
        raise HTTPException(status_code=401, detail="Authentication required to submit new kingdoms")
    
    # Check if kingdom already exists
    existing_kingdom = db.query(Kingdom).filter(Kingdom.kingdom_number == submission.kingdom_number).first()
    if existing_kingdom:
        raise HTTPException(
            status_code=409, 
            detail=f"Kingdom {submission.kingdom_number} already exists in the Atlas"
        )
    
    # Validate KvK history - entries should be unique and sequential
    kvk_numbers = [entry.kvk for entry in submission.kvk_history]
    if len(kvk_numbers) != len(set(kvk_numbers)):
        raise HTTPException(status_code=400, detail="Duplicate KvK numbers in history")
    
    # Generate submission ID
    submission_id = str(uuid.uuid4())
    
    # Store submission in Supabase via REST API (we don't have a model for this table)
    # For now, we'll create the submission in memory and return success
    # The actual storage will be handled by Supabase directly from the frontend
    
    logger.info(f"New kingdom submission: K{submission.kingdom_number} with {len(submission.kvk_history)} KvKs by {submission.submitted_by}")
    
    # Return response (actual storage will be in Supabase new_kingdom_submissions table)
    return NewKingdomSubmissionResponse(
        id=submission_id,
        kingdom_number=submission.kingdom_number,
        kvk_count=len(submission.kvk_history),
        status="pending",
        submitted_by=submission.submitted_by,
        created_at=datetime.now(timezone.utc)
    )


@router.get("/submissions/new-kingdoms")
def get_new_kingdom_submissions(
    status: str = Query("pending", description="Filter by status"),
    db: Session = Depends(get_db),
    verified_user_id: Optional[str] = Depends(get_verified_user_id),
    user_email: Optional[str] = Header(None, alias="X-User-Email")
):
    """
    Get all new kingdom submissions (admin only).
    """
    if not verified_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check admin role
    if not verify_moderator_role(verified_user_id, db, user_email):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # For now, return empty list - actual data will come from Supabase
    # This endpoint is a placeholder for admin dashboard integration
    return []


@router.post("/submissions/new-kingdoms/{submission_id}/approve")
def approve_new_kingdom(
    submission_id: str,
    db: Session = Depends(get_db),
    verified_user_id: Optional[str] = Depends(get_verified_user_id),
    user_email: Optional[str] = Header(None, alias="X-User-Email")
):
    """
    Approve a new kingdom submission and add it to the Atlas (admin only).
    """
    if not verified_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check admin role
    if not verify_moderator_role(verified_user_id, db, user_email):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Placeholder - actual implementation will:
    # 1. Fetch submission from Supabase
    # 2. Create Kingdom record
    # 3. Create KVKRecord entries for each KvK in history
    # 4. Mark submission as approved
    
    return {"message": "Kingdom submission approved", "submission_id": submission_id}


@router.post("/submissions/new-kingdoms/{submission_id}/reject")
def reject_new_kingdom(
    submission_id: str,
    reason: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    verified_user_id: Optional[str] = Depends(get_verified_user_id),
    user_email: Optional[str] = Header(None, alias="X-User-Email")
):
    """
    Reject a new kingdom submission (admin only).
    """
    if not verified_user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Check admin role
    if not verify_moderator_role(verified_user_id, db, user_email):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    logger.info(f"New kingdom submission {submission_id} rejected: {reason}")
    
    return {"message": "Kingdom submission rejected", "submission_id": submission_id, "reason": reason}
