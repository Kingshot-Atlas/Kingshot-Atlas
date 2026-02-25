# Kingdom Colonies Campaign — Implementation Plan

**Campaign #1 | Status: PLANNED | Author: Product Engineer**  
**Created:** 2026-02-25  
**Approved by:** Owner (pending launch signal)

---

## Executive Summary

Kingdom Colonies is a 5-day raffle campaign that rewards kingdoms with the most Discord-linked Settlers (TC 20+). More Settlers = more raffle tickets. Prizes range from $5 to $100, drawn live on Discord via a slot-style winner picker streamed by admin. The campaign drives Discord community growth, Atlas account linking, and kingdom engagement.

---

## Campaign Rules (Source of Truth)

### Eligibility
- **Qualifying Settler:** A user who has:
  1. A Kingshot Atlas account (signed up on ks-atlas.com)
  2. Linked their Kingshot game account (TC 20+)
  3. Linked their Discord account on Atlas
  4. Joined the Kingshot Atlas Discord server (verified by Settler role)
- **Minimum threshold:** Kingdom must have **≥10 qualifying Settlers** to enter the raffle
- Each qualifying Settler = **1 raffle ticket** for their kingdom

### Prize Structure (15 prizes, ~$400 total)
Draw order is **smallest → biggest** to build anticipation:

| Draw # | Prize | Kingdom |
|--------|-------|---------|
| 1 | $5 | — |
| 2 | $5 | — |
| 3 | $5 | — |
| 4 | $5 | — |
| 5 | $5 | — |
| 6 | $10 | — |
| 7 | $10 | — |
| 8 | $10 | — |
| 9 | $10 | — |
| 10 | $25 | — |
| 11 | $25 | — |
| 12 | $25 | — |
| 13 | $50 | — |
| 14 | $50 | — |
| 15 | $100 | — |

### Upgrade Rule
- A kingdom can only win **one prize**
- If a kingdom has already won a lower prize and is drawn again for a higher prize:
  - The kingdom **upgrades** to the higher prize
  - The lower prize is **freed** and re-rolled immediately
- If a kingdom is drawn again for a **lower or equal** prize → skip, re-draw

### Duration
- **5 days** of accumulation (Settlers can link during this period)
- Live draw event on Discord at a specific date/time announced in advance

---

## Current Data Snapshot (Feb 25, 2026)

Queried from `profiles` table:

| Kingdom | Total Atlas Users | Discord-Linked | Qualifying (TC20+) |
|---------|-------------------|----------------|---------------------|
| K172 | 99 | 49 | 49 |
| K154 | 61 | 38 | 38 |
| K134 | 73 | 37 | 37 |
| K288 | 47 | 35 | 35 |
| K189 | 63 | 33 | 33 |
| K997 | 44 | 31 | 31 |
| K200 | 33 | 25 | 25 |
| K666 | 26 | 18 | 18 |
| K479 | 26 | 18 | 18 |
| K208 | 22 | 17 | 17 |

**~20 kingdoms currently qualify** (≥10 settlers). Total ticket pool: **~500+**.

---

## Architecture Decisions

### Data Layer

**Source of truth for settlers:** Supabase `profiles` table (real-time query).

```sql
-- Qualifying settlers per kingdom
SELECT linked_kingdom, COUNT(*) as tickets
FROM profiles
WHERE linked_player_id IS NOT NULL
  AND discord_id IS NOT NULL
  AND linked_tc_level >= 20
  AND linked_kingdom IS NOT NULL
GROUP BY linked_kingdom
HAVING COUNT(*) >= 10
ORDER BY tickets DESC;
```

No new tables needed for the leaderboard — it's a live aggregate query on existing data.

### New Supabase Tables

#### 1. `campaigns`
Stores campaign configuration. One row per campaign.

```sql
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,                    -- "Kingdom Colonies"
  campaign_number INTEGER NOT NULL,      -- 1 (for Campaign #1 numbering)
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | active | drawing | completed
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  draw_date TIMESTAMPTZ,                 -- when live draw happens
  min_settlers INTEGER NOT NULL DEFAULT 10,
  min_tc_level INTEGER NOT NULL DEFAULT 20,
  rewards JSONB NOT NULL,                -- [{draw_order: 1, amount: 5}, ...]
  rules_summary TEXT,                    -- markdown rules shown on campaign page
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- CHECK: status IN ('draft', 'active', 'drawing', 'completed')
```

#### 2. `campaign_winners`
Records draw results. One row per prize awarded.

```sql
CREATE TABLE campaign_winners (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  draw_order INTEGER NOT NULL,           -- 1-15
  prize_amount NUMERIC NOT NULL,         -- 5, 10, 25, 50, 100
  kingdom_number INTEGER NOT NULL,
  tickets_at_draw INTEGER NOT NULL,      -- snapshot of kingdom's tickets when drawn
  total_tickets_at_draw INTEGER NOT NULL,-- total pool size at time of draw
  drawn_at TIMESTAMPTZ DEFAULT now(),
  is_upgrade BOOLEAN DEFAULT false,      -- true if kingdom upgraded from lower prize
  upgraded_from_draw INTEGER,            -- draw_order of the prize that was freed
  random_seed TEXT,                      -- for transparency/verification
  UNIQUE(campaign_id, draw_order)
);
```

#### RLS Policies
- `campaigns`: Public read, admin write
- `campaign_winners`: Public read, admin write

### API Endpoints Needed

**None required.** All data lives in Supabase and can be queried directly from the frontend via Supabase client:
- Settler counts: aggregate query on `profiles`
- Campaign config: read from `campaigns`
- Winners: read/write from `campaign_winners`
- Admin writes protected by RLS (`is_admin = true` check)

### No API Server Changes
The existing `/api/v1/bot/linked-users` endpoint already returns all the data needed. The frontend queries Supabase directly. The Discord bot's Settler role sync (every 30min) ensures Discord membership is validated.

---

## Pages & Components Plan

### Page 1: `/campaigns/kingdom-colonies` — Campaign Hub

**Public page.** The main campaign page with three tabs.

#### Tab 1: About (default)
- Campaign #1 branding with FONT_DISPLAY title: "KINGDOM **COLONIES**"
- Hero section with campaign description, rules, and requirements
- Visual checklist for users showing their qualification status:
  - ✅/❌ Atlas account created
  - ✅/❌ Kingshot account linked (TC 20+)
  - ✅/❌ Discord linked on Atlas
  - ✅/❌ Joined Atlas Discord server (Settler role)
- Countdown timer to draw date (or "Campaign Active — X days remaining")
- Prize pool visual showing all 15 prizes with dollar amounts
- "How to qualify" section with clear step-by-step instructions
- CTA buttons: "Link Discord" / "Join Discord Server" / "Link Kingshot Account" (contextual based on user state)

#### Tab 2: Settlers Leaderboard
- **Two sub-sections:**
  - **Qualifying kingdoms** (≥10 Discord-linked settlers) — these are in the raffle
  - **Rising kingdoms** (<10 settlers) — these need more to qualify

- **Leaderboard columns:**
  | Column | Description |
  |--------|-------------|
  | Rank | Position by ticket count |
  | Kingdom | Kingdom number (clickable → kingdom profile) |
  | Tickets (Discord-linked) | Count of qualifying settlers = raffle tickets |
  | Atlas Users (not Discord-linked) | Users who could link to add more tickets |
  | Win Chance | `(tickets / total_pool_tickets * 100)%` |
  | Progress Bar | Visual bar showing tickets relative to #1 kingdom |

- **Per-kingdom detail (expandable row or modal):**
  - List of settlers with linking status:
    - 🟢 **Discord-linked** (counts as ticket) — show username, avatar
    - 🟡 **Atlas-linked only** (not Discord-linked) — show username, "Link Discord to count!"
  - This transparency lets kingdoms see exactly who needs to link
  - Only show usernames of users who have `linked_player_id` (opted into the platform)

- **Stats bar at top:**
  - Total qualifying kingdoms
  - Total tickets in pool
  - Total Atlas users across all kingdoms
  - Campaign time remaining

#### Tab 3: Winners (shown after draw, hidden before)
- Trophy-style display of all 15 prizes with winning kingdoms
- Kingdom names with FONT_DISPLAY styling
- Prize amounts with gold ($100), silver ($50), bronze ($25), green ($10), white ($5) color coding
- "Campaign #1" numbering for recurring event expectation
- Share button to generate a shareable image of results

---

### Page 2: `/admin/campaign-draw` — Slot Machine Winner Picker (Admin Only)

**Admin-only page.** This is the star of the show — a livestream-ready slot machine.

#### Layout (Landscape-Optimized for Streaming)

```
┌──────────────────────────────────────────────────────────┐
│  KINGDOM COLONIES — LIVE DRAW          Campaign #1       │
├────────────────┬─────────────────────────────────────────┤
│                │                                         │
│  PRIZE QUEUE   │         SLOT MACHINE                    │
│  ────────────  │    ┌───────────────────┐                │
│  $5   → K___   │    │                   │                │
│  $5   → K___   │    │    K 1 7 2        │                │
│  $5   → K___   │    │                   │                │
│  $5   → K___   │    └───────────────────┘                │
│  $5   → K___   │                                         │
│  $10  → K___   │    [ SPIN ]  ⏱️ 8s  [1━━━━━●━━━━20]    │
│  $10  → K___   │                                         │
│  $10  → K172 ✓ │    Last winner: K172 → $10              │
│  $10  → K___   │                                         │
│  $25  → K___   │  ┌─────────────────────────────────┐    │
│  $25  → K___   │  │ Pool: 487 tickets │ 22 kingdoms │    │
│  $25  → K___   │  │ Drawn: 7/15       │ Re-rolls: 1 │    │
│  $50  → K___   │  └─────────────────────────────────┘    │
│  $50  → K___   │                                         │
│▶ $100 → K___   │                                         │
│                │                                         │
├────────────────┴─────────────────────────────────────────┤
│  🔊 Sound: ON   │  🖥️ Fullscreen   │  📋 Export Results  │
└──────────────────────────────────────────────────────────┘
```

#### Slot Machine Mechanics

1. **Visual slot reel:** Kingdom numbers scroll vertically at high speed, then decelerate and stop on the winning kingdom. CSS animation with easing (`cubic-bezier` for natural deceleration).

2. **Roll duration control:** Slider from 1–20 seconds. Default: 8 seconds. The slot accelerates for 20% of the duration, maintains speed for 50%, then decelerates for 30%.

3. **Random selection algorithm:**
   - Weighted random: each kingdom's probability = `tickets / total_tickets`
   - Winner is determined **before** the animation starts (the animation is visual theater)
   - The reel is pre-calculated to land on the winning kingdom number
   - Random seed is generated using `crypto.getRandomValues()` and recorded in `campaign_winners.random_seed` for transparency

4. **Prize queue sidebar (left):**
   - All 15 prizes listed in draw order ($5 → $100)
   - Current prize highlighted with a glowing indicator (▶)
   - Completed prizes show the winning kingdom number + checkmark
   - Upgraded prizes show a ↑ icon and the new prize level
   - Freed prizes pulse to indicate they're being re-rolled

5. **Upgrade handling:**
   - When a kingdom that already won is drawn again for a higher prize:
     - Celebration animation: "UPGRADE! K172: $10 → $50!"
     - The old prize slot in the sidebar shows "RE-ROLL" with a spinning icon
     - The queue automatically advances to re-roll the freed prize
   - When a kingdom is drawn for a lower/equal prize: auto-skip with brief "Already won — re-drawing..." message

6. **SPIN button:**
   - Large, centered, pulsing glow when ready
   - Disabled during animation
   - Shows "SPINNING..." during roll
   - Keyboard shortcut: Spacebar

7. **Stats panel:**
   - Total tickets in pool
   - Qualifying kingdoms remaining (not yet won)
   - Draws completed / total
   - Re-rolls count

#### Admin Controls

- **Roll duration slider** (1–20 seconds) with live preview
- **Sound toggle** (on/off) — slot machine sound effects
- **Fullscreen mode** — hides browser chrome for clean streaming
- **Pause/Resume** — ability to pause between draws for commentary
- **Export Results** — generates a formatted summary for Discord announcement
- **Reset Draw** — emergency reset (with confirmation dialog) in case of technical issues
- **Test Mode** — runs a mock draw without saving to database (for rehearsal)

#### Visual Design (Atlas Style Guide Compliant)

- **Background:** `#0a0a0a` with subtle radial gradient
- **Slot machine:** Dark card (`#131318`) with neon border that changes color per prize tier:
  - $5: white (`#ffffff`)
  - $10: green (`#22c55e`)
  - $25: blue (`#3b82f6`)
  - $50: purple (`#a855f7`)
  - $100: gold (`#fbbf24`) with shimmer animation
- **Kingdom numbers in reel:** FONT_DISPLAY (Trajan Pro), large (3-4rem), with motion blur during spin
- **Winner reveal:** Neon glow explosion effect + confetti particles (CSS-only, reduced-motion safe)
- **Prize amounts:** Orbitron font for numbers, color-coded per tier

#### Livestream-Ready Features

- **Clean URL** — no admin nav clutter, just the draw interface
- **No scroll needed** — everything fits in viewport (landscape 16:9)
- **High contrast** — readable on compressed video streams
- **Audio cues** (optional):
  - Tick-tick-tick during roll (accelerating)
  - Drum roll on deceleration
  - Fanfare on winner reveal
  - Special fanfare for $100 prize
  - Upgrade sound effect
- **Webcam-friendly layout** — main content is center-right, prize queue is left, leaving room for a webcam overlay in bottom-right if desired

---

### Page 3: Winners Display (post-campaign)

After the draw is complete, the `/campaigns/kingdom-colonies` page's Winners tab activates:

- Trophy-style layout with all winners
- Animated entrance (staggered reveal)
- Prize tier visual hierarchy (bigger prizes = bigger cards)
- Share button (generates OG image)
- "Campaign #1 — completed [date]" badge

---

### Component: Campaign Winners Banner

A dismissible notification banner (like TransferGroupUpdateBanner) that appears on the homepage after the draw:

- "Kingdom Colonies winners announced! See which kingdoms won."
- Gold color scheme (`#fbbf24`)
- Links to `/campaigns/kingdom-colonies` (Winners tab)
- Dismissible with localStorage
- Only shown after campaign status = `completed`

---

## Discord-Linked Visibility Feature

### Problem
Users need to know which of their kingdom members are Discord-linked (qualifying) vs. Atlas-only (not qualifying). This lets them recruit non-linked members to link Discord and increase their kingdom's ticket count.

### Solution: Kingdom Settler Breakdown

On the **Settlers Leaderboard tab**, each kingdom row is expandable. When expanded, it shows:

```
Kingdom 172 — 49 Tickets (99 Atlas Users)
├── 🟢 Discord-Linked Settlers (49) — These count!
│   ├── PlayerName1 (TC 28)
│   ├── PlayerName2 (TC 24)
│   └── ... (show all with virtual scroll if >20)
│
└── 🟡 Atlas-Only Users (50) — Encourage to link Discord!
    ├── PlayerName51 (TC 22) — "Needs Discord link"
    ├── PlayerName52 (TC 15) — "TC too low (need 20+)"
    └── ... 
```

### Privacy Consideration
- Only show `linked_username` (game username) — not email or real name
- Users opted into the platform by linking their account, so game username is fair game
- Consider adding a profile setting "Show me in campaign leaderboards" (default: on) for future campaigns

### Query for Kingdom Detail

```sql
SELECT 
  linked_username,
  linked_tc_level,
  discord_id IS NOT NULL as is_discord_linked,
  CASE 
    WHEN discord_id IS NOT NULL AND linked_tc_level >= 20 THEN 'qualifying'
    WHEN discord_id IS NULL AND linked_tc_level >= 20 THEN 'needs_discord'
    WHEN linked_tc_level < 20 THEN 'tc_too_low'
  END as status
FROM profiles
WHERE linked_kingdom = $1
  AND linked_player_id IS NOT NULL
ORDER BY 
  (discord_id IS NOT NULL AND linked_tc_level >= 20) DESC,
  linked_tc_level DESC;
```

---

## Must Join Atlas Discord Server Requirement

### How This Is Enforced
The Settler role in Discord is the mechanism:

1. User links Discord on Atlas → API calls `sync_settler_role_for_user()`
2. Bot assigns Settler role **only if user is in the Atlas Discord server**
3. Bot runs `syncSettlerRoles()` every 30 minutes to catch edge cases
4. If user leaves the Discord server, they lose the Settler role on next sync
5. The campaign page should clearly state: **"You must join the Kingshot Atlas Discord server to qualify"**

### How We Count Settlers (for raffle)
We count from the `profiles` table where `discord_id IS NOT NULL`. However, having `discord_id` set only means they linked Discord on the website — it doesn't guarantee they're in the server.

**Recommended approach:** Add an optional verification layer:
- The bot's `/api/v1/bot/linked-users` endpoint already returns users who have both `linked_player_id` and `discord_id`
- The bot's `syncSettlerRoles()` function checks actual Discord server membership
- **For the campaign, use the bot's member list as ground truth:** Create a new API endpoint or Edge Function that cross-references `profiles.discord_id` with actual Discord guild members

**Simpler approach (recommended for v1):**
- Trust `profiles.discord_id IS NOT NULL` as the count (since the bot removes `discord_id` if users aren't in the server... actually, it doesn't — it only removes the role)
- Add a note on the campaign page: "Settler count is synced with Discord every 30 minutes"
- For the actual draw, snapshot the ticket counts and verify against the bot's member cache

### Campaign Page Messaging
- Clear callout: "You must be a member of the Kingshot Atlas Discord server with the Settler role to count"
- Link to Discord invite: prominently placed
- Show user's own status: "You are ✅ / ❌ in the Atlas Discord"

---

## Implementation Phases

### Phase 1: Database & Core Data (Est. 1 session)
1. Create `campaigns` table with migration
2. Create `campaign_winners` table with migration
3. Add RLS policies (public read, admin write)
4. Insert Campaign #1 configuration row
5. Create `useCampaignQueries.ts` hook with React Query:
   - `useCampaign(campaignId)` — campaign config
   - `useSettlerLeaderboard(campaignId)` — aggregated settler counts
   - `useKingdomSettlers(kingdomNumber)` — per-kingdom settler detail
   - `useCampaignWinners(campaignId)` — winner list
6. Verify data with Supabase advisors (security + performance)

### Phase 2: Campaign Page — About & Leaderboard (Est. 2 sessions)
1. Create `/campaigns/kingdom-colonies` page with tab layout
2. Build About tab with qualification checklist, rules, countdown
3. Build Settlers Leaderboard tab with:
   - Qualifying kingdoms section (≥10 settlers)
   - Rising kingdoms section (<10 settlers)
   - Expandable kingdom rows with settler breakdown
   - Discord-linked vs Atlas-only distinction
   - Stats bar (total kingdoms, tickets, time remaining)
4. Add route to App.tsx
5. i18n keys for all 9 languages
6. Mobile-responsive layout
7. Add navigation link (consider adding to QuickActions or sidebar)

### Phase 3: Admin Slot Machine (Est. 2-3 sessions)
1. Create `/admin/campaign-draw` page (admin-only guard)
2. Build slot machine reel component with CSS animations:
   - Vertical scroll of kingdom numbers
   - Acceleration → cruise → deceleration physics
   - Landing animation with bounce
3. Build prize queue sidebar with status tracking
4. Implement weighted random selection with `crypto.getRandomValues()`
5. Build roll duration slider (1-20 seconds)
6. Build upgrade detection and re-roll logic
7. Save winners to `campaign_winners` table on each draw
8. Add fullscreen mode
9. Add sound effects (Web Audio API, togglable)
10. Add keyboard shortcut (Spacebar = spin)
11. Add test mode (mock draw without DB writes)
12. Add export results button (formatted for Discord)
13. Extensive testing with mock data

### Phase 4: Winners Page & Banner (Est. 1 session)
1. Build Winners tab in campaign page (trophy display)
2. Build Campaign Winners Banner component
3. Add banner to KingdomDirectory.tsx
4. Share functionality (OG image generation)
5. i18n for all languages

### Phase 5: Polish & Launch Prep (Est. 1 session)
1. End-to-end testing (full draw simulation)
2. Performance optimization (leaderboard pagination if needed)
3. Accessibility pass (keyboard nav, screen reader, reduced motion)
4. Mobile UX pass on all pages
5. Final i18n review
6. Build verification
7. Commit & deploy (on owner's signal)

---

## Additional Improvements Included

### 1. Qualification Status Checker
The About tab shows logged-in users their personal qualification status:
- ✅ Atlas account — created
- ✅/❌ Kingshot linked (TC 20+)
- ✅/❌ Discord linked
- ✅/❌ In Atlas Discord (Settler role)

This creates a personal "to-do list" that drives action.

### 2. Campaign Numbering
"Campaign #1" is baked into the design. The `campaigns` table has `campaign_number` for future campaigns. This creates expectation of recurring events.

### 3. Transparent Random Seed
Each draw records the `crypto.getRandomValues()` seed in `campaign_winners.random_seed`. This can be displayed on the Winners page for full transparency: "Verified random — seed: `a7f3c9...`"

### 4. Test Mode for Rehearsal
The admin draw page has a Test Mode toggle that runs the full slot machine experience without writing to the database. Essential for rehearsing the livestream before going live.

### 5. Export for Discord Announcement
After the draw, an "Export Results" button generates a formatted Discord message:

```
🏰 **KINGDOM COLONIES — CAMPAIGN #1 RESULTS** 🏰

🥇 $100 → Kingdom 172 (49 tickets)
🥈 $50 → Kingdom 288 (35 tickets)
🥈 $50 → Kingdom 134 (37 tickets)
🥉 $25 → Kingdom 154 (38 tickets)
...

Total: 487 tickets across 22 kingdoms
Congratulations to all winners! 🎉
```

### 6. Real-Time Leaderboard During Campaign
The leaderboard updates in near-real-time (React Query polling every 60s during active campaign). Kingdoms can watch their ticket count climb as members link.

### 7. "Rally Your Kingdom" Share Feature
Each kingdom's leaderboard row has a "Share" button that generates a shareable card:
- "Kingdom 172 has 49 tickets! Help us win — link your Discord on ks-atlas.com"
- Can be posted in kingdom's game chat or Discord

### 8. Sound Design for Livestream
Carefully designed audio cues that make the draw exciting on stream:
- **Spin start:** Mechanical whir + ascending tone
- **During spin:** Rapid clicking (like a real slot machine)
- **Deceleration:** Clicks slow down, building tension
- **Winner reveal:** Brass fanfare (short, punchy)
- **$100 winner:** Extended fanfare with reverb
- **Upgrade:** Ascending chime + "Level up" sound

### 9. Confetti System
CSS-only confetti animation on winner reveal. Respects `prefers-reduced-motion`. Color matches the prize tier.

### 10. Post-Campaign Analytics (Future)
After campaign ends, admin can see:
- How many new Discord links happened during the campaign
- Which kingdoms grew the most
- Total new Settlers gained
- Conversion rates (Atlas-only → Discord-linked)

---

## File Structure Plan

```
apps/web/src/
├── pages/
│   ├── KingdomColonies.tsx          # Campaign hub page (3 tabs)
│   └── AdminCampaignDraw.tsx        # Admin slot machine page
├── components/
│   ├── campaign/
│   │   ├── CampaignAboutTab.tsx     # Rules, checklist, countdown
│   │   ├── SettlersLeaderboard.tsx  # Leaderboard with expandable rows
│   │   ├── KingdomSettlerDetail.tsx # Per-kingdom settler breakdown
│   │   ├── CampaignWinnersTab.tsx   # Trophy-style winners display
│   │   ├── QualificationChecker.tsx # User's personal status checker
│   │   ├── PrizePoolVisual.tsx      # Visual prize tier display
│   │   └── CampaignCountdown.tsx    # Countdown to draw date
│   ├── admin/
│   │   ├── SlotMachine.tsx          # The slot reel component
│   │   ├── PrizeQueue.tsx           # Prize sidebar with status
│   │   ├── DrawControls.tsx         # Spin button, duration slider
│   │   └── DrawStats.tsx            # Live stats during draw
│   ├── CampaignWinnersBanner.tsx    # Post-campaign homepage banner
│   └── homepage/
│       └── (existing banners)
├── hooks/
│   └── useCampaignQueries.ts        # React Query hooks for campaign data
├── utils/
│   └── campaignUtils.ts             # Weighted random, seed generation, helpers
└── locales/
    └── {lang}/translation.json      # i18n keys for all campaign text
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Discord-linked count ≠ actual server members | Medium | High | Cross-verify with bot's member cache before draw |
| Slot machine animation jank on stream | Low | Medium | Test on target streaming hardware, use CSS transforms (GPU-accelerated) |
| Kingdom with 1 member wins multiple times | N/A | N/A | Handled by "1 prize per kingdom" rule |
| Too few qualifying kingdoms | Low | Medium | Current data shows ~20 qualifying, could lower minimum to 5 |
| Technical failure during live draw | Low | High | Test mode for rehearsal, manual override, DB-backed state recovery |
| Gaming via alt accounts | Low | Low | Discord-linked requirement is high friction for alts |

---

## Dependencies

- **No new npm packages needed** — all animations are CSS-only, random is native `crypto`, audio is Web Audio API
- **No API server changes** — all data via Supabase client
- **No Discord bot changes** — existing Settler sync is sufficient
- **Supabase migrations** — 2 new tables (`campaigns`, `campaign_winners`)

---

## Launch Checklist

- [ ] Phase 1: Database tables created
- [ ] Phase 2: Campaign page live (About + Leaderboard)
- [ ] Phase 3: Admin draw page complete and tested
- [ ] Phase 4: Winners tab and banner ready
- [ ] Phase 5: Polish pass complete
- [ ] Campaign #1 row inserted with dates
- [ ] Test mode rehearsal completed
- [ ] Discord announcement drafted
- [ ] Streaming setup tested (OBS + admin draw page)
- [ ] Owner gives final launch signal

---

*Ready to implement on your signal. Say "launch Kingdom Colonies" to begin Phase 1.*
