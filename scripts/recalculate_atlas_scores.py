#!/usr/bin/env python3
"""
Recalculate Atlas Scores v2.0 for all kingdoms in Supabase.

This script implements the centralized Atlas Score formula and updates
the overall_score column for all kingdoms.

Usage:
    python scripts/recalculate_atlas_scores.py
    
Requires:
    SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables
"""

import os
import math
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

# Try to load from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from supabase import create_client, Client

# ============================================================================
# CONSTANTS
# ============================================================================

BAYESIAN_PRIOR = 2.5
BAYESIAN_TOTAL_PRIOR = 5
MAX_HISTORY_BONUS = 1.5
HISTORY_BONUS_PER_KVK = 0.05
RECENT_FORM_WEIGHTS = [1.0, 0.8, 0.6, 0.4, 0.2]

KVK_OUTCOME_SCORES = {
    'Domination': 1.0,
    'Comeback': 0.75,
    'Reversal': 0.6,
    'Invasion': 0.0,
}

class PowerTier(Enum):
    S = 'S'
    A = 'A'
    B = 'B'
    C = 'C'
    D = 'D'

TIER_THRESHOLDS = {
    'S': 8.90,
    'A': 7.79,
    'B': 6.42,
    'C': 4.72,
    'D': 0,
}

@dataclass
class KingdomStats:
    total_kvks: int
    prep_wins: int
    prep_losses: int
    battle_wins: int
    battle_losses: int
    dominations: int
    invasions: int
    recent_outcomes: List[str]
    current_prep_streak: int
    current_battle_streak: int

@dataclass
class ScoreBreakdown:
    base_score: float
    dom_inv_multiplier: float
    recent_form_multiplier: float
    streak_multiplier: float
    experience_factor: float
    history_bonus: float
    final_score: float
    tier: PowerTier

# ============================================================================
# FORMULA FUNCTIONS
# ============================================================================

def bayesian_adjusted_rate(wins: int, total: int) -> float:
    """Bayesian adjusted win rate - pulls extreme rates toward 50%"""
    if total == 0:
        return 0.5
    adjusted_wins = wins + BAYESIAN_PRIOR
    adjusted_total = total + BAYESIAN_TOTAL_PRIOR
    return adjusted_wins / adjusted_total

def calculate_base_score(stats: KingdomStats) -> float:
    """Calculate base performance score (Prep 40%, Battle 60%)"""
    prep_total = stats.prep_wins + stats.prep_losses
    battle_total = stats.battle_wins + stats.battle_losses
    
    adj_prep_rate = bayesian_adjusted_rate(stats.prep_wins, prep_total)
    adj_battle_rate = bayesian_adjusted_rate(stats.battle_wins, battle_total)
    
    return (adj_prep_rate * 0.40 + adj_battle_rate * 0.60) * 10

def calculate_dom_inv_multiplier(stats: KingdomStats) -> float:
    """Calculate domination/invasion multiplier"""
    if stats.total_kvks == 0:
        return 1.0
    
    dom_rate = stats.dominations / stats.total_kvks
    inv_rate = stats.invasions / stats.total_kvks
    
    multiplier = 1.0 + (dom_rate * 0.15) - (inv_rate * 0.15)
    return max(0.85, min(1.15, multiplier))

def calculate_recent_form_multiplier(recent_outcomes: List[str]) -> float:
    """Calculate recent form multiplier based on last 5 KvK outcomes"""
    if not recent_outcomes:
        return 1.0
    
    weighted_score = 0
    total_weight = 0
    
    for i, outcome in enumerate(recent_outcomes[:5]):
        weight = RECENT_FORM_WEIGHTS[i] if i < len(RECENT_FORM_WEIGHTS) else 0.2
        score = KVK_OUTCOME_SCORES.get(outcome, 0.5)
        weighted_score += score * weight
        total_weight += weight
    
    normalized_score = weighted_score / total_weight if total_weight > 0 else 0.5
    multiplier = 1.0 + (normalized_score - 0.5) * 0.3
    return max(0.85, min(1.15, multiplier))

def calculate_streak_multiplier(prep_streak: int, battle_streak: int) -> float:
    """Calculate streak multiplier based on current win streaks"""
    prep_bonus = min(max(prep_streak, 0), 6) * 0.01
    battle_bonus = min(max(battle_streak, 0), 6) * 0.015
    
    prep_penalty = min(abs(prep_streak), 3) * 0.01 if prep_streak < 0 else 0
    battle_penalty = min(abs(battle_streak), 3) * 0.015 if battle_streak < 0 else 0
    
    multiplier = 1.0 + prep_bonus + battle_bonus - prep_penalty - battle_penalty
    return max(0.91, min(1.15, multiplier))

def calculate_experience_factor(total_kvks: int) -> float:
    """Calculate experience factor using logarithmic scaling"""
    if total_kvks == 0:
        return 0.0
    if total_kvks == 1:
        return 0.4
    if total_kvks == 2:
        return 0.6
    if total_kvks == 3:
        return 0.75
    if total_kvks == 4:
        return 0.9
    
    base = 1.0
    history_bonus = 0.5 * (math.log10(total_kvks + 1) / math.log10(17))
    return min(1.0, base + history_bonus * 0.1)

def calculate_history_bonus(total_kvks: int) -> float:
    """Calculate history depth bonus"""
    return min(MAX_HISTORY_BONUS, total_kvks * HISTORY_BONUS_PER_KVK)

def get_power_tier(score: float) -> PowerTier:
    """Get power tier from Atlas Score"""
    if score >= TIER_THRESHOLDS['S']:
        return PowerTier.S
    if score >= TIER_THRESHOLDS['A']:
        return PowerTier.A
    if score >= TIER_THRESHOLDS['B']:
        return PowerTier.B
    if score >= TIER_THRESHOLDS['C']:
        return PowerTier.C
    return PowerTier.D

def calculate_atlas_score(stats: KingdomStats) -> ScoreBreakdown:
    """Calculate the complete Atlas Score with full breakdown"""
    base_score = calculate_base_score(stats)
    dom_inv_multiplier = calculate_dom_inv_multiplier(stats)
    recent_form_multiplier = calculate_recent_form_multiplier(stats.recent_outcomes)
    streak_multiplier = calculate_streak_multiplier(stats.current_prep_streak, stats.current_battle_streak)
    experience_factor = calculate_experience_factor(stats.total_kvks)
    history_bonus = calculate_history_bonus(stats.total_kvks)
    
    raw_score = base_score * dom_inv_multiplier * recent_form_multiplier * streak_multiplier
    scaled_score = raw_score * experience_factor
    final_score = max(0, min(15, scaled_score + history_bonus))
    
    return ScoreBreakdown(
        base_score=round(base_score, 2),
        dom_inv_multiplier=round(dom_inv_multiplier, 3),
        recent_form_multiplier=round(recent_form_multiplier, 3),
        streak_multiplier=round(streak_multiplier, 3),
        experience_factor=round(experience_factor, 2),
        history_bonus=round(history_bonus, 2),
        final_score=round(final_score, 2),
        tier=get_power_tier(final_score)
    )

def get_kvk_outcome(prep_result: str, battle_result: str) -> str:
    """Determine KvK outcome from prep and battle results"""
    prep_win = prep_result in ('Win', 'W')
    battle_win = battle_result in ('Win', 'W')
    
    if prep_win and battle_win:
        return 'Domination'
    if not prep_win and battle_win:
        return 'Comeback'
    if prep_win and not battle_win:
        return 'Reversal'
    return 'Invasion'

def extract_stats_from_data(kingdom: Dict, kvk_records: List[Dict]) -> KingdomStats:
    """Extract KingdomStats from kingdom and KvK data"""
    # Sort KvK records by kvk_number descending
    sorted_kvks = sorted(kvk_records, key=lambda x: x.get('kvk_number', 0), reverse=True)
    
    # Calculate current streaks
    current_prep_streak = 0
    current_battle_streak = 0
    
    for kvk in sorted_kvks:
        prep_win = kvk.get('prep_result') in ('Win', 'W')
        
        if current_prep_streak == 0:
            current_prep_streak = 1 if prep_win else -1
        elif (prep_win and current_prep_streak > 0) or (not prep_win and current_prep_streak < 0):
            current_prep_streak += 1 if prep_win else -1
        else:
            break
    
    for kvk in sorted_kvks:
        battle_win = kvk.get('battle_result') in ('Win', 'W')
        
        if current_battle_streak == 0:
            current_battle_streak = 1 if battle_win else -1
        elif (battle_win and current_battle_streak > 0) or (not battle_win and current_battle_streak < 0):
            current_battle_streak += 1 if battle_win else -1
        else:
            break
    
    # Get recent outcomes
    recent_outcomes = []
    for kvk in sorted_kvks[:5]:
        outcome = get_kvk_outcome(
            kvk.get('prep_result', 'L'),
            kvk.get('battle_result', 'L')
        )
        recent_outcomes.append(outcome)
    
    return KingdomStats(
        total_kvks=kingdom.get('total_kvks') or 0,
        prep_wins=kingdom.get('prep_wins') or 0,
        prep_losses=kingdom.get('prep_losses') or 0,
        battle_wins=kingdom.get('battle_wins') or 0,
        battle_losses=kingdom.get('battle_losses') or 0,
        dominations=kingdom.get('dominations') or 0,
        invasions=kingdom.get('invasions') or kingdom.get('defeats') or 0,
        recent_outcomes=recent_outcomes,
        current_prep_streak=max(0, current_prep_streak),
        current_battle_streak=max(0, current_battle_streak)
    )

def main():
    # Get Supabase credentials
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required")
        return
    
    print(f"Connecting to Supabase: {supabase_url[:30]}...")
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # Fetch all kingdoms
    print("Fetching kingdoms...")
    kingdoms_response = supabase.table('kingdoms').select('*').execute()
    kingdoms = kingdoms_response.data
    print(f"Found {len(kingdoms)} kingdoms")
    
    # Fetch all KvK history
    print("Fetching KvK history...")
    kvk_response = supabase.table('kvk_history').select('*').execute()
    kvk_records = kvk_response.data
    print(f"Found {len(kvk_records)} KvK records")
    
    # Group KvK records by kingdom
    kvk_by_kingdom: Dict[int, List[Dict]] = {}
    for record in kvk_records:
        knum = record.get('kingdom_number')
        if knum not in kvk_by_kingdom:
            kvk_by_kingdom[knum] = []
        kvk_by_kingdom[knum].append(record)
    
    # Calculate and update scores
    updated = 0
    errors = []
    significant_changes = []
    
    print("\nRecalculating scores...")
    for kingdom in kingdoms:
        knum = kingdom['kingdom_number']
        try:
            kvks = kvk_by_kingdom.get(knum, [])
            stats = extract_stats_from_data(kingdom, kvks)
            breakdown = calculate_atlas_score(stats)
            
            old_score = kingdom.get('overall_score', 0)
            new_score = breakdown.final_score
            
            # Track significant changes
            if abs(new_score - old_score) > 0.5:
                significant_changes.append({
                    'kingdom': knum,
                    'old': round(old_score, 2),
                    'new': new_score,
                    'change': round(new_score - old_score, 2)
                })
            
            # Update the score in Supabase
            supabase.table('kingdoms').update({
                'overall_score': new_score
            }).eq('kingdom_number', knum).execute()
            
            updated += 1
            if updated % 100 == 0:
                print(f"  Updated {updated} kingdoms...")
                
        except Exception as e:
            errors.append({'kingdom': knum, 'error': str(e)})
    
    print(f"\n✅ Updated {updated} kingdoms")
    
    if errors:
        print(f"\n⚠️ {len(errors)} errors:")
        for err in errors[:5]:
            print(f"  K{err['kingdom']}: {err['error']}")
    
    if significant_changes:
        print(f"\n📊 {len(significant_changes)} kingdoms with significant score changes (>0.5):")
        # Sort by absolute change
        significant_changes.sort(key=lambda x: abs(x['change']), reverse=True)
        for change in significant_changes[:10]:
            direction = "↑" if change['change'] > 0 else "↓"
            print(f"  K{change['kingdom']}: {change['old']} → {change['new']} ({direction}{abs(change['change'])})")
    
    # Verify Kingdom 231
    print("\n🔍 Verifying Kingdom 231:")
    k231 = supabase.table('kingdoms').select('*').eq('kingdom_number', 231).execute()
    if k231.data:
        k = k231.data[0]
        print(f"  Score: {k.get('overall_score')}")
        print(f"  Total KvKs: {k.get('total_kvks')}")
        print(f"  Dominations: {k.get('dominations')}")

if __name__ == '__main__':
    main()
