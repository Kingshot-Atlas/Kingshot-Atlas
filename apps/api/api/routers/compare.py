from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
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
    
    # Add ranks to kingdoms using efficient COUNT query instead of loading all
    rank_map = {}
    for k in kingdoms_data:
        rank = db.query(func.count(Kingdom.kingdom_number)).filter(
            Kingdom.overall_score > k.overall_score
        ).scalar() + 1
        rank_map[k.kingdom_number] = rank
    
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
    # Records are stored from one kingdom's perspective, so we need to account for both views:
    # - When kingdom1 is the record owner and won (overall_result == 'W'), k1 wins
    # - When kingdom2 is the record owner and lost (overall_result == 'L'), k1 wins (from k2's loss)
    k1_wins = 0
    k2_wins = 0
    
    for match in direct_matches:
        if match.kingdom_number == kingdom1:
            if match.overall_result == 'W':
                k1_wins += 1
            else:
                k2_wins += 1
        else:  # match.kingdom_number == kingdom2
            if match.overall_result == 'W':
                k2_wins += 1
            else:
                k1_wins += 1
    
    # Deduplicate: if the same match is recorded from both perspectives, divide by 2
    # This handles cases where both kingdoms submitted the same match
    unique_matches = len(set((m.kvk_number, min(m.kingdom_number, m.opponent_kingdom), 
                               max(m.kingdom_number, m.opponent_kingdom)) for m in direct_matches))
    
    return {
        "kingdoms": kingdoms,
        "direct_matches": direct_matches,
        "head_to_head_record": {
            f"kingdom_{kingdom1}_wins": k1_wins,
            f"kingdom_{kingdom2}_wins": k2_wins,
            "total_matches": unique_matches
        }
    }
