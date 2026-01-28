from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Dict, Any
from database import get_db
from models import Kingdom, KVKRecord
from schemas import Kingdom as KingdomSchema, KingdomProfile

router = APIRouter()

@router.get("/compare")
def compare_kingdoms(
    kingdoms: str = Query(..., description="Comma-separated kingdom numbers (e.g., 123,456)"),
    db: Session = Depends(get_db)
):
    # Parse kingdom numbers
    try:
        kingdom_numbers = [int(k.strip()) for k in kingdoms.split(',')]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid kingdom numbers format")
    
    if len(kingdom_numbers) < 2:
        raise HTTPException(status_code=400, detail="At least 2 kingdoms required for comparison")
    
    if len(kingdom_numbers) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 kingdoms can be compared at once")
    
    # Get kingdoms data
    kingdoms_data = db.query(Kingdom).filter(Kingdom.kingdom_number.in_(kingdom_numbers)).all()
    
    if len(kingdoms_data) != len(kingdom_numbers):
        found_numbers = [k.kingdom_number for k in kingdoms_data]
        missing = set(kingdom_numbers) - set(found_numbers)
        raise HTTPException(status_code=404, detail=f"Kingdoms not found: {missing}")
    
    # Add ranks to kingdoms
    all_kingdoms = db.query(Kingdom).all()
    kingdoms_sorted = sorted(all_kingdoms, key=lambda k: k.overall_score, reverse=True)
    rank_map = {k.kingdom_number: idx+1 for idx, k in enumerate(kingdoms_sorted)}
    
    # Get recent KVK records for each kingdom
    comparison_data = []
    for kingdom in kingdoms_data:
        recent_kvks = db.query(KVKRecord).filter(
            KVKRecord.kingdom_number == kingdom.kingdom_number
        ).order_by(KVKRecord.kvk_number.desc()).limit(5).all()
        
        # Add rank to kingdom
        kingdom.rank = rank_map[kingdom.kingdom_number]
        
        comparison_data.append({
            "kingdom": kingdom,
            "recent_kvks": recent_kvks
        })
    
    # Calculate comparison metrics
    comparison_metrics = {
        "kingdoms": comparison_data,
        "comparison_summary": {
            "total_kingdoms": len(kingdoms_data),
            "avg_overall_score": sum(k.overall_score for k in kingdoms_data) / len(kingdoms_data),
            "avg_prep_wr": sum(k.prep_win_rate for k in kingdoms_data) / len(kingdoms_data),
            "avg_battle_wr": sum(k.battle_win_rate for k in kingdoms_data) / len(kingdoms_data),
            "top_kingdom": max(kingdoms_data, key=lambda k: k.overall_score),
            "best_prep_wr": max(kingdoms_data, key=lambda k: k.prep_win_rate),
            "best_battle_wr": max(kingdoms_data, key=lambda k: k.battle_win_rate)
        }
    }
    
    return comparison_metrics

@router.get("/compare/head-to-head")
def head_to_head(
    kingdom1: int = Query(..., description="First kingdom number"),
    kingdom2: int = Query(..., description="Second kingdom number"),
    db: Session = Depends(get_db)
):
    # Get both kingdoms
    kingdoms = db.query(Kingdom).filter(
        Kingdom.kingdom_number.in_([kingdom1, kingdom2])
    ).all()
    
    if len(kingdoms) != 2:
        raise HTTPException(status_code=404, detail="One or both kingdoms not found")
    
    # Find direct KVK matches between these kingdoms
    direct_matches = db.query(KVKRecord).filter(
        or_(
            and_(KVKRecord.kingdom_number == kingdom1, KVKRecord.opponent_kingdom == kingdom2),
            and_(KVKRecord.kingdom_number == kingdom2, KVKRecord.opponent_kingdom == kingdom1)
        )
    ).order_by(KVKRecord.kvk_number.desc()).all()
    
    # Calculate head-to-head stats
    k1_wins = sum(1 for match in direct_matches if 
                  match.kingdom_number == kingdom1 and match.overall_result == 'W')
    k2_wins = sum(1 for match in direct_matches if 
                  match.kingdom_number == kingdom2 and match.overall_result == 'W')
    
    return {
        "kingdoms": kingdoms,
        "direct_matches": direct_matches,
        "head_to_head_record": {
            f"kingdom_{kingdom1}_wins": k1_wins,
            f"kingdom_{kingdom2}_wins": k2_wins,
            "total_matches": len(direct_matches)
        }
    }
