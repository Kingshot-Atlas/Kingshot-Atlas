# KvK Data Sync Guide

**Last Updated:** 2026-01-31  
**Author:** Platform Engineer

---

## Overview

This guide documents the process for syncing KvK battle results to the Supabase database after each KvK battle phase ends.

## KvK Schedule Reference

| Phase | Timing |
|-------|--------|
| **Prep Phase** | Monday 00:00 UTC to Saturday 10:00 UTC |
| **Battle Phase** | Saturday 10:00 UTC to Saturday 22:00 UTC |
| **Cycle** | Every 4 weeks (28 days) |

**Current KvK:** #10 (Battle phase ends Saturday, 2026-02-01 at 22:00 UTC)

---

## Data Sources

### Primary: Supabase `kvk_history` Table
- **Records:** 5,067+
- **Kingdoms:** 1,189 (K1-K1190)
- **KvK Range:** 1-9

### Fallback: CSV File
- **Location:** `apps/web/src/data/kingdoms_all_kvks.csv`
- **Records:** 5,042
- **Format:** `kingdom_number,kvk_number,opponent_kingdom,prep_result,battle_result,overall_result,date`

---

## Sync Process

### Step 1: Wait for Battle Phase to End
KvK #10 battle phase ends **Saturday 22:00 UTC**. Wait at least 1-2 hours after for results to finalize.

### Step 2: Update CSV Source
1. Obtain new KvK #10 results from data source (e.g., game scraping, community reports)
2. Append new records to `apps/web/src/data/kingdoms_all_kvks.csv`
3. Validate format: each row needs all 7 columns

### Step 3: Run Validation Script
```bash
cd /Users/giovanni/projects/ai/Kingshot\ Atlas
node scripts/validate-kvk-data.js
```

Expected output:
```
=== KvK Data Validation ===
✓ PASS: CSV file exists
✓ PASS: CSV has expected columns
✓ PASS: All records parsed successfully
✓ PASS: All records have valid data
✓ PASS: No duplicate keys
```

### Step 4: Run Sync Script (Dry Run)
```bash
node scripts/sync-kvk-data.js
```

This shows what records will be synced without making changes.

### Step 5: Generate SQL Batches
The sync script writes SQL files to `/tmp/kvk_sync/`:
- `batch_1.sql`, `batch_2.sql`, etc.

### Step 6: Apply to Supabase
Option A: Use Supabase MCP
```
mcp3_execute_sql with project_id: qdczmafwcvnwfvixxbwg
```

Option B: Use Supabase Dashboard
1. Go to SQL Editor in Supabase Dashboard
2. Paste and run each batch file

### Step 7: Verify Sync
```bash
# Check record count in Supabase
# Should match or exceed CSV record count
```

### Step 8: Invalidate Caches
The `kvkHistoryService` cache (5-minute TTL) will auto-refresh.
For immediate update, clear IndexedDB cache in browser DevTools.

---

## Sync for Specific Kingdom

To sync only one kingdom (e.g., after a correction):

```bash
node scripts/sync-kvk-data.js --kingdom 172
```

---

## Data Quality Checks

### Post-Sync Verification
1. Check Data Sources tab in Admin Dashboard (`/admin`)
2. Verify parity percentage is 100%+
3. Check freshness status shows "fresh"
4. Review any alerts

### Common Issues

| Issue | Solution |
|-------|----------|
| Duplicate key error | Record already exists; use ON CONFLICT DO UPDATE |
| Parse error | Check CSV format, especially quoted fields |
| Missing columns | Verify CSV header matches expected format |
| Date parse failure | Ensure date format is "Mon DD, YYYY" |

---

## Automation (Future)

The current process is manual. Future improvements could include:
- Automated data collection from game API
- Scheduled sync job (cron)
- Discord bot notification when new data available
- Community submission workflow for results

---

## Files Reference

| File | Purpose |
|------|---------|
| `scripts/validate-kvk-data.js` | Validates CSV data integrity |
| `scripts/sync-kvk-data.js` | Generates SQL for syncing |
| `scripts/find-missing-kvk-v2.js` | Identifies missing records |
| `scripts/migrate-kvk-data.js` | Initial bulk migration script |
| `apps/web/src/services/kvkHistoryService.ts` | KvK data service with caching |
| `apps/web/src/services/dataFreshnessService.ts` | Freshness alerts |
| `apps/web/src/components/DataSourceStats.tsx` | Admin dashboard component |

---

## Contact

For questions about the sync process, refer to the Platform Engineer agent or check `ACTIVITY_LOG.md` for recent changes.
