#!/usr/bin/env python3
"""
Recalculate Atlas Scores for all kingdoms in Supabase.
Uses the updated formula with veteran threshold at 5 KvKs.
"""
import sys
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.supabase_client import get_supabase_admin, _update_kingdom_stats_directly


def recalculate_all_kingdoms():
    """Recalculate Atlas Scores for all kingdoms in Supabase."""
    client = get_supabase_admin()
    if not client:
        print("ERROR: Supabase not configured")
        return False
    
    # Get all unique kingdom numbers from kvk_history
    print("Fetching all kingdoms from kvk_history...")
    result = client.table('kvk_history').select('kingdom_number').execute()
    
    if not result.data:
        print("No kvk_history records found")
        return False
    
    # Get unique kingdom numbers
    kingdom_numbers = sorted(set(r['kingdom_number'] for r in result.data))
    print(f"Found {len(kingdom_numbers)} kingdoms to recalculate")
    
    # Recalculate each kingdom
    success_count = 0
    error_count = 0
    
    for i, kingdom_num in enumerate(kingdom_numbers):
        try:
            if _update_kingdom_stats_directly(client, kingdom_num):
                success_count += 1
            else:
                error_count += 1
                print(f"  Failed: K{kingdom_num}")
        except Exception as e:
            error_count += 1
            print(f"  Error K{kingdom_num}: {e}")
        
        # Progress update every 50 kingdoms
        if (i + 1) % 50 == 0:
            print(f"  Progress: {i + 1}/{len(kingdom_numbers)}")
    
    print(f"\n✓ Recalculation complete!")
    print(f"  Success: {success_count}")
    print(f"  Errors: {error_count}")
    
    # Verify K86 and K231 scores
    print("\nVerifying K86 vs K231...")
    k86 = client.table('kingdoms').select('kingdom_number, atlas_score, total_kvks, dominations, invasions').eq('kingdom_number', 86).limit(1).execute()
    k231 = client.table('kingdoms').select('kingdom_number, atlas_score, total_kvks, dominations, invasions').eq('kingdom_number', 231).limit(1).execute()
    
    if k86.data and k231.data:
        k86_data = k86.data[0]
        k231_data = k231.data[0]
        print(f"  K86:  Score {k86_data['atlas_score']}, {k86_data['total_kvks']} KvKs, {k86_data['dominations']} Dom, {k86_data['invasions']} Inv")
        print(f"  K231: Score {k231_data['atlas_score']}, {k231_data['total_kvks']} KvKs, {k231_data['dominations']} Dom, {k231_data['invasions']} Inv")
        
        if k231_data['atlas_score'] > k86_data['atlas_score']:
            print("  ✓ K231 now ranks higher than K86!")
        else:
            print("  ⚠ K231 still ranks lower than K86 - formula may need adjustment")
    
    return True


if __name__ == "__main__":
    recalculate_all_kingdoms()
