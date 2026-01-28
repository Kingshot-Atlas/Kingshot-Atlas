import pandas as pd
import numpy as np
import math
from pathlib import Path

def load_data():
    """Load the raw CSV files"""
    base_path = Path(__file__).parent / "data/raw"
    
    # Load the info file (result categories)
    info_df = pd.read_csv(base_path / "kvk_info.csv")
    
    # Load the results file with header at row 2 (index 2)
    results_df = pd.read_csv(base_path / "kvk_results.csv", header=2)
    
    return info_df, results_df

def parse_results_structure(results_df):
    """Parse the complex structure of the results CSV"""
    # Read the header row (index 1) to get KvK numbers and dates
    base_path = Path(__file__).parent / "data/raw"
    header_data = pd.read_csv(base_path / "kvk_results.csv", skiprows=1, nrows=1, header=None)
    header_row = header_data.iloc[0].tolist()
    
    # Find KvK columns and dates (they appear as pairs)
    kvk_data = []
    i = 0
    while i < len(header_row):
        cell = str(header_row[i]).strip()
        if cell.startswith("KvK"):
            kvk_num = cell.split()[1]
            date = str(header_row[i+1]) if i+1 < len(header_row) else ""
            kvk_data.append({"kvk_number": kvk_num, "date": date})
            i += 2
        else:
            i += 1
    
    return kvk_data

def extract_kingdom_matches(results_df, kvk_data):
    """Extract individual match data for each kingdom"""
    matches = []
    
    for _, row in results_df.iterrows():
        kingdom = row['Kingdom']
        
        # The opponent/result pairs start after the summary columns
        # Find the first opponent column (should be column 17, index 16)
        start_col = 16  # Zero-based index where opponent/result pairs start
        
        for i, kvk in enumerate(kvk_data):
            col_idx = start_col + (i * 2)
            
            if col_idx + 1 < len(row):
                opponent = row.iloc[col_idx]
                result = row.iloc[col_idx + 1]
                
                # Skip if opponent is N/A or result is empty
                if pd.notna(opponent) and pd.notna(result) and str(opponent) != 'N/A':
                    matches.append({
                        'kingdom_number': kingdom,
                        'kvk_number': kvk['kvk_number'],
                        'opponent_kingdom': opponent,
                        'result': result,
                        'kvk_date': kvk['date']
                    })
    
    return pd.DataFrame(matches)

def calculate_streaks(results_list):
    """Calculate win/loss streaks"""
    if not results_list:
        return 0
    
    current_streak = 1
    max_streak = 1
    
    for i in range(1, len(results_list)):
        if results_list[i] == results_list[i-1]:
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        else:
            current_streak = 1
    
    return max_streak


def wilson_score_lower_bound(wins, total, confidence=0.90):
    """
    Calculate Wilson Score lower bound - a confidence-adjusted win rate.
    This naturally penalizes small sample sizes.
    
    A 2-0 record (100%) gets ~65% confidence score
    A 8-1 record (89%) gets ~57% confidence score  
    A 80-10 record (89%) gets ~82% confidence score
    
    This rewards experienced kingdoms while still valuing win rate.
    """
    if total == 0:
        return 0.0
    
    p = wins / total
    n = total
    
    # Z-scores for common confidence levels (no scipy needed)
    z_scores = {0.90: 1.645, 0.95: 1.96, 0.99: 2.576}
    z = z_scores.get(confidence, 1.645)
    
    denominator = 1 + z**2 / n
    center = p + z**2 / (2 * n)
    spread = z * math.sqrt((p * (1 - p) + z**2 / (4 * n)) / n)
    
    lower_bound = (center - spread) / denominator
    return max(0, lower_bound)  # Ensure non-negative


def calculate_atlas_score(total_kvks, prep_wins, prep_losses, battle_wins, battle_losses,
                          dominations, defeats, recent_results):
    """
    Calculate Atlas Score using hybrid formula with Wilson Score confidence adjustment.
    
    Key improvement: Uses Wilson Score lower bound to calculate confidence-adjusted
    win rates. This naturally penalizes small sample sizes - a kingdom with 2-0 (100%)
    won't outrank one with 8-1 (89%) because we can't be confident in the 2-0 rate.
    
    Components:
    - Component 1: Confidence-adjusted win rate (Wilson Score lower bound)
    - Component 2: Domination/Defeat modifier  
    - Component 3: Recent form from last 3 KvKs
    - Component 4: Light experience scaling for very new kingdoms only
    
    Score can be negative for poorly performing kingdoms.
    """
    total_matches = prep_wins + prep_losses
    if total_matches == 0:
        return 0.0  # No data
    
    # === COMPONENT 1: Confidence-Adjusted Win Rate (Wilson Score) ===
    # This is the key improvement - uses statistical confidence intervals
    # to properly weight win rates based on sample size
    prep_wilson = wilson_score_lower_bound(prep_wins, total_matches, confidence=0.90)
    battle_wilson = wilson_score_lower_bound(battle_wins, total_matches, confidence=0.90)
    
    # Weighted combined rate (battle slightly more important)
    combined_wilson = (prep_wilson * 0.3) + (battle_wilson * 0.7)
    
    # === COMPONENT 2: Domination/Defeat Modifier ===
    # Also use Wilson Score for these rates
    dom_wilson = wilson_score_lower_bound(dominations, total_kvks, confidence=0.90) if total_kvks > 0 else 0
    def_wilson = wilson_score_lower_bound(defeats, total_kvks, confidence=0.90) if total_kvks > 0 else 0
    
    # Bonus for domination-heavy kingdoms, penalty for defeat-heavy
    dominance_modifier = (dom_wilson * 0.6) - (def_wilson * 0.4)  # Range: -0.4 to +0.6
    
    # === COMPONENT 3: Recent Form (last 3 KvKs) ===
    weights = [1.0, 0.75, 0.5]  # Most recent first
    recent_score = 0
    total_weight = 0
    
    for i, result in enumerate(recent_results[:3]):
        weight = weights[i] if i < len(weights) else 0.3
        if result == 'D':      # Domination (won both phases)
            recent_score += 1.0 * weight
        elif result == 'W':    # Partial win (Prep or Battle only)
            recent_score += 0.5 * weight
        elif result == 'L':    # Partial loss
            recent_score += 0.0 * weight
        elif result == 'F':    # Full defeat (lost both phases)
            recent_score -= 0.25 * weight
        total_weight += weight
    
    recent_form = recent_score / total_weight if total_weight > 0 else 0  # Range: -0.25 to 1.0
    
    # === COMPONENT 4: Light Experience Factor (only for very new kingdoms) ===
    # Since Wilson Score already penalizes small samples, we only need a small
    # additional penalty for kingdoms with < 3 KvKs (too new to judge)
    if total_kvks < 3:
        experience_factor = 0.6 + (total_kvks * 0.15)  # 0.6 for 0 KvKs, 0.9 for 2 KvKs
    else:
        experience_factor = 1.0  # No penalty for 3+ KvKs
    
    # === FINAL SCORE ===
    base_score = combined_wilson * 10                      # 0 to 10
    adjusted_score = base_score + (dominance_modifier * 5) # -2.5 to 12.5
    form_bonus = recent_form * 4                           # -1.0 to 4.0
    
    raw_score = adjusted_score + form_bonus
    final_score = raw_score * experience_factor
    
    return round(final_score, 2)

def process_kingdom_summary(results_df, matches_df):
    """Create kingdom summary statistics"""
    kingdoms = []
    
    for kingdom in results_df['Kingdom'].unique():
        kingdom_data = results_df[results_df['Kingdom'] == kingdom].iloc[0]
        kingdom_matches = matches_df[matches_df['kingdom_number'] == kingdom]
        
        # Count wins/losses from actual match results instead of summary columns
        prep_wins = 0
        prep_losses = 0
        battle_wins = 0
        battle_losses = 0
        
        for _, match in kingdom_matches.iterrows():
            result = match['result']
            if result == 'Win':
                prep_wins += 1
                battle_wins += 1
            elif result == 'Preparation':
                prep_wins += 1
                battle_losses += 1
            elif result == 'Battle':
                prep_losses += 1
                battle_wins += 1
            elif result == 'Loss':
                prep_losses += 1
                battle_losses += 1
        
        # Basic stats from the summary columns
        total_kvks = kingdom_data['KvKs']
        total_wins = kingdom_data['Wins']
        total_losses = kingdom_data['Losses']
        byes = kingdom_data['Byes']
        
        # Calculate win rates from actual counts
        total_matches = prep_wins + prep_losses  # This should equal battle_wins + battle_losses
        prep_win_rate = prep_wins / total_matches if total_matches > 0 else 0
        battle_win_rate = battle_wins / total_matches if total_matches > 0 else 0
        
        # Debug print for Kingdom 172
        if kingdom == 172:
            print(f"DEBUG Kingdom 172: From match results")
            print(f"DEBUG Kingdom 172: Prep record: {prep_wins}-{prep_losses} ({prep_win_rate:.3f})")
            print(f"DEBUG Kingdom 172: Battle record: {battle_wins}-{battle_losses} ({battle_win_rate:.3f})")
        
        # Calculate streaks and categorize results
        prep_results = []
        battle_results = []
        outcome_categories = []  # D=Domination, W=Partial Win, L=Partial Loss, F=Full Defeat
        dominations = 0  # Won both phases (High King)
        defeats = 0      # Lost both phases (Invader King)
        
        for _, match in kingdom_matches.iterrows():
            result = match['result']
            if result == 'Win':
                prep_results.append('W')
                battle_results.append('W')
                outcome_categories.append('D')  # Domination
                dominations += 1
            elif result == 'Preparation':
                prep_results.append('W')
                battle_results.append('L')
                outcome_categories.append('W')  # Partial win
            elif result == 'Battle':
                prep_results.append('L')
                battle_results.append('W')
                outcome_categories.append('W')  # Partial win
            elif result == 'Loss':
                prep_results.append('L')
                battle_results.append('L')
                outcome_categories.append('F')  # Full defeat
                defeats += 1
        
        prep_streak = calculate_streaks(prep_results)
        battle_streak = calculate_streaks(battle_results)
        
        # All kingdoms are Unannounced until manually set by moderators
        most_recent_status = 'Unannounced'
        
        # Get last 3 outcomes for recent form calculation (most recent first)
        recent_outcomes = outcome_categories[-3:][::-1] if outcome_categories else []
        
        # Calculate overall score using new hybrid formula
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
            'kingdom_number': kingdom,
            'total_kvks': total_kvks,
            'prep_wins': prep_wins,
            'prep_losses': prep_losses,
            'prep_win_rate': round(prep_win_rate, 3),
            'prep_win_streak': prep_streak,
            'battle_wins': battle_wins,
            'battle_losses': battle_losses,
            'battle_win_rate': round(battle_win_rate, 3),
            'battle_win_streak': battle_streak,
            'dominations': dominations,
            'defeats': defeats,
            'most_recent_status': most_recent_status,
            'overall_score': overall_score
        })
    
    return pd.DataFrame(kingdoms)

def create_all_kvks(matches_df):
    """Create ALL KvK details for each kingdom"""
    all_data = []
    
    for kingdom in matches_df['kingdom_number'].unique():
        kingdom_matches = matches_df[matches_df['kingdom_number'] == kingdom]
        
        for idx, (_, match) in enumerate(kingdom_matches.iterrows()):
            result = match['result']
            
            # Determine phase results
            prep_result = 'W' if result in ['Win', 'Preparation'] else 'L'
            battle_result = 'W' if result in ['Win', 'Battle'] else 'L'
            overall_result = result  # Store the full result text (Win, Preparation, Battle, Loss)
            
            all_data.append({
                'kingdom_number': match['kingdom_number'],
                'kvk_number': match['kvk_number'],
                'opponent_kingdom': match['opponent_kingdom'],
                'prep_result': prep_result,
                'battle_result': battle_result,
                'overall_result': overall_result,
                'kvk_date': match['kvk_date'] if match['kvk_date'] else '',
                'order_index': idx + 1
            })
    
    return pd.DataFrame(all_data)

def create_last5_kvks(matches_df):
    """Create last 5 KvK details for each kingdom (for card display)"""
    last5_data = []
    
    for kingdom in matches_df['kingdom_number'].unique():
        kingdom_matches = matches_df[matches_df['kingdom_number'] == kingdom]
        
        # Get last 5 matches (most recent)
        recent_matches = kingdom_matches.tail(5)
        
        for _, match in recent_matches.iterrows():
            result = match['result']
            
            # Determine phase results
            prep_result = 'W' if result in ['Win', 'Preparation'] else 'L'
            battle_result = 'W' if result in ['Win', 'Battle'] else 'L'
            overall_result = result  # Store the full result text (Win, Preparation, Battle, Loss)
            
            last5_data.append({
                'kingdom_number': match['kingdom_number'],
                'kvk_number': match['kvk_number'],
                'opponent_kingdom': match['opponent_kingdom'],
                'prep_result': prep_result,
                'battle_result': battle_result,
                'overall_result': overall_result,  # This will now be "Win", "Preparation", "Battle", or "Loss"
                'kvk_date': match['kvk_date'] if match['kvk_date'] else '',
                'order_index': len(recent_matches) - list(recent_matches.index).index(_)  # Reverse order for recent first
            })
    
    return pd.DataFrame(last5_data)

def main():
    """Main processing function"""
    print("Loading data...")
    info_df, results_df = load_data()
    
    print("Parsing results structure...")
    kvk_data = parse_results_structure(results_df)
    
    print("Extracting match details...")
    matches_df = extract_kingdom_matches(results_df, kvk_data)
    
    print("Creating kingdom summary...")
    kingdoms_summary = process_kingdom_summary(results_df, matches_df)
    
    print("Creating ALL KvK details...")
    all_kvks = create_all_kvks(matches_df)
    
    print("Creating last 5 KvK details...")
    last5_kvks = create_last5_kvks(matches_df)
    
    # Create processed directory
    processed_dir = Path(__file__).parent / "data/processed"
    processed_dir.mkdir(exist_ok=True)
    
    # Save outputs
    print("Saving files...")
    kingdoms_summary.to_csv(processed_dir / "kingdoms_summary.csv", index=False)
    all_kvks.to_csv(processed_dir / "kingdoms_all_kvks.csv", index=False)
    last5_kvks.to_csv(processed_dir / "kingdoms_last5_kvks.csv", index=False)
    
    print("Processing complete!")
    print(f"Processed {len(kingdoms_summary)} kingdoms")
    print(f"Generated {len(all_kvks)} total KvK records")
    print(f"Generated {len(last5_kvks)} recent match records (last 5 per kingdom)")
    
    return kingdoms_summary, all_kvks, last5_kvks

if __name__ == "__main__":
    main()
