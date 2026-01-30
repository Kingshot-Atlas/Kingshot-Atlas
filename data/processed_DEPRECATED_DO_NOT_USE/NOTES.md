# Kingshot KvK Data Processing Notes

## Data Sources
- **Input**: `kvk_info.csv` and `kvk_results.csv` from `/data/raw/`
- **Output**: Processed CSV files in `/data/processed/`

## Column Mapping and Structure

### Raw Data Structure
The results CSV has a complex structure:
- **Row 1**: Column status indicators
- **Row 2**: KvK numbers and dates (header row for parsing)
- **Row 3**: Column names (used as header=2 for pandas)
- **Rows 4+**: Kingdom data with summary stats followed by opponent/result pairs

### Key Raw Data Columns
- `Kingdom`: Kingdom number (1-1190)
- `KvKs`: Total number of KvKs participated
- `Wins`: Overall wins (both phases)
- `Preparations`: Preparation phase wins
- `Battles`: Battle phase wins  
- `Losses`: Overall losses
- `Byes`: Rounds with no opponent

### Match Data Structure
After column 16, data appears as pairs:
- Column 16, 18, 20...: Opponent kingdom numbers
- Column 17, 19, 21...: Result categories

## Result Categories (from Info.csv)
- **Win**: Won both preparation and battle phases
- **Preparation**: Won preparation phase, lost battle phase
- **Battle**: Won battle phase, lost preparation phase  
- **Loss**: Lost both phases
- **Bye**: No opponent received
- **Draw**: Won one phase but unknown which
- **N/A**: No opponent/kingdom too young

## Processing Assumptions

### 1. Phase-specific Win/Loss Calculation
- **Preparation wins**: From `Preparations` column
- **Battle wins**: From `Battles` column
- **Preparation losses**: `Total KvKs - Preparation wins - Byes`
- **Battle losses**: `Total KvKs - Battle wins - Byes`

### 2. Win Rate Calculation
- Formula: `wins / (wins + losses)`
- Excludes byes from denominator
- Rounded to 3 decimal places

### 3. Streak Calculation
- Analyzes chronological sequence of W/L results per phase
- Returns maximum consecutive streak length
- Based on parsed match results, not summary columns

### 4. Overall Score
- **Weighting**: Preparation:Battles = 1:2
- **Formula**: `(prep_win_rate * 1) + (battle_win_rate * 2)`
- Rounded to 3 decimal places

### 5. Most Recent Status
- **Leading**: Last match was "Win" (won both phases)
- **Ordinary**: Last match was "Loss", "Preparation", or "Battle" (mixed result)
- **Unannounced**: Default status when no match data available

### 6. Last 5 KvK Details
- Extracts most recent 5 matches per kingdom
- Converts result categories to W/L per phase:
  - `Win` → Prep:W, Battle:W, Overall:W
  - `Preparation` → Prep:W, Battle:L, Overall:L  
  - `Battle` → Prep:L, Battle:W, Overall:L
  - `Loss` → Prep:L, Battle:L, Overall:L

## Data Quality Issues

### Missing/Incomplete Data
- Some kingdoms have fewer than 9 KvKs (newer kingdoms)
- Opponent numbers may be floats due to CSV parsing
- "N/A" values filtered out from match details

### Inferred Values
- Phase-specific losses calculated rather than directly provided
- Streaks calculated from match-by-match analysis
- Status categories inferred from last match result

## Output Schema

### kingdoms_summary.csv
| Column | Description |
|--------|-------------|
| kingdom_number | Unique kingdom identifier |
| total_kvks | Total KvKs participated |
| prep_wins | Preparation phase wins |
| prep_losses | Preparation phase losses |
| prep_win_rate | Preparation win rate |
| prep_streak | Max consecutive preparation W/L streak |
| battle_wins | Battle phase wins |
| battle_losses | Battle phase losses |
| battle_win_rate | Battle win rate |
| battle_streak | Max consecutive battle W/L streak |
| most_recent_status | Leading/Ordinary based on last match |
| overall_score | Weighted score (prep:battle = 1:2) |

### kingdoms_last5_kvks.csv
| Column | Description |
|--------|-------------|
| kingdom_number | Kingdom identifier |
| kvk_number | KvK event number |
| opponent_kingdom | Opponent's kingdom number |
| prep_result | W/L for preparation phase |
| battle_result | W/L for battle phase |
| overall_result | W/L for overall match |
| kvk_date | Date of KvK event (if available) |
| order_index | Reverse chronological order (5=most recent, 1=oldest of last 5) |

## Processing Summary
- **Total kingdoms processed**: 1,190 (complete range 1-1190)
- **Total match records**: 3,555 (last 5 matches per kingdom, some kingdoms have fewer)
- **KvK events covered**: 9 (May 2025 - January 2026)
- **Deterministic processing**: All calculations are reproducible

## Exact Formula Details

### Phase-specific Loss Calculation
```
total_matches = total_kvks - byes
prep_losses = total_matches - prep_wins
battle_losses = total_matches - battle_wins
```

### Win Rate Calculation
```
prep_win_rate = prep_wins / (prep_wins + prep_losses) if (prep_wins + prep_losses) > 0 else 0
battle_win_rate = battle_wins / (battle_wins + battle_losses) if (battle_wins + battle_losses) > 0 else 0
```

### Overall Score Formula
```
overall_score = (prep_win_rate * 1) + (battle_win_rate * 2)
```
- Preparation phase weighted as 1x
- Battle phase weighted as 2x (higher importance)
- Score range: 0.0 to 3.0
- Rounded to 3 decimal places

### Streak Calculation Algorithm
1. Convert match results to W/L sequence per phase
2. Iterate through sequence tracking consecutive same results
3. Return maximum streak length found
4. Empty sequences return 0
