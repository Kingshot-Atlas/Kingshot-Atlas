# File Claims - Kingshot Atlas

**Purpose:** Prevent edit conflicts by tracking which agent is working on which files.  
**Rule:** Check before editing. Claim before starting. Release on completion.  
**Expiry:** Claims older than 2 hours are considered stale and can be overridden.

---

## Active Claims

| File | Claimed By | Since | Task | Expires |
|------|------------|-------|------|---------|
| *No active claims* | - | - | - | - |

---

## How to Use

### Before Editing Any File
1. Check this table for existing claims
2. If claimed by another agent, coordinate via Manager
3. If unclaimed, add your claim before starting

### Claiming a File
Add a row:
```markdown
| apps/web/src/pages/Example.tsx | Core-Functionality | 2026-01-28 10:00 | Feature X | 2026-01-28 12:00 |
```

### Releasing a Claim
Remove your row from the table when work is complete.

### Stale Claims
- Claims older than 2 hours without update are stale
- Manager can override stale claims
- If overriding, log in ACTIVITY_LOG.md

---

## Permanent Ownership

These files have permanent owners and should not be claimed by other agents without coordination.

| File | Owner | Notes |
|------|-------|-------|
| `apps/web/src/data/changelog.json` | Release Manager | Single source of truth for changelog. See ADR-020. |
| `docs/CHANGELOG.md` | Release Manager | Auto-generated — do not edit manually. Run `npm run changelog:sync`. |

---

## Claim History (Last 7 Days)

| File | Agent | Claimed | Released | Task |
|------|-------|---------|----------|------|
| apps/web/src/pages/KingdomDirectory.tsx | Core-Functionality | 2026-01-27 | 2026-01-27 | Refactor |
| apps/web/src/components/KingdomCard.tsx | Design-Content | 2026-01-27 | 2026-01-27 | Style analysis |

---

*Always claim before you work. Always release when done.*
