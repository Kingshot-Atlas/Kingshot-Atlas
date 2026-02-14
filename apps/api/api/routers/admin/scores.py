"""
Admin Atlas Score management endpoints.

Recalculate scores, view distribution, track movers.
"""
import logging
from fastapi import APIRouter, HTTPException, Header, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from collections import defaultdict

from api.supabase_client import get_supabase_admin
from api.atlas_score_formula import (
    calculate_atlas_score, extract_stats_from_kingdom, get_power_tier,
    calculate_tier_thresholds_from_scores, PowerTier
)
from database import get_db
from models import Kingdom, KVKRecord
from ._shared import require_admin, audit_log

logger = logging.getLogger("atlas.admin")

router = APIRouter()


@router.post("/scores/recalculate")
async def recalculate_all_scores(
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Recalculate Atlas Scores for all kingdoms using the v2.0 formula.
    
    This endpoint recalculates scores based on:
    - Base win rates with Bayesian adjustment
    - Domination/Invasion multipliers
    - Recent form (last 5 KvKs)
    - Streak bonuses
    - Experience factor
    """
    require_admin(x_admin_key, authorization)
    
    try:
        # Get all kingdoms
        kingdoms = db.query(Kingdom).all()
        
        updated = 0
        errors = []
        score_changes = []
        
        for kingdom in kingdoms:
            try:
                # Get KvK records for this kingdom
                kvk_records = db.query(KVKRecord).filter(
                    KVKRecord.kingdom_number == kingdom.kingdom_number
                ).order_by(KVKRecord.kvk_number.desc()).all()
                
                # Convert to dict format
                kvk_dicts = [
                    {
                        'kvk_number': r.kvk_number,
                        'prep_result': r.prep_result,
                        'battle_result': r.battle_result
                    }
                    for r in kvk_records
                ]
                
                kingdom_dict = {
                    'total_kvks': kingdom.total_kvks,
                    'prep_wins': kingdom.prep_wins,
                    'prep_losses': kingdom.prep_losses,
                    'battle_wins': kingdom.battle_wins,
                    'battle_losses': kingdom.battle_losses,
                    'dominations': kingdom.dominations,
                    'invasions': kingdom.invasions,
                }
                
                # Calculate new score
                stats = extract_stats_from_kingdom(kingdom_dict, kvk_dicts)
                breakdown = calculate_atlas_score(stats)
                
                old_score = kingdom.overall_score
                new_score = breakdown.final_score
                
                # Track significant changes
                if abs(new_score - old_score) > 0.1:
                    score_changes.append({
                        'kingdom': kingdom.kingdom_number,
                        'old_score': round(old_score, 2),
                        'new_score': round(new_score, 2),
                        'change': round(new_score - old_score, 2),
                        'old_tier': get_power_tier(old_score).value,
                        'new_tier': breakdown.tier.value
                    })
                
                # Update the score
                kingdom.overall_score = new_score
                updated += 1
                
            except Exception as e:
                errors.append({
                    'kingdom': kingdom.kingdom_number,
                    'error': str(e)
                })
        
        # Commit all changes
        db.commit()
        
        # Sort changes by magnitude
        score_changes.sort(key=lambda x: abs(x['change']), reverse=True)
        
        audit_log("recalculate_scores", "kingdoms", None, {"updated": updated, "errors": len(errors), "total": len(kingdoms)})
        
        return {
            'success': True,
            'updated': updated,
            'errors': len(errors),
            'error_details': errors[:10],  # First 10 errors
            'significant_changes': score_changes[:20],  # Top 20 changes
            'total_kingdoms': len(kingdoms)
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Score recalculation failed: {str(e)}")


@router.get("/scores/distribution")
async def get_score_distribution(
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Get Atlas Score distribution statistics.
    
    Returns score distribution, tier counts, and percentile thresholds.
    """
    require_admin(x_admin_key, authorization)
    
    try:
        kingdoms = db.query(Kingdom).all()
        scores = [k.overall_score for k in kingdoms if k.overall_score is not None]
        
        if not scores:
            return {'error': 'No scores found'}
        
        # Sort for percentile calculations
        sorted_scores = sorted(scores)
        total = len(sorted_scores)
        
        # Calculate tier counts
        tier_counts = {tier.value: 0 for tier in PowerTier}
        for score in scores:
            tier = get_power_tier(score)
            tier_counts[tier.value] += 1
        
        # Calculate dynamic thresholds based on actual distribution
        dynamic_thresholds = calculate_tier_thresholds_from_scores(scores)
        
        # Score distribution buckets
        buckets = {
            '0-2': 0,
            '2-4': 0,
            '4-6': 0,
            '6-8': 0,
            '8-10': 0,
            '10+': 0
        }
        for score in scores:
            if score < 2:
                buckets['0-2'] += 1
            elif score < 4:
                buckets['2-4'] += 1
            elif score < 6:
                buckets['4-6'] += 1
            elif score < 8:
                buckets['6-8'] += 1
            elif score < 10:
                buckets['8-10'] += 1
            else:
                buckets['10+'] += 1
        
        return {
            'total_kingdoms': total,
            'tier_counts': tier_counts,
            'tier_percentages': {k: round(v / total * 100, 1) for k, v in tier_counts.items()},
            'score_buckets': buckets,
            'statistics': {
                'min': round(min(scores), 2),
                'max': round(max(scores), 2),
                'mean': round(sum(scores) / len(scores), 2),
                'median': round(sorted_scores[total // 2], 2),
                'p10': round(sorted_scores[int(total * 0.10)], 2),
                'p25': round(sorted_scores[int(total * 0.25)], 2),
                'p50': round(sorted_scores[int(total * 0.50)], 2),
                'p75': round(sorted_scores[int(total * 0.75)], 2),
                'p90': round(sorted_scores[int(total * 0.90)], 2),
                'p97': round(sorted_scores[int(total * 0.97)], 2) if total > 33 else None,
            },
            'dynamic_thresholds': {k.value: round(v, 2) for k, v in dynamic_thresholds.items()}
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get distribution: {str(e)}")


@router.get("/scores/movers")
async def get_score_movers(
    days: int = 7,
    limit: int = 20,
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Get kingdoms with the biggest score changes in the last N days.
    
    Requires score_history table to be populated.
    """
    require_admin(x_admin_key, authorization)
    
    client = get_supabase_admin()
    if not client:
        return {'error': 'Supabase not configured', 'movers': []}
    
    try:
        # Get score history from Supabase
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        
        result = client.table("score_history").select(
            "kingdom_number, score, recorded_at"
        ).gte("recorded_at", cutoff).order("recorded_at").execute()
        
        if not result.data:
            return {'movers': [], 'message': 'No score history found'}
        
        # Group by kingdom and find first/last scores
        kingdom_scores = defaultdict(list)
        for record in result.data:
            kingdom_scores[record['kingdom_number']].append({
                'score': record['score'],
                'recorded_at': record['recorded_at']
            })
        
        # Calculate changes
        movers = []
        for kingdom_num, scores in kingdom_scores.items():
            if len(scores) >= 2:
                scores.sort(key=lambda x: x['recorded_at'])
                first_score = scores[0]['score']
                last_score = scores[-1]['score']
                change = last_score - first_score
                
                if abs(change) > 0.05:  # Minimum threshold
                    movers.append({
                        'kingdom': kingdom_num,
                        'old_score': round(first_score, 2),
                        'new_score': round(last_score, 2),
                        'change': round(change, 2),
                        'change_percent': round((change / first_score) * 100, 1) if first_score > 0 else 0,
                        'old_tier': get_power_tier(first_score).value,
                        'new_tier': get_power_tier(last_score).value,
                        'tier_changed': get_power_tier(first_score) != get_power_tier(last_score)
                    })
        
        # Sort by absolute change
        movers.sort(key=lambda x: abs(x['change']), reverse=True)
        
        return {
            'period_days': days,
            'total_movers': len(movers),
            'tier_changes': sum(1 for m in movers if m['tier_changed']),
            'movers': movers[:limit]
        }
        
    except Exception as e:
        return {'error': str(e), 'movers': []}
