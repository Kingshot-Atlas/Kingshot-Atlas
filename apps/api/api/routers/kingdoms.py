from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, asc, func
from typing import Optional, List
from collections import defaultdict
from slowapi import Limiter
from slowapi.util import get_remote_address
from database import get_db
from models import Kingdom, KVKRecord
from schemas import Kingdom as KingdomSchema, KingdomProfile, PaginatedResponse
import math

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# Whitelist of allowed sort fields to prevent information disclosure
ALLOWED_SORT_FIELDS = {
    'kingdom_number', 'overall_score', 'prep_win_rate', 'battle_win_rate',
    'total_kvks', 'prep_streak', 'battle_streak', 'dominations', 'invasions'
}

@router.get("/kingdoms", response_model=PaginatedResponse[KingdomSchema])
@limiter.limit("60/minute")
def get_kingdoms(
    request: Request,
    search: Optional[str] = Query(None, description="Search by kingdom number"),
    status: Optional[str] = Query(None, description="Filter by status"),
    min_kvks: Optional[int] = Query(None, ge=0, le=1000, description="Minimum total KVKs"),
    min_prep_wr: Optional[float] = Query(None, ge=0, le=1, description="Minimum prep win rate (0-1)"),
    min_battle_wr: Optional[float] = Query(None, ge=0, le=1, description="Minimum battle win rate (0-1)"),
    sort: Optional[str] = Query("kingdom_number", description="Sort field"),
    order: Optional[str] = Query("asc", pattern="^(asc|desc)$", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1, le=1000, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page (max 100)"),
    db: Session = Depends(get_db)
):
    query = db.query(Kingdom)
    
    # Apply filters
    if search:
        try:
            kingdom_num = int(search)
            query = query.filter(Kingdom.kingdom_number == kingdom_num)
        except ValueError:
            raise HTTPException(status_code=400, detail="Search must be a valid kingdom number")
    
    if status:
        query = query.filter(Kingdom.most_recent_status == status)
    
    if min_kvks is not None:
        query = query.filter(Kingdom.total_kvks >= min_kvks)
    
    if min_prep_wr is not None:
        query = query.filter(Kingdom.prep_win_rate >= min_prep_wr)
    
    if min_battle_wr is not None:
        query = query.filter(Kingdom.battle_win_rate >= min_battle_wr)
    
    # Get total count before pagination
    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    
    # Apply sorting - validate against whitelist to prevent information disclosure
    if sort and sort in ALLOWED_SORT_FIELDS:
        sort_column = getattr(Kingdom, sort)
        if order and order.lower() == "desc":
            query = query.order_by(desc(sort_column))
        else:
            query = query.order_by(asc(sort_column))
    else:
        query = query.order_by(asc(Kingdom.kingdom_number))
    
    # Apply pagination
    offset = (page - 1) * page_size
    kingdoms = query.offset(offset).limit(page_size).all()
    
    # Add rank based on overall_score (higher score = better rank)
    # Calculate global rank using DB query for accuracy
    for kingdom in kingdoms:
        rank = db.query(func.count(Kingdom.kingdom_number)).filter(
            Kingdom.overall_score > kingdom.overall_score
        ).scalar() + 1
        kingdom.rank = rank
    
    # OPTIMIZED: Batch fetch all KVK records in single query (fixes N+1)
    kingdom_numbers = [k.kingdom_number for k in kingdoms]
    if kingdom_numbers:
        all_kvks = db.query(KVKRecord).filter(
            KVKRecord.kingdom_number.in_(kingdom_numbers)
        ).order_by(KVKRecord.kingdom_number, desc(KVKRecord.kvk_number)).all()
        
        # Group by kingdom and limit to 5 per kingdom
        kvks_by_kingdom = defaultdict(list)
        for kvk in all_kvks:
            if len(kvks_by_kingdom[kvk.kingdom_number]) < 5:
                kvks_by_kingdom[kvk.kingdom_number].append(kvk)
        
        # Assign to kingdoms
        for kingdom in kingdoms:
            kingdom.recent_kvks = kvks_by_kingdom.get(kingdom.kingdom_number, [])
    else:
        for kingdom in kingdoms:
            kingdom.recent_kvks = []
    
    return PaginatedResponse(
        items=kingdoms,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/kingdoms/{kingdom_number}", response_model=KingdomProfile)
def get_kingdom_profile(kingdom_number: int, db: Session = Depends(get_db)):
    kingdom = db.query(Kingdom).filter(Kingdom.kingdom_number == kingdom_number).first()
    
    if not kingdom:
        raise HTTPException(status_code=404, detail="Kingdom not found")
    
    # Get ALL KVK records for profile (ordered by most recent first)
    recent_kvks = db.query(KVKRecord).filter(
        KVKRecord.kingdom_number == kingdom_number
    ).order_by(desc(KVKRecord.kvk_number)).all()
    
    # OPTIMIZED: Calculate rank with single COUNT query instead of fetching all kingdoms
    rank = db.query(func.count(Kingdom.kingdom_number)).filter(
        Kingdom.overall_score > kingdom.overall_score
    ).scalar() + 1
    
    kingdom_profile = KingdomProfile(
        **kingdom.__dict__,
        rank=rank,
        recent_kvks=recent_kvks
    )
    
    return kingdom_profile
