from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from database import get_db
from models import Kingdom
from schemas import Kingdom as KingdomSchema

router = APIRouter()

@router.get("/leaderboard", response_model=List[KingdomSchema])
def get_leaderboard(
    sort_by: Optional[str] = Query("overall_score", description="Sort by: overall_score, prep_win_rate, battle_win_rate, total_kvks"),
    limit: Optional[int] = Query(50, description="Number of results to return"),
    offset: Optional[int] = Query(0, description="Number of results to skip"),
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
