#!/usr/bin/env python3
"""
Generate SQL to fix kvk_history data from CSV source.
Outputs SQL that can be executed via Supabase MCP or direct connection.
"""

import csv
import sys
from datetime import datetime

CSV_PATH = "apps/web/src/data/kingdoms_all_kvks.csv"

def parse_date(date_str):
    """Convert 'May 24, 2025' to '2025-05-24'"""
    try:
        dt = datetime.strptime(date_str.strip(), "%b %d, %Y")
        return dt.strftime("%Y-%m-%d")
    except:
        return None

def main():
    batch_size = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    start_row = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    
    with open(CSV_PATH, 'r') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    # Get batch
    batch = rows[start_row:start_row + batch_size]
    
    if not batch:
        print("-- No more rows")
        sys.exit(0)
    
    updates = []
    for row in batch:
        kingdom = int(row['kingdom_number'])
        kvk = int(row['kvk_number'])
        opponent = int(float(row['opponent_kingdom']))
        prep = row['prep_result'].strip()
        battle = row['battle_result'].strip()
        overall = row['overall_result'].strip()
        kvk_date = parse_date(row['kvk_date'])
        order_idx = int(row['order_index'])
        
        # Calculate correct overall_result based on prep/battle
        if prep == 'W' and battle == 'W':
            overall = 'Domination'
        elif prep == 'L' and battle == 'L':
            overall = 'Invasion'
        elif prep == 'L' and battle == 'W':
            overall = 'Comeback'
        elif prep == 'W' and battle == 'L':
            overall = 'Reversal'
        
        date_sql = f"'{kvk_date}'" if kvk_date else "NULL"
        
        updates.append(
            f"UPDATE kvk_history SET "
            f"opponent_kingdom={opponent}, "
            f"prep_result='{prep}', "
            f"battle_result='{battle}', "
            f"overall_result='{overall}', "
            f"kvk_date={date_sql}, "
            f"order_index={order_idx}, "
            f"updated_at=NOW() "
            f"WHERE kingdom_number={kingdom} AND kvk_number={kvk};"
        )
    
    print("\n".join(updates))
    print(f"\n-- Processed rows {start_row} to {start_row + len(batch) - 1} ({len(batch)} rows)")

if __name__ == "__main__":
    main()
