# Transfer Event Features — Brainstorm Document

**Created:** 2026-01-30  
**Author:** Atlas Director  
**Status:** Ideation Phase (No Implementation)  
**Purpose:** Explore features that help players during Transfer Events

---

## Executive Summary

Transfer Events are high-stakes moments where players make decisions that affect months of gameplay. Currently, this process is **fragmented across Discord, Reddit, and chaotic in-game chat** with no central source of truth.

Atlas is uniquely positioned to become **the intelligence hub for Transfer decisions** by leveraging our comprehensive kingdom data—particularly **KvK History**—to help players make informed choices and help kingdoms vet incoming transfers.

**Primary Value Propositions:**
1. **Kingdom Discovery** — Help players find kingdoms that match their needs
2. **Intelligence & Vetting** — Verify kingdom claims with data, help kingdoms assess players

---

## The Problem Space

### Player Pain Points

| Pain Point | Current Reality | Atlas Opportunity |
|------------|-----------------|-------------------|
| **Finding the right kingdom** | Scroll through chaotic chat, hope for honest recruiters | Data-driven kingdom matching |
| **Verifying recruiter claims** | "We always win KvK!" — but do they? | KvK history proves/disproves claims |
| **Missing transfer windows** | Forget the schedule, miss Open phase | Countdown timers, notifications |
| **Calculating pass requirements** | Uncertainty about how many passes needed | Pass calculator tool |
| **Coordinating group transfers** | Discord DMs, spreadsheets, chaos | Group coordination tools |

### Kingdom Pain Points

| Pain Point | Current Reality | Atlas Opportunity |
|------------|-----------------|-------------------|
| **Vetting incoming players** | Trust their word, hope they're active | Player profile verification |
| **Reaching quality players** | Cold-calling in chat, hope they see it | Visibility to serious transferees |
| **Managing limited slots** | 20-38 slots, high pressure to fill wisely | Decision support tools |
| **Tracking who's interested** | Scattered DMs, lost messages | Centralized interest tracking |

---

## Feature Ideas

### Category A: Kingdom Discovery & Matching

#### A1. Transfer-Ready Kingdom Finder
**What:** Specialized search/filter for kingdoms actively recruiting during Transfer Events.

**Features:**
- Filter by: Tier (S/A/B/C), Leading/Ordinary, win rate, region/timezone
- Show: Available slots (estimated), requirements, recent KvK performance
- Sort by: Atlas Score, win rate, activity level

**Relevance:** Directly addresses "finding the right kingdom" pain point  
**Benefit:** Replaces hours of Discord hunting with 30-second filtered search  
**Why Atlas:** We have the data—just need Transfer-specific presentation

**Complexity:** Medium  
**Premium Potential:** Advanced filters could be Pro-only

---

#### A2. Kingdom Match Score
**What:** Algorithm that scores how well a kingdom matches a player's preferences.

**Features:**
- Player inputs: desired tier, playstyle (competitive/casual), timezone, power level
- System outputs: % match score for each kingdom
- Explains why: "92% match — Strong KvK record, active in your timezone, accepts your power range"

**Relevance:** Personalized recommendations beat generic lists  
**Benefit:** Reduces decision paralysis, surfaces hidden gems  
**Why Atlas:** Leverages all our data points into actionable insight

**Complexity:** High (needs preference system, algorithm)  
**Premium Potential:** Strong Pro feature

---

#### A3. "Kingdoms Like Mine" Transfers
**What:** Show kingdoms similar to user's current kingdom (if linked) that might be upgrades.

**Features:**
- Based on: Similar tier, playstyle, size
- Highlights: What's better (higher win rate, better score)
- Use case: "I like my kingdom's vibe but want better KvK results"

**Relevance:** Many players want incremental upgrades, not radical changes  
**Benefit:** Familiar feel, better results  
**Why Atlas:** We already have "Similar Kingdoms" component

**Complexity:** Low (extend existing feature)  
**Premium Potential:** Could remain free

---

### Category B: Intelligence & Verification

#### B1. Kingdom Fact-Check Card
**What:** Shareable card that shows verified kingdom stats for recruitment.

**Features:**
- Shows: Atlas Score, Tier, KvK record (last 5), Leading/Ordinary status
- QR code: Links to full Atlas profile
- Use case: Recruiters share in Discord/Reddit as proof of claims

**Relevance:** Replaces "trust me bro" with verifiable data  
**Benefit:** Honest kingdoms get credibility, sketchy ones get exposed  
**Why Atlas:** Builds trust in Atlas as authority, drives traffic

**Complexity:** Low (extend ShareableCard)  
**Premium Potential:** Free (drives adoption)

---

#### B2. "Verify This Kingdom" Quick Check
**What:** One-click verification when someone makes a claim about a kingdom.

**Features:**
- Input: Kingdom number or name
- Output: Quick summary — Atlas Score, recent KvK results, tier
- Mobile-friendly: Fast lookup in Discord/chat

**Relevance:** Real-time fact-checking during negotiations  
**Benefit:** Prevents bad decisions based on false claims  
**Why Atlas:** Establishes Atlas as the truth source

**Complexity:** Low  
**Premium Potential:** Free (core value prop)

---

#### B3. KvK Performance Deep Dive for Transfers
**What:** Transfer-focused view of KvK history with context.

**Features:**
- Last 3-5 KvK results with opponents faced
- Performance trend: Improving, declining, stable?
- Opponent quality: Did they beat S-tiers or D-tiers?
- Context: "Won 4/5, but 3 wins were against D-tier opponents"

**Relevance:** Raw win/loss doesn't tell the full story  
**Benefit:** Sophisticated analysis for serious players  
**Why Atlas:** We have opponent data, just need presentation

**Complexity:** Medium  
**Premium Potential:** Strong Pro feature (deep analytics)

---

#### B4. Red Flag Indicators
**What:** Automated warnings about potential issues with a kingdom.

**Features:**
- Declining performance: "3 consecutive losses"
- Score volatility: "Rating dropped 15% in 2 months"
- Missing data: "No recent KvK data — verify manually"

**Relevance:** Protect players from making uninformed decisions  
**Benefit:** Trust through transparency (even when news is bad)  
**Why Atlas:** Data-driven warnings beat gut feelings

**Complexity:** Medium  
**Premium Potential:** Could be free (trust builder)

---

### Category C: Transfer Planning Tools

#### C1. Transfer Event Countdown & Notifications
**What:** Prominent countdown to next Transfer Event phases.

**Features:**
- Shows: Days/hours until Pre-Transfer, Invitational, Open phases
- Notifications: Push/email alerts before key moments
- Calendar integration: Add to Google/Apple calendar

**Relevance:** Timing is critical—miss Open phase = wait 8 weeks  
**Benefit:** Never miss a transfer window again  
**Why Atlas:** We already have Event Calendar, enhance it

**Complexity:** Low  
**Premium Potential:** Notifications could be Pro

---

#### C2. Transfer Pass Calculator
**What:** Estimate how many Transfer Passes needed based on power.

**Features:**
- Input: Current power level
- Output: Estimated passes needed, how to acquire them
- Bonus: "You'll need ~15 passes. Start saving now!"

**Relevance:** Pass requirements are unclear, causes missed transfers  
**Benefit:** Preparation guidance reduces last-minute panic  
**Why Atlas:** Utility tool that drives engagement

**Complexity:** Low (if formula is known)  
**Premium Potential:** Free (utility)

---

#### C3. Transfer Checklist
**What:** Interactive checklist for transfer preparation.

**Features:**
- [ ] Decided on target kingdom
- [ ] Verified kingdom claims on Atlas
- [ ] Calculated pass requirements
- [ ] Contacted Transfer Manager
- [ ] Secured invite (Invitational) or set alarm (Open)
- [ ] Transferred!

**Relevance:** Complex process with many steps  
**Benefit:** Reduces mistakes, increases confidence  
**Why Atlas:** Establishes Atlas as complete transfer companion

**Complexity:** Low  
**Premium Potential:** Free

---

### Category D: Community & Connection (Lower Priority)

These features venture into "social network" territory which is **not core to Atlas vision**, but could add value if kept lightweight.

#### D1. Transfer Interest Signal
**What:** Let users anonymously signal they're looking to transfer.

**Features:**
- Toggle: "Open to transfer" on profile
- Filters: Kingdoms can search for interested players
- Privacy: Opt-in, anonymous until user initiates contact

**Relevance:** Bridges discovery gap without becoming a social network  
**Benefit:** Passive recruitment without cold-calling  
**Why Careful:** Could shift Atlas toward social features (scope creep)

**Complexity:** Medium  
**Premium Potential:** Pro feature

---

#### D2. Kingdom Recruitment Posts
**What:** Let verified kingdom representatives post recruitment messages.

**Features:**
- Linked to verified kingdom
- Shows: Auto-populated Atlas data (no false claims)
- Expires: After Transfer Event ends

**Relevance:** Centralized, verified recruitment beats Discord chaos  
**Benefit:** Trusted source for both sides  
**Why Careful:** Content moderation overhead, scope creep risk

**Complexity:** High  
**Premium Potential:** Premium placement options

---

#### D3. Group Transfer Coordination
**What:** Tools for alliances/groups planning to transfer together.

**Features:**
- Private group: Invite members
- Shared target list: Vote on kingdom preferences
- Countdown: Synchronized timing for Open phase rush

**Relevance:** Groups transfer together, coordination is hard  
**Benefit:** Replaces messy Discord planning  
**Why Careful:** Significant feature investment, social network territory

**Complexity:** High  
**Premium Potential:** Definitely Pro

---

## Prioritization Matrix

| Feature | Impact | Effort | Strategic Fit | Priority |
|---------|--------|--------|---------------|----------|
| **B1. Fact-Check Card** | High | Low | Perfect | 🔥 P1 |
| **B2. Verify Quick Check** | High | Low | Perfect | 🔥 P1 |
| **C1. Countdown & Notifications** | Medium | Low | Strong | 🔥 P1 |
| **A1. Transfer-Ready Finder** | High | Medium | Perfect | ⭐ P2 |
| **B3. KvK Deep Dive** | High | Medium | Perfect | ⭐ P2 |
| **C2. Pass Calculator** | Medium | Low | Strong | ⭐ P2 |
| **C3. Transfer Checklist** | Medium | Low | Strong | ⭐ P2 |
| **A3. Kingdoms Like Mine** | Medium | Low | Strong | ⭐ P2 |
| **B4. Red Flag Indicators** | Medium | Medium | Strong | 📋 P3 |
| **A2. Kingdom Match Score** | High | High | Strong | 📋 P3 |
| **D1. Transfer Interest Signal** | Medium | Medium | Moderate | 🔮 Future |
| **D2. Recruitment Posts** | Medium | High | Moderate | 🔮 Future |
| **D3. Group Coordination** | Medium | High | Low | ❌ Deprioritize |

---

## Recommended MVP: "Transfer Intelligence Hub"

Bundle the P1 features into a cohesive Transfer Event experience:

### Components
1. **Transfer Event Banner** — Countdown to next event, current phase
2. **Verify Kingdom** — Quick lookup modal, shareable fact-check card
3. **Transfer-Focused Kingdom View** — KvK history prominent, slots info if available
4. **Transfer Checklist** — Guided preparation flow

### User Journey
1. User visits Atlas during Pre-Transfer phase
2. Sees countdown banner: "Invitational Phase starts in 2 days"
3. Uses filters to find kingdoms matching their tier/playstyle
4. Clicks kingdom → sees Transfer-focused profile with KvK emphasis
5. Generates Fact-Check Card to verify claims in Discord
6. Follows Transfer Checklist to prepare
7. Gets notification when Open phase starts

---

## Revenue Considerations

### Free (Drive Adoption)
- Basic countdown & schedule
- Kingdom verification (quick check)
- Fact-check cards (drives traffic)
- Transfer checklist

### Pro Features
- Advanced match filtering
- KvK Deep Dive analytics
- Notifications/alerts
- Priority support during events

### Future Premium
- Recruitment post promotion
- Group coordination tools
- Transfer analytics dashboard for kingdoms

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Scope creep into social features** | Strict focus on intelligence/data, not connections |
| **Data accuracy during events** | Clear disclaimers, community reporting encouraged |
| **Kingdoms gaming the system** | Automated data, not self-reported claims |
| **Low engagement outside events** | Integrate with core KvK scouting (related use case) |

---

## Open Questions

1. **Do we have slot availability data?** — Would significantly enhance recommendations
2. **Can we detect Leading vs Ordinary kingdoms?** — Important for slot calculations
3. **Transfer Pass formula?** — Need to research exact calculation
4. **User feedback channels?** — How to gather input on these features pre-build?

---

## Next Steps (When Ready to Implement)

1. **Validate priorities** — Owner review of P1/P2 features
2. **Research gaps** — Transfer Pass formula, slot availability
3. **Design mockups** — Transfer banner, verification modal
4. **Incremental rollout** — Start with countdown + verification

---

*This document is informational only. No implementation without Owner approval.*
