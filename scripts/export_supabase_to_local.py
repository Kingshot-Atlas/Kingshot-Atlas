#!/usr/bin/env python3
"""
Export Supabase data to local fallback files.
This ensures local JSON/CSV matches the Supabase source of truth.
"""
import json
import csv
import os
from pathlib import Path
from supabase import create_client

# Get Supabase credentials from environment
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://qdczmafwcvnwfvixxbwg.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_KEY')

if not SUPABASE_KEY:
    print("ERROR: SUPABASE_SERVICE_KEY or SUPABASE_KEY environment variable required")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
WEB_DATA_PATH = PROJECT_ROOT / 'apps' / 'web' / 'src' / 'data' / 'kingdoms.json'
API_SUMMARY_PATH = PROJECT_ROOT / 'apps' / 'api' / 'data' / 'kingdoms_summary.csv'
API_KVKS_PATH = PROJECT_ROOT / 'apps' / 'api' / 'data' / 'kingdoms_all_kvks.csv'

def fetch_kingdoms():
    """Fetch all kingdoms from Supabase."""
    result = supabase.table('kingdoms').select('*').order('kingdom_number').execute()
    return result.data

def fetch_kvk_history():
    """Fetch all KvK history from Supabase."""
    result = supabase.table('kvk_history').select('*').order('kingdom_number,kvk_number').execute()
    return result.data

def main():
    print("Fetching kingdoms from Supabase...")
    kingdoms = fetch_kingdoms()
    print(f"  Found {len(kingdoms)} kingdoms")
    
    print("Fetching KvK history from Supabase...")
    kvk_history = fetch_kvk_history()
    print(f"  Found {len(kvk_history)} KvK records")
    
    # Build kingdoms.json format
    kingdoms_json = {
        "kingdoms": [],
        "kvk_records": []
    }
    
    for k in kingdoms:
        kingdoms_json["kingdoms"].append({
            "kingdom_number": k["kingdom_number"],
            "total_kvks": k["total_kvks"],
            "prep_wins": k["prep_wins"],
            "prep_losses": k["prep_losses"],
            "prep_win_rate": float(k["prep_win_rate"]) if k["prep_win_rate"] else 0,
            "prep_streak": k["prep_streak"],
            "battle_wins": k["battle_wins"],
            "battle_losses": k["battle_losses"],
            "battle_win_rate": float(k["battle_win_rate"]) if k["battle_win_rate"] else 0,
            "battle_streak": k["battle_streak"],
            "dominations": k["dominations"],
            "invasions": k["invasions"],  # Updated field name
            "most_recent_status": "Unannounced",
            "overall_score": float(k["atlas_score"]) if k["atlas_score"] else 0,
            "prep_loss_streak": k["prep_loss_streak"],
            "prep_best_streak": k["prep_best_streak"],
            "battle_loss_streak": k["battle_loss_streak"],
            "battle_best_streak": k["battle_best_streak"]
        })
    
    for kvk in kvk_history:
        kingdoms_json["kvk_records"].append({
            "kingdom_number": kvk["kingdom_number"],
            "kvk_number": kvk["kvk_number"],
            "opponent_kingdom": kvk["opponent_kingdom"],
            "prep_result": kvk["prep_result"],
            "battle_result": kvk["battle_result"],
            "overall_result": kvk["overall_result"],
            "date_or_order_index": kvk["kvk_date"] or str(kvk["order_index"])
        })
    
    # Write kingdoms.json
    print(f"Writing {WEB_DATA_PATH}...")
    with open(WEB_DATA_PATH, 'w') as f:
        json.dump(kingdoms_json, f, indent=2)
    print(f"  Wrote {len(kingdoms_json['kingdoms'])} kingdoms and {len(kingdoms_json['kvk_records'])} KvK records")
    
    # Write kingdoms_summary.csv
    print(f"Writing {API_SUMMARY_PATH}...")
    with open(API_SUMMARY_PATH, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'kingdom_number', 'total_kvks', 'prep_wins', 'prep_losses', 'prep_win_rate',
            'prep_win_streak', 'battle_wins', 'battle_losses', 'battle_win_rate',
            'battle_win_streak', 'dominations', 'invasions', 'most_recent_status', 'overall_score'
        ])
        for k in kingdoms:
            writer.writerow([
                k["kingdom_number"], k["total_kvks"], k["prep_wins"], k["prep_losses"],
                k["prep_win_rate"], k["prep_streak"], k["battle_wins"], k["battle_losses"],
                k["battle_win_rate"], k["battle_streak"], k["dominations"], k["invasions"],
                "Unannounced", k["atlas_score"]
            ])
    
    # Write kingdoms_all_kvks.csv
    print(f"Writing {API_KVKS_PATH}...")
    with open(API_KVKS_PATH, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'kingdom_number', 'kvk_number', 'opponent_kingdom', 'prep_result',
            'battle_result', 'overall_result', 'date_or_order_index'
        ])
        for kvk in kvk_history:
            writer.writerow([
                kvk["kingdom_number"], kvk["kvk_number"], kvk["opponent_kingdom"],
                kvk["prep_result"], kvk["battle_result"], kvk["overall_result"],
                kvk["kvk_date"] or kvk["order_index"]
            ])
    
    print("\n✅ Local fallback files updated successfully!")
    print("   - apps/web/src/data/kingdoms.json")
    print("   - apps/api/data/kingdoms_summary.csv")
    print("   - apps/api/data/kingdoms_all_kvks.csv")

if __name__ == "__main__":
    main()
