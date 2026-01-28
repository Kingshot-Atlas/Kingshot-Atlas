#!/usr/bin/env python3
"""
Regenerate kingdoms.json from the processed CSV files with correct kvk_numbers.
"""
import pandas as pd
import json

# Read the processed CSV files
kingdoms_df = pd.read_csv('data/processed/kingdoms_summary.csv')
kvks_df = pd.read_csv('data/processed/kingdoms_last5_kvks.csv')

# Build kingdoms list
kingdoms = []
for _, row in kingdoms_df.iterrows():
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
        'dominations': int(row['dominations']),
        'defeats': int(row['defeats']),
        'most_recent_status': str(row['most_recent_status']),
        'overall_score': float(row['overall_score'])
    })

# Build KvK records list with CORRECT kvk_number from the CSV
kvk_records = []
for _, row in kvks_df.iterrows():
    # Map prep/battle results
    prep = 'W' if row['prep_result'] == 'W' else 'L'
    battle = 'W' if row['battle_result'] == 'W' else 'L'
    
    kvk_records.append({
        'kingdom_number': int(row['kingdom_number']),
        'kvk_number': int(row['kvk_number']),  # Use the ACTUAL kvk_number from CSV
        'opponent_kingdom': int(row['opponent_kingdom']) if pd.notna(row['opponent_kingdom']) else 0,
        'prep_result': prep,
        'battle_result': battle,
        'overall_result': str(row['overall_result']),
        'date_or_order_index': str(row['kvk_date'])
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

# Verify Kingdom 172 data
k172_kvks = [r for r in kvk_records if r['kingdom_number'] == 172]
print(f"\nKingdom 172 KvK records:")
for kvk in sorted(k172_kvks, key=lambda x: x['kvk_number']):
    print(f"  KvK {kvk['kvk_number']} vs {kvk['opponent_kingdom']}: P:{kvk['prep_result']} B:{kvk['battle_result']}")
