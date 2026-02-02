from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
from typing import Optional, List
from slowapi import Limiter
from slowapi.util import get_remote_address
from database import get_db
from models import Kingdom, KVKRecord
from schemas import Kingdom as KingdomSchema, KingdomProfile, PaginatedResponse
from api.supabase_client import (
    get_kingdom_from_supabase, 
    get_kvk_history_from_supabase,
    get_kingdoms_from_supabase,
    get_supabase_admin
)
import math
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# Whitelist of allowed sort fields to prevent information disclosure
ALLOWED_SORT_FIELDS = {
    'kingdom_number', 'overall_score', 'prep_win_rate', 'battle_win_rate',
    'total_kvks', 'prep_streak', 'battle_streak', 'dominations', 'invasions'
}

@router.get("/kingdoms")
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
    """ADR-011: Fetch kingdoms from Supabase (single source of truth), SQLite fallback."""
    
    # Try Supabase first (source of truth)
    try:
        supabase = get_supabase_admin()
        if supabase:
            # Build Supabase query
            query = supabase.table('kingdoms').select('*')
            
            # Apply search filter
            if search:
                try:
                    kingdom_num = int(search)
                    query = query.eq('kingdom_number', kingdom_num)
                except ValueError:
                    raise HTTPException(status_code=400, detail="Search must be a valid kingdom number")
            
            # Apply filters
            if status:
                query = query.eq('most_recent_status', status)
            if min_kvks is not None:
                query = query.gte('total_kvks', min_kvks)
            if min_prep_wr is not None:
                query = query.gte('prep_win_rate', min_prep_wr)
            if min_battle_wr is not None:
                query = query.gte('battle_win_rate', min_battle_wr)
            
            # Map sort field names
            sort_field = sort if sort in ALLOWED_SORT_FIELDS else 'kingdom_number'
            if sort_field == 'overall_score':
                sort_field = 'atlas_score'
            
            # Apply sorting
            query = query.order(sort_field, desc=(order == 'desc'))
            
            # Get total count (separate query)
            count_result = supabase.table('kingdoms').select('kingdom_number', count='exact')
            if search:
                count_result = count_result.eq('kingdom_number', int(search))
            if status:
                count_result = count_result.eq('most_recent_status', status)
            if min_kvks is not None:
                count_result = count_result.gte('total_kvks', min_kvks)
            if min_prep_wr is not None:
                count_result = count_result.gte('prep_win_rate', min_prep_wr)
            if min_battle_wr is not None:
                count_result = count_result.gte('battle_win_rate', min_battle_wr)
            count_data = count_result.execute()
            total = count_data.count if count_data.count else len(count_data.data or [])
            
            # Apply pagination
            offset = (page - 1) * page_size
            query = query.range(offset, offset + page_size - 1)
            
            result = query.execute()
            kingdoms = result.data or []
            
            # Map atlas_score to overall_score and add ranks
            for i, k in enumerate(kingdoms):
                if 'atlas_score' in k:
                    k['overall_score'] = k['atlas_score']
                # Calculate rank based on position (approximate for paginated results)
                k['rank'] = offset + i + 1 if sort_field == 'atlas_score' and order == 'desc' else 0
                k['recent_kvks'] = []  # KvK history fetched separately if needed
            
            total_pages = math.ceil(total / page_size) if total > 0 else 1
            
            logger.info(f"Fetched {len(kingdoms)} kingdoms from Supabase (page {page})")
            return {
                "items": kingdoms,
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages
            }
    except Exception as e:
        logger.warning(f"Supabase query failed, falling back to SQLite: {e}")
    
    # Fallback to SQLite if Supabase unavailable
    query = db.query(Kingdom)
    
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
    
    total = query.count()
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    
    if sort and sort in ALLOWED_SORT_FIELDS:
        sort_column = getattr(Kingdom, sort)
        query = query.order_by(desc(sort_column) if order == "desc" else asc(sort_column))
    else:
        query = query.order_by(asc(Kingdom.kingdom_number))
    
    offset = (page - 1) * page_size
    kingdoms = query.offset(offset).limit(page_size).all()
    
    for kingdom in kingdoms:
        kingdom.rank = db.query(func.count(Kingdom.kingdom_number)).filter(
            Kingdom.overall_score > kingdom.overall_score
        ).scalar() + 1
        kingdom.recent_kvks = []
    
    return {
        "items": kingdoms,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.get("/kingdoms/{kingdom_number}")
def get_kingdom_profile(kingdom_number: int, db: Session = Depends(get_db)):
    try:
        # Try Supabase first (source of truth)
        supabase_kingdom = get_kingdom_from_supabase(kingdom_number)
        
        if supabase_kingdom:
            # Get KvK history from Supabase
            try:
                recent_kvks = get_kvk_history_from_supabase(kingdom_number, limit=50)
            except Exception as kvk_err:
                print(f"KvK history error for {kingdom_number}: {kvk_err}")
                recent_kvks = []
            
            # Map atlas_score to overall_score for API compatibility
            if 'atlas_score' in supabase_kingdom:
                supabase_kingdom['overall_score'] = supabase_kingdom['atlas_score']
            
            # Ensure required fields exist with defaults
            supabase_kingdom['rank'] = supabase_kingdom.get('rank', 0)
            supabase_kingdom['recent_kvks'] = recent_kvks
            supabase_kingdom['last_updated'] = supabase_kingdom.get('last_updated') or supabase_kingdom.get('updated_at')
            supabase_kingdom['most_recent_status'] = supabase_kingdom.get('most_recent_status', 'Unknown')
            
            # Remove any None values that might cause serialization issues
            return {k: v for k, v in supabase_kingdom.items() if v is not None or k in ['recent_kvks']}
    except Exception as e:
        print(f"Error fetching kingdom {kingdom_number} from Supabase: {e}")
        import traceback
        traceback.print_exc()
        # Fall through to SQLite fallback
    
    # ADR-011: If Supabase failed, return 503 instead of falling back to stale SQLite data
    logger.error(f"Kingdom {kingdom_number} not found in Supabase")
    raise HTTPException(status_code=404, detail="Kingdom not found")
