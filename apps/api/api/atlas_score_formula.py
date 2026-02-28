"""
Atlas Score Formula v2.0 - Python Backend Implementation

This module mirrors the TypeScript implementation in apps/web/src/utils/atlasScoreFormula.ts
to ensure consistent score calculations between frontend and backend.

Formula Components:
1. Base Performance Score (Prep 40% + Battle 60% with Bayesian adjustment)
2. Domination/Invasion Multiplier (rewards double wins, penalizes double losses)
3. Recent Form Multiplier (last 5 KvKs weighted by recency)
4. Streak Multiplier (current prep + battle streaks)
5. Experience Factor (logarithmic scaling, veterans get full credit at 5+ KvKs)
6. History Depth Bonus (small bonus for extensive track record)
"""

import math
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

# ============================================================================
# CONSTANTS & CONFIGURATION
# ============================================================================

# KvK outcome scores for Recent Form calculation
KVK_OUTCOME_SCORES = {
    'Domination': 1.0,   # WW - Best outcome
    'Comeback': 0.75,    # LW - Lost prep but won battle (battle matters more)
    'Reversal': 0.6,     # WL - Won prep but lost battle (not as good)
    'Invasion': 0.0,     # LL - Worst outcome
}

# Weights for recent KvKs (most recent = highest weight)
RECENT_FORM_WEIGHTS = [1.0, 0.8, 0.6, 0.4, 0.2]

# Bayesian prior for adjusting win rates (pulls toward 50%)
BAYESIAN_PRIOR = 2.5
BAYESIAN_TOTAL_PRIOR = 5

# Experience factor thresholds
EXPERIENCE_THRESHOLDS = {
    'VETERAN': 16,  # Reference point for logarithmic scaling
    'FULL_CREDIT': 5,  # Minimum KvKs for full experience credit
}

# Maximum history depth bonus
MAX_HISTORY_BONUS = 1.5

# History bonus per KvK
HISTORY_BONUS_PER_KVK = 0.05


# ============================================================================
# TIER SYSTEM
# ============================================================================

class PowerTier(str, Enum):
    S = 'S'
    A = 'A'
    B = 'B'
    C = 'C'
    D = 'D'


TIER_THRESHOLDS = {
    PowerTier.S: 8.90,  # Top 3% - Elite kingdoms
    PowerTier.A: 7.79,  # Top 10% - Strong kingdoms
    PowerTier.B: 6.42,  # Top 25% - Above average
    PowerTier.C: 4.72,  # Top 50% - Average kingdoms
    PowerTier.D: 0,     # Bottom 50% - Below average
}

TIER_PERCENTILES = {
    PowerTier.S: {'min': 97, 'label': 'Top 3%', 'description': 'Elite'},
    PowerTier.A: {'min': 90, 'label': 'Top 10%', 'description': 'Formidable'},
    PowerTier.B: {'min': 75, 'label': 'Top 25%', 'description': 'Competitive'},
    PowerTier.C: {'min': 50, 'label': 'Top 50%', 'description': 'Developing'},
    PowerTier.D: {'min': 0, 'label': 'Bottom 50%', 'description': 'Rebuilding'},
}

TIER_COLORS = {
    PowerTier.S: '#fbbf24',  # Gold
    PowerTier.A: '#22c55e',  # Green
    PowerTier.B: '#3b82f6',  # Blue
    PowerTier.C: '#f97316',  # Orange
    PowerTier.D: '#ef4444',  # Red
}


def get_power_tier(score: float) -> PowerTier:
    """Get power tier from Atlas Score."""
    if score >= TIER_THRESHOLDS[PowerTier.S]:
        return PowerTier.S
    if score >= TIER_THRESHOLDS[PowerTier.A]:
        return PowerTier.A
    if score >= TIER_THRESHOLDS[PowerTier.B]:
        return PowerTier.B
    if score >= TIER_THRESHOLDS[PowerTier.C]:
        return PowerTier.C
    return PowerTier.D


def get_tier_color(score: float) -> str:
    """Get tier color from score."""
    return TIER_COLORS[get_power_tier(score)]


def get_tier_description(tier: PowerTier) -> str:
    """Get tier description for tooltips."""
    info = TIER_PERCENTILES[tier]
    threshold_map = {
        PowerTier.D: '0-4.7',
        PowerTier.C: '4.7-6.4',
        PowerTier.B: '6.4-7.8',
        PowerTier.A: '7.8-8.9',
        PowerTier.S: '8.9+',
    }
    return f"{tier.value}-Tier: {info['description']} kingdom ({info['label']}) with Atlas Score {threshold_map[tier]}"


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class KingdomStats:
    """Kingdom statistics for score calculation."""
    total_kvks: int
    prep_wins: int
    prep_losses: int
    battle_wins: int
    battle_losses: int
    dominations: int
    invasions: int
    recent_outcomes: List[str]  # ['Domination', 'Comeback', 'Reversal', 'Invasion']
    current_prep_streak: int
    current_battle_streak: int


@dataclass
class ScoreBreakdown:
    """Complete score breakdown with all components."""
    base_score: float
    dom_inv_multiplier: float
    recent_form_multiplier: float
    streak_multiplier: float
    experience_factor: float
    history_bonus: float
    final_score: float
    tier: PowerTier


@dataclass
class ScoreComponents:
    """Detailed score components for UI display."""
    prep_win_rate_raw: float
    prep_win_rate_adjusted: float
    prep_weight: int
    battle_win_rate_raw: float
    battle_win_rate_adjusted: float
    battle_weight: int
    domination_rate: float
    invasion_rate: float
    recent_form_score: float
    prep_streak_bonus: float
    battle_streak_bonus: float
    experience_factor: float


# ============================================================================
# CORE FORMULA FUNCTIONS
# ============================================================================

def bayesian_adjusted_rate(wins: int, total: int) -> float:
    """
    Bayesian adjusted win rate - pulls extreme rates toward 50%.
    This prevents lucky 2-0 starts from having inflated scores.
    """
    if total == 0:
        return 0.5  # Default to 50% with no data
    
    adjusted_wins = wins + BAYESIAN_PRIOR
    adjusted_total = total + BAYESIAN_TOTAL_PRIOR
    
    return adjusted_wins / adjusted_total


def calculate_base_score(stats: KingdomStats) -> float:
    """
    Calculate base performance score.
    Prep Phase: 40% weight, Battle Phase: 60% weight
    """
    prep_total = stats.prep_wins + stats.prep_losses
    battle_total = stats.battle_wins + stats.battle_losses
    
    adj_prep_rate = bayesian_adjusted_rate(stats.prep_wins, prep_total)
    adj_battle_rate = bayesian_adjusted_rate(stats.battle_wins, battle_total)
    
    # Weighted combination: Prep 40%, Battle 60%
    base_score = (adj_prep_rate * 0.40 + adj_battle_rate * 0.60) * 10
    
    return base_score


def calculate_dom_inv_multiplier(stats: KingdomStats) -> float:
    """
    Calculate domination/invasion multiplier.
    Rewards consistent double wins, penalizes double losses equally.
    """
    if stats.total_kvks == 0:
        return 1.0
    
    dom_rate = stats.dominations / stats.total_kvks
    inv_rate = stats.invasions / stats.total_kvks
    
    # Domination bonus: up to +15%, Invasion penalty: up to -15%
    multiplier = 1.0 + (dom_rate * 0.15) - (inv_rate * 0.15)
    
    return max(0.85, min(1.15, multiplier))


def calculate_recent_form_multiplier(recent_outcomes: List[str]) -> float:
    """
    Calculate recent form multiplier based on last 5 KvK outcomes.
    Outcomes weighted by recency (most recent = highest weight).
    """
    if not recent_outcomes:
        return 1.0
    
    weighted_score = 0.0
    total_weight = 0.0
    
    for i, outcome in enumerate(recent_outcomes[:5]):
        weight = RECENT_FORM_WEIGHTS[i] if i < len(RECENT_FORM_WEIGHTS) else 0.2
        score = KVK_OUTCOME_SCORES.get(outcome, 0.5)
        
        weighted_score += score * weight
        total_weight += weight
    
    normalized_score = weighted_score / total_weight if total_weight > 0 else 0.5
    
    # Convert to multiplier: 0.85 to 1.15 range (±15%)
    # Score of 0.5 = 1.0 multiplier (neutral)
    multiplier = 1.0 + (normalized_score - 0.5) * 0.3
    
    return max(0.85, min(1.15, multiplier))


def calculate_streak_multiplier(prep_streak: int, battle_streak: int) -> float:
    """
    Calculate streak multiplier based on current win streaks.
    Battle streaks weighted more heavily than prep streaks.
    """
    # Prep streak bonus: 1% per win, max 6%
    prep_bonus = min(prep_streak, 6) * 0.01 if prep_streak > 0 else 0
    
    # Battle streak bonus: 1.5% per win, max 9% (battle streaks count more)
    battle_bonus = min(battle_streak, 6) * 0.015 if battle_streak > 0 else 0
    
    # Loss streaks: small penalty
    prep_penalty = min(abs(prep_streak), 3) * 0.01 if prep_streak < 0 else 0
    battle_penalty = min(abs(battle_streak), 3) * 0.015 if battle_streak < 0 else 0
    
    multiplier = 1.0 + prep_bonus + battle_bonus - prep_penalty - battle_penalty
    
    return max(0.91, min(1.15, multiplier))


def calculate_experience_factor(total_kvks: int) -> float:
    """
    Calculate experience factor using logarithmic scaling.
    Rewards proven veterans without over-penalizing newcomers.
    """
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
    
    # Full credit for 5+ KvKs with slight bonus for extensive history
    # Uses logarithmic scaling: log10(total+1) / log10(17) for gradual increase
    base = 1.0
    history_bonus = 0.5 * (math.log10(total_kvks + 1) / math.log10(EXPERIENCE_THRESHOLDS['VETERAN'] + 1))
    
    return min(1.0, base + history_bonus * 0.1)


def calculate_history_bonus(total_kvks: int) -> float:
    """Calculate history depth bonus. Small reward for extensive track record."""
    return min(MAX_HISTORY_BONUS, total_kvks * HISTORY_BONUS_PER_KVK)


# ============================================================================
# MAIN SCORE CALCULATION
# ============================================================================

def calculate_atlas_score(stats: KingdomStats) -> ScoreBreakdown:
    """Calculate the complete Atlas Score with full breakdown."""
    # Calculate each component
    base_score = calculate_base_score(stats)
    dom_inv_multiplier = calculate_dom_inv_multiplier(stats)
    recent_form_multiplier = calculate_recent_form_multiplier(stats.recent_outcomes)
    streak_multiplier = calculate_streak_multiplier(stats.current_prep_streak, stats.current_battle_streak)
    experience_factor = calculate_experience_factor(stats.total_kvks)
    history_bonus = calculate_history_bonus(stats.total_kvks)
    
    # Apply formula: (Base × Multipliers × Experience) + History Bonus
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
        tier=get_power_tier(final_score),
    )


def calculate_atlas_score_simple(stats: KingdomStats) -> float:
    """Simple score calculation (returns just the number)."""
    return calculate_atlas_score(stats).final_score


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_kvk_outcome(prep_result: str, battle_result: str) -> str:
    """Determine KvK outcome from prep and battle results."""
    prep_win = prep_result.upper() in ('W', 'WIN')
    battle_win = battle_result.upper() in ('W', 'WIN')
    
    if prep_win and battle_win:
        return 'Domination'
    if not prep_win and battle_win:
        return 'Comeback'
    if prep_win and not battle_win:
        return 'Reversal'
    return 'Invasion'


def extract_stats_from_kingdom(kingdom_data: dict, kvk_records: List[dict] = None) -> KingdomStats:
    """
    Extract KingdomStats from kingdom data dictionary.
    Compatible with both SQLAlchemy models and raw dictionaries.
    """
    # Sort KvK records by kvk_number descending (most recent first)
    sorted_kvks = sorted(kvk_records or [], key=lambda x: x.get('kvk_number', 0), reverse=True)
    
    # Helper to check if a result is a Bye (doesn't affect stats)
    def is_bye(result: str) -> bool:
        return result and result.lower() == 'bye'
    
    # Helper to check if a matchup is complete (both prep AND battle results present)
    def is_complete(kvk: dict) -> bool:
        prep = kvk.get('prep_result', '') or ''
        battle = kvk.get('battle_result', '') or ''
        return prep.upper() in ('W', 'L', 'WIN', 'LOSS') and battle.upper() in ('W', 'L', 'WIN', 'LOSS')
    
    # Filter out Bye results AND partial matchups - only complete matchups affect stats
    non_bye_kvks = [
        kvk for kvk in sorted_kvks
        if not is_bye(kvk.get('prep_result', '')) 
        and not is_bye(kvk.get('battle_result', ''))
        and not is_bye(kvk.get('overall_result', ''))
        and is_complete(kvk)
    ]
    
    # Calculate current streaks from recent KvKs (skip Byes - they don't break streaks)
    current_prep_streak = 0
    current_battle_streak = 0
    
    for kvk in non_bye_kvks:
        prep_win = kvk.get('prep_result', '').upper() in ('W', 'WIN')
        if current_prep_streak == 0:
            current_prep_streak = 1 if prep_win else -1
        elif (prep_win and current_prep_streak > 0) or (not prep_win and current_prep_streak < 0):
            current_prep_streak += 1 if prep_win else -1
        else:
            break
    
    # Reset for battle streak
    for kvk in non_bye_kvks:
        battle_win = kvk.get('battle_result', '').upper() in ('W', 'WIN')
        if current_battle_streak == 0:
            current_battle_streak = 1 if battle_win else -1
        elif (battle_win and current_battle_streak > 0) or (not battle_win and current_battle_streak < 0):
            current_battle_streak += 1 if battle_win else -1
        else:
            break
    
    # Get recent outcomes (most recent first, excluding Byes)
    recent_outcomes = []
    for kvk in non_bye_kvks[:5]:
        prep_result = kvk.get('prep_result', 'L')
        battle_result = kvk.get('battle_result', 'L')
        recent_outcomes.append(get_kvk_outcome(prep_result, battle_result))
    
    return KingdomStats(
        total_kvks=kingdom_data.get('total_kvks', 0),
        prep_wins=kingdom_data.get('prep_wins', 0),
        prep_losses=kingdom_data.get('prep_losses', 0),
        battle_wins=kingdom_data.get('battle_wins', 0),
        battle_losses=kingdom_data.get('battle_losses', 0),
        dominations=kingdom_data.get('dominations', 0),
        invasions=kingdom_data.get('invasions', kingdom_data.get('defeats', 0)),
        recent_outcomes=recent_outcomes,
        current_prep_streak=max(0, current_prep_streak),
        current_battle_streak=max(0, current_battle_streak),
    )


def get_score_components(stats: KingdomStats) -> ScoreComponents:
    """Get detailed score components for UI display."""
    prep_total = stats.prep_wins + stats.prep_losses
    battle_total = stats.battle_wins + stats.battle_losses
    
    return ScoreComponents(
        prep_win_rate_raw=stats.prep_wins / prep_total if prep_total > 0 else 0,
        prep_win_rate_adjusted=bayesian_adjusted_rate(stats.prep_wins, prep_total),
        prep_weight=40,
        battle_win_rate_raw=stats.battle_wins / battle_total if battle_total > 0 else 0,
        battle_win_rate_adjusted=bayesian_adjusted_rate(stats.battle_wins, battle_total),
        battle_weight=60,
        domination_rate=stats.dominations / stats.total_kvks if stats.total_kvks > 0 else 0,
        invasion_rate=stats.invasions / stats.total_kvks if stats.total_kvks > 0 else 0,
        recent_form_score=calculate_recent_form_multiplier(stats.recent_outcomes),
        prep_streak_bonus=min(stats.current_prep_streak, 6) * 0.01,
        battle_streak_bonus=min(stats.current_battle_streak, 6) * 0.015,
        experience_factor=calculate_experience_factor(stats.total_kvks),
    )


# ============================================================================
# PERCENTILE CALCULATIONS
# ============================================================================

def calculate_percentile(score: float, all_scores: List[float]) -> int:
    """Calculate the percentile rank of a score among all scores."""
    if not all_scores:
        return 50
    
    below_count = sum(1 for s in all_scores if s < score)
    return round((below_count / len(all_scores)) * 100)


def calculate_tier_thresholds_from_scores(all_scores: List[float]) -> Dict[PowerTier, float]:
    """
    Calculate tier thresholds based on actual score distribution.
    Returns percentile-based thresholds.
    """
    if not all_scores:
        return TIER_THRESHOLDS
    
    sorted_scores = sorted(all_scores, reverse=True)
    total = len(sorted_scores)
    
    return {
        PowerTier.S: sorted_scores[int(total * 0.03)] if total > 33 else TIER_THRESHOLDS[PowerTier.S],
        PowerTier.A: sorted_scores[int(total * 0.10)] if total > 10 else TIER_THRESHOLDS[PowerTier.A],
        PowerTier.B: sorted_scores[int(total * 0.25)] if total > 4 else TIER_THRESHOLDS[PowerTier.B],
        PowerTier.C: sorted_scores[int(total * 0.50)] if total > 2 else TIER_THRESHOLDS[PowerTier.C],
        PowerTier.D: 0,
    }


# ============================================================================
# SCORE TOOLTIPS
# ============================================================================

SCORE_TOOLTIPS = {
    'atlas_score': 'Comprehensive rating based on win rates, performance patterns, recent form, and experience. Rewards consistency over lucky streaks.',
    'base_score': 'Combined Prep (40%) and Battle (60%) win rates with Bayesian adjustment to prevent small sample bias.',
    'dom_inv_multiplier': 'Dominations boost your score; Invasions hurt it equally. Rewards consistent double-phase performance.',
    'recent_form': 'Your last 5 KvKs weighted by recency. Domination = 1.0, Comeback = 0.75, Reversal = 0.6, Invasion = 0.',
    'streak_bonus': 'Current win streaks provide a small boost. Battle streaks count 50% more than prep streaks.',
    'experience_factor': 'Kingdoms with 5+ KvKs get full credit. Newer kingdoms face a small penalty until they prove themselves.',
    'tier': 'Power tier based on Atlas Score percentile. S = Top 3%, A = Top 10%, B = Top 25%, C = Top 50%, D = Bottom 50%.',
}
