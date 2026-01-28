#!/usr/bin/env python3
"""
Regenerate kingdoms.json with ALL KvK records from the raw CSV file.
Uses only standard library (no pandas).
"""
import csv
import json

# Read the raw KvK results CSV (skip first 2 header rows)
with open('data/raw/kvk_results.csv', 'r') as f:
    reader = csv.reader(f)
    next(reader)  # Skip row 1
    next(reader)  # Skip row 2
    header = next(reader)  # Row 3 is the actual header
    raw_rows = list(reader)

# Read the kingdoms summary for base stats
with open('data/processed/kingdoms_summary.csv', 'r') as f:
    reader = csv.DictReader(f)
    kingdoms_rows = list(reader)

# KvK dates from the raw CSV header
kvk_dates = {
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

# Build kingdoms list from summary CSV
kingdoms = []
for row in kingdoms_rows:
    kingdoms.append({
        'kingdom_number': int(row['kingdom_number']),
        'total_kvks': int(row['total_kvks']),
        'prep_wins': int(row['prep_wins']),
        'prep_losses': int(row['prep_losses']),
        'prep_win_rate': float(row['prep_win_rate']),
        'prep_streak': int(row['prep_win_streak']),
        'battle_wins': int(row['battle_wins']),
        'battle_losses': int(row['battle_losses']),
        'battle_win_rate': float(row['battle_win_rate']),
        'battle_streak': int(row['battle_win_streak']),
        'most_recent_status': str(row['most_recent_status']),
        'overall_score': float(row['overall_score'])
    })

# Parse KvK records from raw data
kvk_records = []

# The raw CSV has columns: Row Status, Kingdom, KvKs, ..., then pairs of Opponent/Result for each KvK
# Column indices: 16=KvK1 Opp, 17=KvK1 Result, 18=KvK2 Opp, 19=KvK2 Result, etc.

for row in raw_rows:
    if len(row) < 2 or not row[1]:
        continue
    try:
        kingdom_num = int(row[1])
    except ValueError:
        continue
    
    # Process each KvK (1-9)
    for kvk_num in range(1, 10):
        # Column indices for opponent and result
        opp_col_idx = 16 + (kvk_num - 1) * 2
        result_col_idx = opp_col_idx + 1
        
        if result_col_idx >= len(row):
            continue
            
        opponent = row[opp_col_idx].strip() if row[opp_col_idx] else ''
        result = row[result_col_idx].strip() if row[result_col_idx] else ''
        
        # Skip N/A or empty entries
        if not opponent or opponent == 'N/A':
            continue
        if not result or result == 'N/A':
            continue
            
        # Parse opponent (could be float or int)
        try:
            opp_kingdom = int(float(opponent))
        except (ValueError, TypeError):
            continue
        
        # Determine prep/battle results from overall result
        if result == 'Win':
            prep = 'W'
            battle = 'W'
        elif result == 'Loss':
            prep = 'L'
            battle = 'L'
        elif result == 'Preparation':
            prep = 'W'
            battle = 'L'
        elif result == 'Battle':
            prep = 'L'
            battle = 'W'
        elif result == 'Bye':
            continue
        else:
            continue
        
        kvk_records.append({
            'kingdom_number': kingdom_num,
            'kvk_number': kvk_num,
            'opponent_kingdom': opp_kingdom,
            'prep_result': prep,
            'battle_result': battle,
            'overall_result': result,
            'date_or_order_index': kvk_dates.get(kvk_num, '')
        })

# Create the final JSON structure
data = {
    'kingdoms': kingdoms,
    'kvk_records': kvk_records
}

# Write to the web app's data folder
output_path = 'apps/web/src/data/kingdoms.json'
with open(output_path, 'w') as f:
    json.dump(data, f)

print(f"Generated {output_path}")
print(f"Total kingdoms: {len(kingdoms)}")
print(f"Total KvK records: {len(kvk_records)}")

# Verify some kingdom data
for k_num in [1, 3, 12]:
    k_kvks = [r for r in kvk_records if r['kingdom_number'] == k_num]
    print(f"\nKingdom {k_num} has {len(k_kvks)} KvK records:")
    for kvk in sorted(k_kvks, key=lambda x: x['kvk_number']):
        print(f"  KvK {kvk['kvk_number']} vs K{kvk['opponent_kingdom']}: P:{kvk['prep_result']} B:{kvk['battle_result']} = {kvk['overall_result']}")
