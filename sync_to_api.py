#!/usr/bin/env python3
"""
Sync kingdoms.json data to API-compatible CSV format.
Run this after regenerating kingdoms.json to update the API database.

Usage:
  python sync_to_api.py
  
Then deploy the API with the updated CSV files.
"""
import json
import csv
from pathlib import Path

def main():
    base_path = Path(__file__).parent
    
    # Load kingdoms.json
    json_path = base_path / 'apps/web/src/data/kingdoms.json'
    print(f"Loading {json_path}...")
    
    with open(json_path, 'r') as f:
        data = json.load(f)
    
    kingdoms = data['kingdoms']
    kvk_records = data['kvk_records']
    
    # Output paths for API
    api_data_path = base_path / 'apps/api/data'
    api_data_path.mkdir(exist_ok=True)
    
    # Write kingdoms_summary.csv
    summary_path = api_data_path / 'kingdoms_summary.csv'
    print(f"Writing {summary_path}...")
    
    with open(summary_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'kingdom_number', 'total_kvks', 'prep_wins', 'prep_losses',
            'prep_win_rate', 'prep_win_streak', 'battle_wins', 'battle_losses',
            'battle_win_rate', 'battle_win_streak', 'dominations', 'defeats',
            'most_recent_status', 'overall_score'
        ])
        
        for k in kingdoms:
            writer.writerow([
                k['kingdom_number'],
                k['total_kvks'],
                k['prep_wins'],
                k['prep_losses'],
                k['prep_win_rate'],
                k.get('prep_streak', 0),
                k['battle_wins'],
                k['battle_losses'],
                k['battle_win_rate'],
                k.get('battle_streak', 0),
                k.get('dominations', 0),
                k.get('defeats', 0),
                k.get('most_recent_status', 'Unannounced'),
                k['overall_score']
            ])
    
    print(f"  Written {len(kingdoms)} kingdoms")
    
    # Write kingdoms_all_kvks.csv
    kvks_path = api_data_path / 'kingdoms_all_kvks.csv'
    print(f"Writing {kvks_path}...")
    
    with open(kvks_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'kingdom_number', 'kvk_number', 'opponent_kingdom',
            'prep_result', 'battle_result', 'overall_result',
            'kvk_date', 'order_index'
        ])
        
        for kvk in kvk_records:
            # Parse date_or_order_index: "May 24, 2025 (1)" -> date and index
            date_str = kvk.get('date_or_order_index', '')
            if ' (' in date_str:
                parts = date_str.rsplit(' (', 1)
                kvk_date = parts[0]
                order_index = parts[1].rstrip(')')
            else:
                kvk_date = date_str
                order_index = str(kvk.get('kvk_number', 0))
            
            writer.writerow([
                kvk['kingdom_number'],
                kvk['kvk_number'],
                kvk['opponent_kingdom'],
                kvk['prep_result'],
                kvk['battle_result'],
                kvk['overall_result'],
                kvk_date,
                order_index
            ])
    
    print(f"  Written {len(kvk_records)} KvK records")
    
    print("\n✅ Sync complete!")
    print("\nTo update the remote API:")
    print("  1. cd apps/api")
    print("  2. python import_data.py")
    print("  3. Deploy to Render/Railway")
    print("\nOr run locally:")
    print("  cd apps/api && python -m uvicorn main:app --reload")

if __name__ == "__main__":
    main()
