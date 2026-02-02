# Kingdom Data Schema

**Last Updated:** 2026-01-28  
**Maintainer:** Core Functionality Agent

---

## Overview

This document defines the schema and calculation rules for `kingdoms.json`, the source of truth for kingdom statistics.

---

## File Structure

```json
{
  "kingdoms": [...],    // Kingdom aggregate stats
  "kvk_records": [...]  // Individual KvK match records
}
```

---

## Kingdom Object Schema

| Field | Type | Description |
|-------|------|-------------|
| `kingdom_number` | int | Unique kingdom identifier |
| `total_kvks` | int | Total KvK matches played |
| `prep_wins` | int | Total prep phase wins (all-time) |
| `prep_losses` | int | Total prep phase losses (all-time) |
| `prep_win_rate` | float | `prep_wins / total_kvks` |
| `prep_streak` | int | **Current consecutive prep WIN streak** (see rules below) |
| `battle_wins` | int | Total battle phase wins (all-time) |
| `battle_losses` | int | Total battle phase losses (all-time) |
| `battle_win_rate` | float | `battle_wins / total_kvks` |
| `battle_streak` | int | **Current consecutive battle WIN streak** (see rules below) |
| `dominations` | int | Count of KvKs where kingdom won BOTH prep and battle |
| `invasions` | int | Count of KvKs where kingdom lost BOTH prep and battle |
| `overall_score` | float | Calculated Atlas Score |

---

## Streak Calculation Rules ⚠️ IMPORTANT

### Definition
- `prep_streak` = Current consecutive **WIN** streak in prep phase
- `battle_streak` = Current consecutive **WIN** streak in battle phase

### Calculation Logic
```
1. Sort KvK records by kvk_number DESCENDING (most recent first)
2. Starting from most recent:
   - If result is 'W', increment streak
   - If result is 'L', STOP counting (streak = 0 if first result is L)
3. Return the count
```

### Examples

**Kingdom with history: W, W, L, W, W (most recent first)**
- Current WIN streak = 2 (the two most recent wins)

**Kingdom with history: L, W, W, W (most recent first)**  
- Current WIN streak = 0 (most recent was a loss)

### Common Mistakes to Avoid ❌

1. **Max streak instead of current streak** - The streak field should NOT be the longest streak ever, only the current consecutive wins from the most recent KvK.

2. **Counting loss streaks as positive** - If the most recent result is a loss, the win streak should be 0, not the number of consecutive losses.

3. **Not updating after new KvK data** - When adding new KvK records, recalculate ALL streak values.

---

## KvK Record Schema

| Field | Type | Description |
|-------|------|-------------|
| `kingdom_number` | int | Kingdom this record belongs to |
| `kvk_number` | int | KvK event number (higher = more recent) |
| `opponent_kingdom` | int | Opposing kingdom number |
| `prep_result` | string | `'W'` or `'L'` |
| `battle_result` | string | `'W'` or `'L'` |
| `overall_result` | string | `'Domination'` (W+W), `'Reversal'` (W+L), `'Comeback'` (L+W), or `'Invasion'` (L+L) |
| `date_or_order_index` | string | Date or ordering info |

---

## Data Validation Script

Run this to verify streak data is correct:

```bash
cd apps/web
python3 -c "
import json
with open('src/data/kingdoms.json') as f:
    d = json.load(f)

kvks_by_k = {}
for r in d['kvk_records']:
    kvks_by_k.setdefault(r['kingdom_number'], []).append(r)

def calc_streak(kvks, phase):
    sorted_kvks = sorted(kvks, key=lambda x: x['kvk_number'], reverse=True)
    streak = 0
    for kvk in sorted_kvks:
        if kvk[f'{phase}_result'] == 'W':
            streak += 1
        else:
            break
    return streak

errors = 0
for k in d['kingdoms']:
    kvks = kvks_by_k.get(k['kingdom_number'], [])
    if kvks:
        if k['battle_streak'] != calc_streak(kvks, 'battle'):
            errors += 1
        if k['prep_streak'] != calc_streak(kvks, 'prep'):
            errors += 1

print(f'Streak validation: {errors} errors found')
"
```

---

## Outcome Naming Convention

| Prep | Battle | Outcome | Description |
|------|--------|---------|-------------|
| W | W | **Domination** | Won both phases completely |
| W | L | **Reversal** | Won prep but lost battle (opponent came back) |
| L | W | **Comeback** | Lost prep but won battle (recovered) |
| L | L | **Invasion** | Lost both phases completely |

---

## KvK Date Reference

| KvK # | Date |
|-------|------|
| 1 | May 24, 2025 |
| 2 | June 21, 2025 |
| 3 | July 19, 2025 |
| 4 | August 16, 2025 |
| 5 | September 13, 2025 |
| 6 | October 11, 2025 |
| 7 | November 8, 2025 |
| 8 | December 6, 2025 |
| 9 | January 3, 2026 |
| 10 | January 31, 2026 |

*KvKs occur approximately every 28 days.*

---

## Update History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-01 | Standardized outcome naming: Domination/Reversal/Comeback/Invasion; Added KvK date reference; Renamed `defeats` to `invasions` | Ops Analysis |
| 2026-01-28 | Added `prep_loss_streak`, `prep_best_streak`, `battle_loss_streak`, `battle_best_streak` fields | Core Functionality Agent |
| 2026-01-28 | Fixed 1009 kingdoms with incorrect streak values (was storing max historical streak instead of current win streak) | Core Functionality Agent |
| 2026-01-28 | Created DATA_SCHEMA.md documentation | Core Functionality Agent |

---

*Always recalculate derived fields when modifying kvk_records.*
