# Parking Lot

**Last Updated:** 2026-02-05  
**Purpose:** Track ideas explicitly deferred to prevent scope creep and enable future revisiting.

---

## How to Use This File

**When an idea comes up that's not for now:**
1. Add it here with context
2. Note why it's parked
3. Specify conditions for revisiting

**Before starting new work:**
1. Check if it's already parked (and why)
2. If conditions have changed, propose moving it out

---

## Parked Ideas

### Alliance Analytics
**Parked:** 2026-01-29  
**Proposed By:** Owner  
**Why Parked:** Scope creep — need to nail kingdom-level features first  
**Revisit When:** After v2.0, when kingdom features are mature  
**Description:** Track alliance-level stats, alliance rankings, alliance KvK performance

---

### Mobile Native App
**Parked:** 2026-01-29  
**Proposed By:** Owner  
**Why Parked:** Web-first strategy, limited resources  
**Revisit When:** 10k+ active users, proven product-market fit  
**Description:** iOS/Android native apps for Atlas

---

### Real-Time Data Sync
**Parked:** 2026-01-29  
**Proposed By:** Platform Engineer  
**Why Parked:** Complex to implement, current update frequency is sufficient  
**Revisit When:** User demand for fresher data, resources available  
**Description:** WebSocket-based real-time kingdom data updates

---

### Social Features (Friend Lists, Messaging)
**Parked:** 2026-01-29  
**Proposed By:** Community feedback  
**Why Parked:** Atlas is a data platform, not a social network (see ADR-008 principles)  
**Revisit When:** Clear user demand that doesn't duplicate Discord  
**Description:** In-app friend lists, direct messaging between users

---

### Kingdom Claiming / Official Representation
**Parked:** 2026-01-29  
**Proposed By:** Owner  
**Why Parked:** Complex verification, potential for abuse  
**Revisit When:** Strong community trust established, verification system designed  
**Description:** Allow kingdom leaders to "claim" their kingdom and post official updates

---

### Historical Data Archive
**Parked:** 2026-01-29  
**Proposed By:** Product Engineer  
**Why Parked:** Storage costs, complexity of time-series queries  
**Revisit When:** Premium feature demand, infrastructure budget  
**Description:** Full historical snapshots of kingdom stats over time

---

### API for Third Parties
**Parked:** 2026-01-29  
**Proposed By:** Community request  
**Why Parked:** Security concerns, rate limiting complexity, monetization questions  
**Revisit When:** Clear use cases, API monetization strategy  
**Description:** Public API for third-party tools and integrations

---

### Multi-Language Support
**Parked:** 2026-01-29  
**Proposed By:** Community feedback  
**Why Parked:** Translation effort, limited resources  
**Revisit When:** Significant non-English user base, translation volunteers  
**Description:** i18n support for multiple languages

---

### Dark/Light Theme Toggle
**Parked:** 2026-01-29  
**Proposed By:** Design Lead  
**Why Parked:** ThemeContext exists but light theme not designed  
**Revisit When:** Design resources available, user demand  
**Description:** Full light theme option (currently dark-only)  
**Note:** Infrastructure exists in `ThemeContext.tsx`

---

### Kingdom Ambassador Program
**Parked:** 2026-02-05  
**Proposed By:** Business Lead  
**Why Parked:** Full spec complete, awaiting prioritization against other growth initiatives  
**Revisit When:** Ready to invest in growth engine; 50+ active users recommended before launch  
**Description:** One trusted player per kingdom becomes an official Atlas Ambassador. They promote Atlas within their community, submit data, and earn perks (free Supporter, unique badge, Discord role). 3-phase rollout from manual MVP to full in-app system.  
**Full Spec:** `/docs/KINGDOM_AMBASSADOR_PROGRAM.md`  
**Key Details:**  
- 1 Ambassador per kingdom (up to 1,190 total)
- Eligibility: TC 25+, linked account, good submission history
- Perks: Free Supporter tier, gold Ambassador badge, Discord role, early access
- Responsibilities: Weekly login, submit KvK results each cycle, share Atlas
- Phase 1 (MVP): Manual — Google Form, hand-picked ambassadors, zero dev cost
- Phase 2: In-app application, referral links (`ks-atlas.com/join/k172`), dashboard
- Phase 3: Public directory, leaderboard, automated renewal
- Database: `ambassadors` + `ambassador_referrals` tables (Phase 2+)
- Break-even: ~1 paying referral per ambassador per month

---

### Gift Code Extraction & Bulk Redemption
**Parked:** 2026-01-29  
**Proposed By:** Atlas Director (research request)  
**Why Parked:** Auto-redemption may conflict with "not a bot/automation tool" values; manual redemption is safer  
**Revisit When:** Clear user demand for gift code utilities, automation policy reviewed  
**Description:** Extract active gift codes from `kingshot.net/api/gift-codes` and provide bulk redemption tools  
**Technical Details:**  
- ✅ Easy: Public JSON API at `https://kingshot.net/api/gift-codes` returns active codes
- ⚠️ Complex: Redemption requires browser automation (Selenium) due to Century Games form-based system
- 📊 Existing: Kingshot.net already has bulk redeem feature and API
- 🎯 Recommendation: Build notification/display system, avoid full automation
**Implementation Options:**  
1. Gift Code Tracker (low risk) - Display active codes with Discord notifications
2. Bulk Redeem Helper (medium risk) - Generate instructions, manual redemption
3. Alliance Code Manager (premium) - Track member redemption status

---

## Rejected Ideas (Not Coming Back)

### Game Automation / Bots
**Rejected:** 2026-01-29  
**Why:** Violates core values — fair play, no unfair advantages (see ADR-008)  
**Final:** Will never implement

### Selling Player Data
**Rejected:** 2026-01-29  
**Why:** Violates trust principles in VISION.md  
**Final:** Will never implement

### Pay-to-Win Kingdom Boosting
**Rejected:** 2026-01-29  
**Why:** Would corrupt data integrity  
**Final:** Will never implement

---

## Template

```markdown
### [Idea Name]
**Parked:** YYYY-MM-DD  
**Proposed By:** [Who suggested it]  
**Why Parked:** [Brief reason]  
**Revisit When:** [Conditions that would trigger reconsideration]  
**Description:** [What the idea is]
```

---

*Ideas here are not forgotten — they're intentionally deferred. Check before proposing "new" ideas.*
