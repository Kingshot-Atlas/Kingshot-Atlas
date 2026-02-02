#!/usr/bin/env python3
"""
Execute KvK history fix batches via Supabase REST API.
Uses the service role key from environment.
"""

import os
import sys
import json
import urllib.request
import urllib.error

SUPABASE_URL = "https://qdczmafwcvnwfvixxbwg.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_KEY:
    print("ERROR: SUPABASE_SERVICE_KEY environment variable required")
    sys.exit(1)

def execute_sql(sql):
    """Execute SQL via Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    headers = {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    data = json.dumps({"query": sql}).encode("utf-8")
    
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            return True, response.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return False, e.read().decode("utf-8")

def main():
    # Find batch files
    batch_files = []
    for i in range(20):
        path = f"/tmp/kvk_batch_{i}.sql"
        if os.path.exists(path):
            batch_files.append(path)
    
    print(f"Found {len(batch_files)} batch files")
    
    for path in batch_files:
        print(f"\nExecuting {path}...")
        with open(path, "r") as f:
            sql = f.read()
        
        success, result = execute_sql(sql)
        if success:
            print(f"  ✅ Success")
        else:
            print(f"  ❌ Error: {result[:200]}")

if __name__ == "__main__":
    main()
