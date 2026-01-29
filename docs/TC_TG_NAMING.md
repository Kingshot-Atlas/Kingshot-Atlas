# Town Center (TC) to Throne Gate (TG) Naming Convention

## Overview

In Kingshot, player progression is measured by Town Center level. After level 30, the naming convention changes to "Throne Gate" (TG) tiers.

## Conversion Table

| TC Level | Display Name |
|----------|--------------|
| 1-30 | TC 1 - TC 30 |
| 31-34 | TC 30 |
| 35-39 | TG1 |
| 40-44 | TG2 |
| 45-49 | TG3 |
| 50-54 | TG4 |
| 55-59 | TG5 |
| 60-64 | TG6 |
| 65-69 | TG7 |
| ... | ... |

## Formula

```typescript
const formatTCLevel = (level: number): string => {
  if (level <= 30) return `TC ${level}`;
  if (level <= 34) return 'TC 30';
  const tgTier = Math.floor((level - 35) / 5) + 1;
  return `TG${tgTier}`;
};
```

## Usage

This conversion is used in:
- `LinkKingshotAccount.tsx` - Player profile linking display
- Any future features showing player TC/TG level

## Notes

- TC 31-34 are transitional levels that still display as "TC 30"
- TG tiers start at level 35 and increment every 5 levels
- The Century Games API returns the raw `stove_lv` (TC level) value

*Created: 2026-01-29*
