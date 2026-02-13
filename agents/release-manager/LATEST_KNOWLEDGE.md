# Release Manager — Latest Knowledge

**Last Updated:** 2026-02-13  
**Purpose:** Best practices for release communications and patch notes

---

## Patch Notes Best Practices

### Structure
1. **Date prominently displayed**
2. **Categories clearly separated** (New, Fixed, Improved)
3. **Most important changes first** within each category
4. **Concise entries** — one sentence per item when possible
5. **Call to action** — where to give feedback

### Frequency
- **Regular updates:** Every 3 days
- **Major releases:** As they happen
- **Hotfixes:** Same day if user-impacting

### Length Guidelines
- Regular patch notes: 5-15 entries
- Major releases: Can be longer, with context
- If no user-facing changes: Skip or post "No user-facing changes this period"

---

## Writing for Non-Technical Users

### Translation Guide

| Technical | User-Friendly |
|-----------|---------------|
| Implemented feature X | Added X |
| Fixed bug in Y component | Fixed issue where Y wasn't working |
| Optimized Z performance | Z now loads faster |
| Refactored codebase | (Don't mention) |
| Updated dependencies | (Don't mention) |
| Added API endpoint | (Don't mention unless user-facing) |
| Fixed race condition | Fixed issue where X sometimes didn't work |
| Resolved memory leak | App now runs more smoothly |

### Benefit-Focused Writing

```markdown
# ❌ Feature-focused (technical)
Added PlayerHistory component with chart visualization

# ✅ Benefit-focused (user-friendly)  
You can now see your power growth over time in a visual chart
```

### Action Verbs to Use
- **New:** Added, Introduced, Launched, Created
- **Fixed:** Fixed, Resolved, Corrected, Restored
- **Improved:** Enhanced, Optimized, Updated, Streamlined, Simplified

---

## Categorization Guidelines

### ✨ New (Features)
Include when:
- Users can do something they couldn't before
- New page, section, or major UI element
- New data displayed
- New settings or options

Examples:
- "Added dark mode toggle in settings"
- "New player comparison tool"
- "Kingdom search now available"

### 🐛 Fixed (Bug Fixes)
Include when:
- Something that was broken now works
- Users reported or noticed the issue
- Error messages or crashes resolved

Examples:
- "Fixed issue where search results disappeared"
- "Player stats now update correctly after refresh"
- "Resolved crash when viewing empty kingdoms"

### 🔧 Improved (Enhancements)
Include when:
- Existing feature works better
- Performance improvements users notice
- UX improvements
- Visual polish

Examples:
- "Page loads 40% faster"
- "Easier to read stats on mobile"
- "Smoother animations throughout"

### Don't Include
- Internal code changes (refactoring)
- Documentation updates
- Test additions
- Build configuration changes
- Agent system changes
- Developer tooling

---

## Changelog Architecture (ADR-020, 2026-02-13)

### Single Source of Truth
```
apps/web/src/data/changelog.json  ← EDIT THIS (add entry at top)
        │
        ├──→ Changelog.tsx (imports JSON, renders React page)
        │
        └──→ npm run changelog:sync → docs/CHANGELOG.md (auto-generated)
```

### How to Add a Changelog Entry
1. Edit `apps/web/src/data/changelog.json` — add new object at top of array
2. Format: `{ "date": "Month DD, YYYY", "version": "X.Y.Z", "new": [...], "fixed": [...], "improved": [...] }`
3. Run `npm run changelog:sync` from `apps/web/` to regenerate CHANGELOG.md
4. Run `npm run changelog:check` to verify sync (also runs in CI)

### Gotchas
- **DO NOT** edit `Changelog.tsx` inline data — it imports from JSON
- **DO NOT** edit `docs/CHANGELOG.md` manually — it gets overwritten by sync
- Multiple same-day entries (e.g., "Jan 29 (Evening)") are merged in markdown output
- Entries before 2026-02-01 are excluded from sync checks
- Feb 14, 2026 is in the allow-list (internal refactoring, not user-facing)
- CI runs `lint:consistency:strict` which catches date drift

### Version Numbers
Using semantic versioning:
- **Major (1.0.0):** Breaking changes or major features
- **Minor (0.1.0):** New features
- **Patch (0.0.1):** Bug fixes

---

## Discord Best Practices (Future)

### Message Formatting
```markdown
📢 **Kingshot Atlas Update**
*January 28, 2026*

**✨ What's New**
• Player power history chart - see your growth over time
• Kingdom events now show countdown timers

**🐛 Fixed**
• Search works with special characters now
• KvK times correct for all timezones

**🔧 Better**
• Player cards load way faster
• Mobile nav improved

📖 Full notes: https://ks-atlas.com/changelog
💬 Feedback? Reply to this message!
```

### Timing
- Post during active hours (consider timezone of user base)
- Avoid posting during game events (users are busy)
- Major updates: Consider @everyone or @updates role ping

### Engagement
- Ask for feedback
- Thank users for reports that led to fixes
- Tease upcoming features occasionally

---

## Emergency Communications

### Outage Notice
```markdown
⚠️ **Service Disruption**

Kingshot Atlas is currently experiencing issues. We're working on it.

**What's affected:** [specific feature]
**Started:** [time]
**Expected resolution:** [estimate or "investigating"]

We'll update this message when resolved.
```

### Resolution Notice
```markdown
✅ **Resolved**

The issue with [feature] has been fixed. Everything should be working normally now.

Thanks for your patience!
```

---

## Tools & Resources

### For Writing
- Hemingway App — Check readability
- Grammarly — Check grammar
- Word counter — Keep entries concise

### For Tracking Changes
- Git commit history
- Agent worklogs
- ACTIVITY_LOG.md
- STATUS_SNAPSHOT.md

### For Publishing
- Markdown files in /docs/releases/
- (Future) Discord webhook

---

## Schedule Reference

### 3-Day Cycle
Assuming we started on Day 0:
- Day 0: Start tracking
- Day 3: First patch notes
- Day 6: Second patch notes
- Day 9: Third patch notes
- ...and so on

### Calendar Example (January 2026)
| Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|-----|-----|-----|-----|-----|-----|-----|
| 26  | 27  | 28📢 | 29  | 30  | 31📢 | 1   |
| 2   | 3📢  | 4   | 5   | 6📢  | 7   | 8   |

📢 = Patch notes due

---

## Quality Checklist

Before publishing patch notes:

- [ ] Date is correct
- [ ] All categories present (or noted as empty)
- [ ] Each entry is user-friendly
- [ ] No technical jargon
- [ ] No typos or grammar errors
- [ ] Most important items first
- [ ] File saved in correct location
- [ ] CHANGELOG.md updated
- [ ] Director notified (if major)

---

*Updated by Release Manager based on communication best practices.*
