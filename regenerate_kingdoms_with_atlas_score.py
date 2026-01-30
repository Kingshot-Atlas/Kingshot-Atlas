#!/usr/bin/env python3
"""
Regenerate kingdoms.json with the correct Atlas Score formula.
Uses Wilson Score confidence intervals for proper sample-size weighting.
Uses only standard library (no pandas required).
"""
import csv
import json
import math
from pathlib import Path

# KvK dates mapping
KVK_DATES = {
    1: "May 24, 2025",
    2: "Jun 21, 2025",
    3: "Jul 19, 2025",
    4: "Aug 16, 2025",
    5: "Sep 13, 2025",
    6: "Oct 11, 2025",
    7: "Nov 8, 2025",
    8: "Dec 6, 2025",
    9: "Jan 3, 2026"
}


def bayesian_adjusted_win_rate(wins, losses, prior_wins=45, prior_losses=55):
    """
    Bayesian average with moderate prior toward 45% win rate.
    This penalizes small samples but less aggressively than the previous version.
    
    Formula: (wins + prior_wins) / (wins + losses + prior_wins + prior_losses)
    
    Examples:
    - 2-0 (100%) → (2+45)/(2+0+100) = 47/104 = 45.2%
    - 8-1 (89%) → (8+45)/(8+1+100) = 53/109 = 48.6%
    - 80-10 (89%) → (80+45)/(80+10+100) = 125/190 = 65.8%
    """
    total_wins = wins + prior_wins
    total_games = wins + losses + prior_wins + prior_losses
    return total_wins / total_games if total_games > 0 else 0.0


def wilson_score_lower_bound(wins, total, confidence=0.90):
    """
    Calculate Wilson Score lower bound - a confidence-adjusted win rate.
    This naturally penalizes small sample sizes.
    
    A 2-0 record (100%) gets ~65% confidence score
    A 8-1 record (89%) gets ~57% confidence score  
    A 80-10 record (89%) gets ~82% confidence score
    """
    if total == 0:
        return 0.0
    
    p = wins / total
    n = total
    
    # Z-scores for common confidence levels
    z_scores = {0.90: 1.645, 0.95: 1.96, 0.99: 2.576}
    z = z_scores.get(confidence, 1.645)
    
    denominator = 1 + z**2 / n
    center = p + z**2 / (2 * n)
    spread = z * math.sqrt((p * (1 - p) + z**2 / (4 * n)) / n)
    
    lower_bound = (center - spread) / denominator
    return max(0, lower_bound)


def calculate_atlas_score(total_kvks, prep_wins, prep_losses, battle_wins, battle_losses,
                          dominations, defeats, recent_results):
    """
    Calculate Atlas Score using improved Bayesian Average approach.
    
    Uses moderate Bayesian priors to balance penalizing small samples while 
    still rewarding strong performance. Enhanced with 5-KvK recent form.
    
    Key changes:
    - Moderate Bayesian priors (45% prior, 100 weight) instead of aggressive
    - Expanded recent form to 5 KvKs with better weight distribution
    - Enhanced experience scaling (25% → 115% across 1-10+ KvKs)
    - Increased domination/defeat weight to ±8 points
    - Bonus experience multiplier for 7+ KvKs (rewards veterans)
    """
    total_matches = prep_wins + prep_losses
    if total_matches == 0:
        return 0.0
    
    # === COMPONENT 1: Bayesian-Adjusted Win Rate ===
    # Moderate prior toward 45% with 100 weight (45 wins, 55 losses)
    prep_bayesian = bayesian_adjusted_win_rate(prep_wins, prep_losses, 45, 55)
    battle_bayesian = bayesian_adjusted_win_rate(battle_wins, battle_losses, 45, 55)
    
    # Weighted combined rate
    combined_bayesian = (prep_bayesian * 0.3) + (battle_bayesian * 0.7)
    
    # === COMPONENT 2: Domination/Defeat Modifier (also Bayesian) ===
    # Fix: Pass (wins, losses) not (wins, total) - total_kvks includes wins, causing double-counting
    dom_bayesian = bayesian_adjusted_win_rate(dominations, total_kvks - dominations, 10, 10) if total_kvks > 0 else 0
    def_bayesian = bayesian_adjusted_win_rate(defeats, total_kvks - defeats, 10, 10) if total_kvks > 0 else 0
    
    # Increased weight for domination/defeat pattern
    dominance_modifier = (dom_bayesian * 0.8) - (def_bayesian * 0.6)
    
    # === COMPONENT 3: Recent Form (expanded to 5 KvKs) ===
    weights = [1.0, 0.9, 0.8, 0.7, 0.6]
    recent_score = 0
    total_weight = 0
    
    for i, result in enumerate(recent_results[:5]):
        weight = weights[i] if i < len(weights) else 0.5
        if result == 'D':      # Domination (won both phases)
            recent_score += 1.0 * weight
        elif result == 'W':    # Partial win (Prep or Battle only)
            recent_score += 0.5 * weight
        elif result == 'L':    # Partial loss
            recent_score += 0.0 * weight
        elif result == 'F':    # Full defeat (lost both phases)
            recent_score -= 0.25 * weight
        total_weight += weight
    
    recent_form = recent_score / total_weight if total_weight > 0 else 0
    
    # === COMPONENT 4: Enhanced Experience Scaling ===
    # Much steeper curve for experience - rewards proven performance
    if total_kvks == 0:
        experience_factor = 0.0
    elif total_kvks == 1:
        experience_factor = 0.25
    elif total_kvks == 2:
        experience_factor = 0.4
    elif total_kvks == 3:
        experience_factor = 0.55
    elif total_kvks == 4:
        experience_factor = 0.7
    elif total_kvks == 5:
        experience_factor = 0.85
    elif total_kvks == 6:
        experience_factor = 0.95
    elif total_kvks == 7:
        experience_factor = 1.0
    elif total_kvks == 8:
        experience_factor = 1.05
    elif total_kvks == 9:
        experience_factor = 1.1
    else:
        experience_factor = 1.15
    
    # === FINAL SCORE ===
    base_score = combined_bayesian * 10
    adjusted_score = base_score + (dominance_modifier * 8)  # Increased weight
    form_bonus = recent_form * 4
    
    raw_score = adjusted_score + form_bonus
    final_score = raw_score * experience_factor
    
    return round(final_score, 2)


def calculate_current_streak(results, phase):
    """Calculate current consecutive win streak from most recent KvK."""
    streak = 0
    for result in results:  # Results should be in order from most recent to oldest
        if result == 'W':
            streak += 1
        else:
            break
    return streak


def calculate_best_streak(results):
    """Calculate best ever win streak."""
    best = 0
    current = 0
    for result in results:
        if result == 'W':
            current += 1
            best = max(best, current)
        else:
            current = 0
    return best


def calculate_current_loss_streak(results):
    """Calculate current consecutive loss streak from most recent KvK."""
    streak = 0
    for result in results:
        if result == 'L':
            streak += 1
        else:
            break
    return streak


def main():
    base_path = Path(__file__).parent
    
    # Read raw KvK results CSV
    csv_path = base_path / 'data/raw/kvk_results.csv'
    print(f"Reading {csv_path}...")
    
    with open(csv_path, 'r') as f:
        reader = csv.reader(f)
        next(reader)  # Skip row 1
        next(reader)  # Skip row 2
        header = next(reader)  # Row 3 is the actual header
        raw_rows = list(reader)
    
    # Parse all KvK matches for each kingdom
    kingdom_matches = {}  # {kingdom_number: [{kvk_number, result, opponent}]}
    
    for row in raw_rows:
        if len(row) < 2 or not row[1]:
            continue
        try:
            kingdom_num = int(row[1])
        except ValueError:
            continue
        
        if kingdom_num not in kingdom_matches:
            kingdom_matches[kingdom_num] = []
        
        # Process each KvK (1-9)
        for kvk_num in range(1, 10):
            opp_col_idx = 16 + (kvk_num - 1) * 2
            result_col_idx = opp_col_idx + 1
            
            if result_col_idx >= len(row):
                continue
            
            opponent = row[opp_col_idx].strip() if row[opp_col_idx] else ''
            result = row[result_col_idx].strip() if row[result_col_idx] else ''
            
            if not opponent or opponent == 'N/A' or not result or result == 'N/A' or result == 'Bye':
                continue
            
            try:
                opp_kingdom = int(float(opponent))
            except (ValueError, TypeError):
                continue
            
            kingdom_matches[kingdom_num].append({
                'kvk_number': kvk_num,
                'opponent_kingdom': opp_kingdom,
                'result': result
            })
    
    # Process each kingdom
    kingdoms = []
    kvk_records = []
    
    for kingdom_num in sorted(kingdom_matches.keys()):
        matches = sorted(kingdom_matches[kingdom_num], key=lambda x: x['kvk_number'])
        
        # Count stats
        prep_wins = 0
        prep_losses = 0
        battle_wins = 0
        battle_losses = 0
        dominations = 0
        defeats = 0
        
        prep_results = []  # For streak calculation (chronological order)
        battle_results = []
        outcome_categories = []
        
        for match in matches:
            result = match['result']
            
            if result == 'Win':
                prep_wins += 1
                battle_wins += 1
                dominations += 1
                prep_results.append('W')
                battle_results.append('W')
                outcome_categories.append('D')
            elif result == 'Loss':
                prep_losses += 1
                battle_losses += 1
                defeats += 1
                prep_results.append('L')
                battle_results.append('L')
                outcome_categories.append('F')
            elif result == 'Preparation':
                prep_wins += 1
                battle_losses += 1
                prep_results.append('W')
                battle_results.append('L')
                outcome_categories.append('W')
            elif result == 'Battle':
                prep_losses += 1
                battle_wins += 1
                prep_results.append('L')
                battle_results.append('W')
                outcome_categories.append('W')
            
            # Build KvK record
            prep = 'W' if result in ['Win', 'Preparation'] else 'L'
            battle = 'W' if result in ['Win', 'Battle'] else 'L'
            
            kvk_records.append({
                'kingdom_number': kingdom_num,
                'kvk_number': match['kvk_number'],
                'opponent_kingdom': match['opponent_kingdom'],
                'prep_result': prep,
                'battle_result': battle,
                'overall_result': result,
                'date_or_order_index': KVK_DATES.get(match['kvk_number'], '')
            })
        
        total_kvks = len(matches)
        total_matches = prep_wins + prep_losses
        
        prep_win_rate = prep_wins / total_matches if total_matches > 0 else 0
        battle_win_rate = battle_wins / total_matches if total_matches > 0 else 0
        
        # Calculate streaks (reverse for most recent first)
        prep_reversed = prep_results[::-1]
        battle_reversed = battle_results[::-1]
        
        prep_streak = calculate_current_streak(prep_reversed, 'prep')
        battle_streak = calculate_current_streak(battle_reversed, 'battle')
        prep_loss_streak = calculate_current_loss_streak(prep_reversed)
        battle_loss_streak = calculate_current_loss_streak(battle_reversed)
        prep_best_streak = calculate_best_streak(prep_results)
        battle_best_streak = calculate_best_streak(battle_results)
        
        # Get recent outcomes for Atlas Score (most recent first)
        recent_outcomes = outcome_categories[-3:][::-1] if outcome_categories else []
        
        # Calculate Atlas Score
        overall_score = calculate_atlas_score(
            total_kvks=total_kvks,
            prep_wins=prep_wins,
            prep_losses=prep_losses,
            battle_wins=battle_wins,
            battle_losses=battle_losses,
            dominations=dominations,
            defeats=defeats,
            recent_results=recent_outcomes
        )
        
        kingdoms.append({
            'kingdom_number': kingdom_num,
            'total_kvks': total_kvks,
            'prep_wins': prep_wins,
            'prep_losses': prep_losses,
            'prep_win_rate': prep_win_rate,
            'prep_streak': prep_streak,
            'battle_wins': battle_wins,
            'battle_losses': battle_losses,
            'battle_win_rate': battle_win_rate,
            'battle_streak': battle_streak,
            'dominations': dominations,
            'defeats': defeats,
            'most_recent_status': 'Unannounced',
            'overall_score': overall_score,
            'prep_loss_streak': prep_loss_streak,
            'prep_best_streak': prep_best_streak,
            'battle_loss_streak': battle_loss_streak,
            'battle_best_streak': battle_best_streak
        })
    
    # Create output
    data = {
        'kingdoms': kingdoms,
        'kvk_records': kvk_records
    }
    
    output_path = base_path / 'apps/web/src/data/kingdoms.json'
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"\nGenerated {output_path}")
    print(f"Total kingdoms: {len(kingdoms)}")
    print(f"Total KvK records: {len(kvk_records)}")
    
    # Show some sample scores
    print("\nSample Atlas Scores (using Bayesian Average formula):")
    for k in sorted(kingdoms, key=lambda x: -x['overall_score'])[:10]:
        print(f"  K{k['kingdom_number']}: {k['overall_score']:.2f} (P:{k['prep_win_rate']*100:.0f}% B:{k['battle_win_rate']*100:.0f}% Dom:{k['dominations']} Def:{k['defeats']})")
    
    print("\nLowest scores:")
    for k in sorted(kingdoms, key=lambda x: x['overall_score'])[:5]:
        print(f"  K{k['kingdom_number']}: {k['overall_score']:.2f} (P:{k['prep_win_rate']*100:.0f}% B:{k['battle_win_rate']*100:.0f}% Dom:{k['dominations']} Def:{k['defeats']})")


if __name__ == "__main__":
    main()
