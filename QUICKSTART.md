# Kingshot Atlas Quickstart

Use this checklist to start working fast and avoid wasting time/credits.

---

## 1) What are we building?
Kingshot Atlas is:
- A kingdom database (profiles + performance history)
- A search tool for players to find a kingdom that fits
- A recruiting tool for kingdom managers
- Freemium + community-driven

---

## 2) MVP flows to always protect
### Player flow
1) Open Directory (main page)
2) Search a kingdom number
3) Open Kingdom Profile
4) Compare with another kingdom
5) Check leaderboard positions

### Community flow
1) Login/signup
2) Create user profile
3) Submit a review/comment
4) Submit kingdom data (if allowed by role)
5) Moderator/admin approves if required

---

## 3) MVP Kingdom Profile requirements
Currently shows:
- Overall score + rank
- Power Tier (S/A/B/C)
- Total KvKs
- Prep win rate + battle win rate + streaks
- High Kings / Invader Kings counts
- Most recent status (currently "Unannounced" for all)
- Last 5 KvK results
- Reviews (localStorage only - backend auth is placeholder)

---

## 4) Scoring rules (weighted)
Overall Score uses weighted performance:
- Prep weight = 1
- Battle weight = 2
- Ratio = 1 : 2
Goal: Higher quality kingdoms rank higher.

---

## 5) Directory requirements (main page)
Must support:
- Search by kingdom number
- Sort by overall score/rank
- Filter by:
  - win rates
  - status
  - total KvKs

---

## 6) Trust roles (moderation)
- New → approval required
- Contributor → auto approval
- Trusted → auto approval + flag content
- Moderator → approve/reject
- Admin → promote/demote + configure system

---

## 7) Freemium rules (what’s locked)
Premium features:
- Watchlist + alerts
- Recruiter tools
- Full KvK history
- Profile customization
- Advanced comparisons/filters

---

## 8) Agent Coordination System

Before starting any work:
1. **Read** `/agents/project-instances/kingshot-atlas/STATUS_SNAPSHOT.md`
2. **Check** `/agents/project-instances/kingshot-atlas/FILE_CLAIMS.md`
3. **Scan** `/agents/project-instances/kingshot-atlas/ACTIVITY_LOG.md`

After completing work:
1. Release claims in `FILE_CLAIMS.md`
2. Log completion in `ACTIVITY_LOG.md`
3. Update `STATUS_SNAPSHOT.md`

Full protocol: `/docs/AGENT_PROTOCOL.md`

---

## 9) How to work with Cascade efficiently
When using AI:
- Tell it exactly what to build
- Limit it to a few files
- Avoid "scan everything"
- Ship MVP first, polish later

Suggested AI prompt:
"Read STATUS_SNAPSHOT.md first. Only open the minimum files needed. Build the MVP directory + profile first. Keep it clean and dark/neon styling."
