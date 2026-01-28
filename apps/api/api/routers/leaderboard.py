from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional, List
from slowapi import Limiter
from slowapi.util import get_remote_address
from database import get_db
from models import Kingdom
from schemas import Kingdom as KingdomSchema

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

@router.get("/leaderboard", response_model=List[KingdomSchema])
@limiter.limit("30/minute")
def get_leaderboard(
    request: Request,
    sort_by: Optional[str] = Query("overall_score", description="Sort by: overall_score, prep_win_rate, battle_win_rate, total_kvks"),
    limit: Optional[int] = Query(50, ge=1, le=200, description="Number of results to return (max 200)"),
    offset: Optional[int] = Query(0, ge=0, le=10000, description="Number of results to skip"),
    db: Session = Depends(get_db)
):
    query = db.query(Kingdom)
    
    # Validate sort field
    valid_sort_fields = {
        "overall_score": Kingdom.overall_score,
        "prep_win_rate": Kingdom.prep_win_rate,
        "battle_win_rate": Kingdom.battle_win_rate,
        "total_kvks": Kingdom.total_kvks,
        "kingdom_number": Kingdom.kingdom_number
    }
    
    sort_field = valid_sort_fields.get(sort_by, Kingdom.overall_score)
    query = query.order_by(desc(sort_field))
    
    # Apply pagination
    if limit:
        query = query.limit(limit)
    if offset:
        query = query.offset(offset)
    
    kingdoms = query.all()
    
    # Add rank based on overall_score (higher score = better rank)
    for kingdom in kingdoms:
        rank = db.query(func.count(Kingdom.kingdom_number)).filter(
            Kingdom.overall_score > kingdom.overall_score
        ).scalar() + 1
        kingdom.rank = rank
    
    return kingdoms

@router.get("/leaderboard/top-by-status")
def get_leaderboard_by_status(
    status: str = Query(..., description="Status filter: Leading, Ordinary, etc."),
    limit: Optional[int] = Query(10, description="Number of results per status"),
    db: Session = Depends(get_db)
):
    query = db.query(Kingdom).filter(Kingdom.most_recent_status == status)
    query = query.order_by(desc(Kingdom.overall_score))
    
    if limit:
        query = query.limit(limit)
    
    kingdoms = query.all()
    return {"status": status, "kingdoms": kingdoms}
