# Kingshot Atlas Workspace Setup

This document defines how we build Kingshot Atlas so development stays clean, consistent, and scalable.

---

## Project goals
1) Deliver a high-quality Kingdom Directory + Profiles
2) Support verified community contributions without chaos
3) Build a platform that can grow into an all-in-one ecosystem (web + Discord bot)

---

## Ground rules (IMPORTANT)
- One feature = one focused change-set
- Avoid overbuilding early
- UI must remain fast, clean, and premium
- Dark gaming theme: white/light gray text + neon blue accent
- Always validate MVP flows:
  - Directory → Profile → Compare → Leaderboards
  - Login → Profile → Review submission

---

## AI usage rules (Cascade rules)
To reduce wasted credits and wrong edits:
- Do **NOT** scan the entire repo.
- Only open the files needed for the task.
- If more than 5 files are needed, ask first.
- Keep responses short and actionable.
- Prefer small iterations over huge rewrites.

---

## Folder expectations (recommended)
Suggested structure (can evolve):

/apps
  /web                # Main frontend (directory + profiles)
/apps/api             # Backend API (auth, data, reviews)
/packages
  /ui                 # Shared UI components (dark theme system)
/docs                 # Product docs
/database             # Schema + migrations
/scripts              # Imports, validators, utilities

---

## Data model standards (MVP)
Kingdoms should store:
- kingdomNumber (unique)
- overallScore
- overallRank
- timezone
- mainLanguage
- secondaryLanguage
- totalKvKs
- prepWinRate
- battleWinRate
- mostRecentStatus (Leading/Ordinary/Unannounced)
- kvkHistory[] (full)
- last5KvKs[] (public subset)
- createdAt / updatedAt

Reviews/comments:
- kingdomNumber
- userId
- rating (optional)
- comment
- createdAt
- moderationStatus (pending/approved/rejected)
- flagsCount

Trust roles:
- New / Contributor / Trusted / Moderator / Admin

---

## Freemium enforcement rules (MVP)
Public:
- Kingdom profiles visible
- Last 5 KvKs visible
- Basic filters + sorting

Login required:
- Submit data
- Write reviews/comments

Premium:
- Watchlist + alerts
- Recruiter tools
- Full KvK history
- Advanced comparisons/filters
- Profile customization

---

## Security & moderation rules
- All submissions must be tied to a user account
- New users require approval
- Trusted users can flag content
- Moderators approve/reject
- Admin can manage roles + settings

---

## Naming conventions
Avoid confusing file naming:
- BAD: final, final2, latest
- GOOD: use dates or clear intent:
  - 2026-01-25_kingshot-atlas_notes.md
  - kingdom-profile-ui.md

---

## Done definition (MVP tasks)
A task is done when:
- The flow works end-to-end
- UI is clean and readable on mobile
- No broken route refresh (SPA behavior)
- No obvious errors in console
