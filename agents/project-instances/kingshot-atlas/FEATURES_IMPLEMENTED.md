# Features Implemented

**Last Updated:** 2026-02-20  
**Purpose:** Prevent duplicate work by tracking what's already built.

---

## How to Use This File

**Before starting any feature work:**
1. Search this file for similar features
2. If found, check status and notes
3. If already implemented, inform user and suggest enhancements instead

**After completing any feature:**
1. Add a row to the appropriate section
2. Include status, date, implementing agent, and notes

---

## Pages & Routes

| Feature | Route | Status | Agent | Notes |
|---------|-------|--------|-------|-------|
| Kingdom Directory | `/` | ✅ Live | Product | Main listing with search, filters, sorting |
| Kingdom Profile | `/kingdom/:id` | ✅ Live | Product | Full kingdom details, stats, history |
| Compare Kingdoms | `/compare` | ✅ Live | Product | Side-by-side comparison with radar charts |
| Tools | `/tools` | ✅ Live | Product | Atlas Tools page — renamed from Domination Tools (2026-02-07) |
| Rankings | `/rankings` | ✅ Live | Product | Multi-category rankings (renamed from /leaderboards 2026-02-06) |
| User Profile | `/profile` | ✅ Live | Product | User settings, linked accounts, achievements |
| Public Profiles | `/profile/:userId` | ✅ Live | Product | View other users' profiles |
| Player Directory | `/players` | ✅ Live | Product | Browse Atlas users |
| About Page | `/about` | ✅ Live | Design | Mission, FAQ, team info |
| Admin Dashboard | `/admin` | ✅ Live | Platform | Data management, submissions review |
| Support Atlas | `/support`, `/upgrade`, `/pro` | ✅ Live | Business | Community support page (formerly Upgrade) |
| Changelog | `/changelog` | ✅ Live | Release | Version history and updates |
| Atlas Bot | `/atlas-bot` | ✅ Live | Design + Product | Dedicated Atlas Discord Bot page with commands, features, invite CTA (2026-02-07) |
| Transfer Hub | `/transfer-hub` | ✅ Live | Product + Business | Kingdom listings, editor claiming, recruiter dashboard, kingdom fund, transfer profiles, applications, match scoring. Open to all linked users. (2026-02-09, renamed from Transfer Board 2026-02-07) |
| Kingdom Communities | `/kingdoms/communities` | ✅ Live | Product | Ranks kingdoms by # of linked TC20+ Atlas users. Incentivizes kingdom-wide signup. Shows fund tier badges, Atlas Score, rank. (2026-02-14) |
| Kingdom Settlers Campaign | `/campaigns/kingdom-settlers` | ✅ Live | Product | Campaign hub with About (hero, countdown, prize pool, qualification checker, rules), Settlers Leaderboard (qualifying/rising kingdoms, expandable settler details), Winners tabs. i18n 9 langs. Campaign #1 completed; banner removed from homepage; system kept for future campaigns. (2026-02-25, updated 2026-03-03) |
| Admin Campaign Draw | `/admin/campaign-draw` | 🔨 Local | Product | Slot machine winner picker with weighted random selection, prize queue sidebar, confetti, sound effects, fullscreen, test mode, duration slider 1-20s, upgrade/re-roll detection, Discord export. Admin-gated. (2026-02-25) |
| Alliance Event Coordinator Landing | `/tools/event-coordinator/about` | ✅ Live | Product | Blue-themed landing page with hero, features (6), steps (3), problem/solution, access explainer. Links to tool + tools page. Supporters/Ambassadors/Boosters can activate. i18n 11 langs. Tools card + nav links point here. (2026-03) |

---

## Core Features

| Feature | Status | Agent | Notes |
|---------|--------|-------|-------|
| Kingdom Search | ✅ Live | Product | `SearchAutocomplete.tsx` with instant results |
| Atlas Score System | ✅ Live | Product | Bayesian scoring with tier badges (S/A/B/C/D), 0-100 scale |
| Atlas Score Breakdown | ✅ Live | Product | Detailed score component analysis |
| Radar Charts | ✅ Live | Product | `RadarChart.tsx`, `MiniRadarChart.tsx`, `CompareRadarChart.tsx` |
| Kingdom Cards | ✅ Live | Product | `KingdomCard.tsx` with stats display |
| Kingdom Table View | ✅ Live | Product | `KingdomTable.tsx` alternative view |
| KvK History Display | ✅ Live | Product | Win/loss records with opponents (FREE for all users - ungated 2026-01-30) |
| Similar Kingdoms | ✅ Live | Product | `SimilarKingdoms.tsx` recommendations |
| Quick Filter Chips | ✅ Live | Product | `QuickFilterChips.tsx` for fast filtering |
| Filter Panel | ✅ Live | Product | `FilterPanel.tsx` (exists, needs integration) |
| Compare Tray | ✅ Live | Product | `CompareTray.tsx` multi-select comparison |
| Side-by-Side Analysis | ✅ Live | Product | `SideBySideAnalysis.tsx` detailed comparison |

---

## User Features

| Feature | Status | Agent | Notes |
|---------|--------|-------|-------|
| User Authentication | ✅ Live | Platform | Supabase auth via `AuthContext.tsx` |
| Auth Modal | ✅ Live | Product | `AuthModal.tsx` login/signup flow. Google + Discord OAuth only (email magic link removed 2026-02-21 to prevent spam accounts). |
| User Profiles | ✅ Live | Product | Settings, preferences, linked accounts |
| Kingshot Player Linking | ✅ Live | Product | `LinkKingshotAccount.tsx` - link to in-game ID |
| Player ID Uniqueness Constraint | ✅ Live | Platform | UNIQUE constraint on `profiles.linked_player_id`. Two-layer defense: frontend pre-check + DB constraint. Error handling in AuthContext + Profile.tsx (2026-02-09) |
| Linked Account Card Redesign | ✅ Live | Product | Table layout with tier-based username colors (2026-01-31) |
| Favorites Cloud Persistence | ✅ Live | Product | Supabase `user_data` table sync with retry logic (3 attempts, exponential backoff), error toasts (2026-02-06) |
| Favorites Header Badge | ❌ Removed | Product | `FavoritesBadge.tsx` - removed from header (2026-02-06). Component still exists but no longer displayed. |
| FavoritesContext (Cross-Page) | ✅ Live | Product | `FavoritesContext.tsx` - reactive favorites across all pages, Supabase source of truth, KingdomProfile toggle (ADR-013, 2026-02-06) |
| Favorites = Score Notifications | ✅ Live | Product | Follow feature removed, score change notifications now trigger for favorited kingdoms. Heart icon on Kingdom Cards (was star). `FollowKingdomButton.tsx` deleted (2026-02-06) |
| NotificationBell Improvements | ✅ Live | Product | Dedup guard on real-time handler, notification grouping (same type+title within 1hr), "You're all caught up" empty state with last-checked timestamp, FavoritesBadge added to mobile header. Dead `useScoreChangeNotifications.ts` removed (2026-02-06) |
| Score Change Notifications | ✅ Live | Product + Platform | PostgreSQL trigger on `kingdoms` table auto-notifies users when a favorited kingdom's Atlas Score changes. Shows old→new score + tier change. Purple icon (📊). End-to-end: kvk_history→kingdoms trigger→notify trigger→NotificationBell (2026-02-06) |
| Notification Preferences | ✅ Live | Product | `NotificationPreferences.tsx` toggle panel on Profile page. 3 categories: Score Changes, Submission Updates, System Announcements. Stored in `user_data.settings` JSONB. DB trigger respects preferences (2026-02-06) |
| Public Profile Tier Coloring | ✅ Live | Product | Tier-colored usernames on public profiles (2026-01-31) |
| Kingdom Players Section | ✅ Live | Product | `KingdomPlayers.tsx` - Atlas users from kingdom on profile page (2026-01-31) |
| User Directory Enhancement | ✅ Live | Product | Shows only linked Kingshot accounts with tier coloring, Kingdom, TC Level (2026-01-31). Enhanced: tier count badges on filter chips, "Member since" on cards, sort-by dropdown (role/joined/kingdom/TC), "My Kingdom" quick filter for logged-in users (2026-02-11) |
| Navigation Reorganization | ✅ Live | Product | Community dropdown (Players, Discord, About), cleaner header (2026-01-31) |
| User Achievements | ✅ Live | Product | `UserAchievements.tsx`, `AchievementBadges.tsx` |
| User Directory | ✅ Live | Product | Browse and search Atlas users |
| Random Username Generator | ✅ Live | Product | `randomUsername.ts` - AdjectiveNoun123 pattern for new users (2026-02-02) |
| Globe Icon Default Avatar | ✅ Live | Product | Pulse animation, tooltip for unlinked users (2026-02-02) |
| Welcome Toast | ✅ Live | Product | "Welcome to Atlas, [username]!" on first login (2026-02-02) |
| Profile Completion Progress | ✅ Live | Product | 5-item checklist with progress bar, auto-hides at 100% (2026-02-02) |
| Click-to-Link Flow | ✅ Live | Product | Avatar/username click scrolls to Link Kingshot section (2026-02-02) |
| My Profile Layout Redesign | ✅ Live | Product | Centered avatar/username matching Public Profile, 2x3 info grid (2026-02-02) |
| Profile Action Buttons | ✅ Live | Product | Edit Profile + Link/Unlink buttons in top-right corner (2026-02-02) |
| Multi-Account Switcher | ✅ Live | Product | `AccountSwitcher.tsx` — manage multiple linked Kingshot accounts. Switch active account, add/remove accounts. Name verification challenge for additional accounts only (not first link) to prevent false ID claiming. `player_accounts` Supabase table with RLS. 18 i18n keys × 9 languages. (2026-02-21) |
| Email Magic Link Login | ❌ Removed | Product | Removed 2026-02-21 to prevent spam accounts. `signInWithMagicLink` stripped from AuthContext + AuthModal. 7 i18n keys removed from all 9 locales. Only Google + Discord OAuth remain. |

---

## Sharing & Social

| Feature | Status | Agent | Notes |
|---------|--------|-------|-------|
| Share Button | ✅ Live | Product | `ShareButton.tsx` multi-platform sharing |
| QR Codes | ✅ Live | Product | `QRCode.tsx` for kingdom/profile links |
| Shareable Cards | ✅ Live | Product | `ShareableCard.tsx` PNG export |
| Discord Formatting | ✅ Live | Product | Copy-paste ready Discord embeds |
| Meta Tags | ✅ Live | Product | `useMetaTags.ts` for social previews |
| Referral System (Open Ambassador Network) | ✅ Live | Product + Platform | 4-tier referral system (Scout/Recruiter/Consul/Ambassador). `?ref=` URL param captured in AuthContext, stored in localStorage, recorded on signup. Auto-verify trigger when referred user links TC20+ account. `ReferralBadge.tsx`, `ReferralStats.tsx` on Profile page. Referral tier borders on UserDirectory cards. ShareButton auto-appends `?ref=` for eligible users (TC25+). Discord bot auto-syncs Consul/Ambassador roles every 30min. DB: `referrals` table + `referred_by`/`referral_count`/`referral_tier` on profiles. Spec: `docs/OPEN_AMBASSADOR_NETWORK.md` (2026-07-16) |
| Ambassador Directory | ✅ Live | Product | `/ambassadors` page — public directory of all users with referral tiers, sorted by tier+count. Filter chips by tier. Hover cards with rank badges. CTA to get referral link. (2026-02-09) |
| Ambassador Tag on Reviews | ✅ Live | Product | `KingdomReviews.tsx` shows `ReferralBadge` next to reviewer username. `kingdom_reviews` + `review_replies` tables extended with `author_referral_tier`. Review creation populates referral tier. (2026-02-09) |
| KingdomPlayers Referral Sorting | ✅ Live | Product | `KingdomPlayers.tsx` sort priority updated: admin > supporter > ambassador > consul > recruiter > scout > free. Fetches `referral_tier`, shows `ReferralBadge`. (2026-02-09) |
| Referral Anti-Gaming | ✅ Live | Platform | DB triggers: `check_referral_rate_limit` (max 10 pending/referrer), `check_referral_ip_abuse` (auto-invalidate 3+ same IP+referrer). `signup_ip` column on referrals, captured via ipify API. (2026-02-09) |
| Referral Admin Dashboard | ✅ Live | Product | `ReferralFunnel.tsx` — Admin tab showing total/pending/verified/invalid counts, conversion rate, tier distribution bars, top 5 referrers, recent referrals table, suspicious IP alerts. (2026-02-09) |
| Referral Analytics Events | ✅ Live | Product | `trackFeature('Referral Link Copied')` in ReferralStats, `hasReferral` metadata on ShareButton link copies. (2026-02-09) |
| Referral Smoothing & Universal Links | ✅ Live | Product + Platform | Enhanced referral flow: (1) URL cleanup — `?ref=` and `?src=` removed from address bar after capture via `replaceState`. (2) Landing page tracking — `REFERRAL_LANDING_KEY` stored in localStorage, `landing_page` column added to `referrals` table. (3) `useReferralLink` hook — universal referral URL generation for any page. (4) Global "Copy Referral Link" button in UserMenu (desktop) and MobileMenu for eligible users. (5) ShareButton fallback now appends `?ref=` on any page type, not just kingdom/compare. Full deferred attribution: click any referral link → browse freely → sign up later → link TC20+ account → referrer notified instantly via Supabase Realtime. (2026-02-16) |
| Referral Verification Notifications | ✅ Live | Platform | DB trigger `verify_pending_referral` inserts notification (type `referral_verified`) for referrer when referred user links TC20+ account. Real-time via Supabase channel. Purple ambassador color + 🏛️ icon. Links to /ambassadors. (2026-02-09) |
| Referred By on Profiles | ✅ Live | Product | Public profiles show "Referred by [username]" in purple for 30 days after account creation. Uses `profiles.referred_by` + `created_at`. (2026-02-09) |
| Referral Count on Player Cards | ✅ Live | Product | UserDirectory cards show referral count in tier color when user has referrals. (2026-02-09) |
| Monthly Referral Counter | ✅ Live | Product | Ambassadors hero shows "⚡ X players joined via referrals this month" live counter. Queries verified referrals since start of month. (2026-02-09) |
| Multi-Source Referral Attribution | ✅ Live | Platform | `referrals.source` column tracks 4 attribution channels: `referral_link`, `endorsement`, `review_invite`, `transfer_listing`. `?src=` URL param captured in AuthContext alongside `?ref=`. Transfer listing links append `&src=transfer`, review share buttons append `&src=review`. Endorsement attribution handled server-side in `submit_endorsement`. `ReferralStats.tsx` shows per-user source breakdown pills. `Ambassadors.tsx` has source filter chips. `ReferralIntelligence.tsx` replaces `ReferralFunnel.tsx` in admin with 4-section analytics: Overview, How People Found Atlas, Top Referrers, Recent Activity. (2026-02-11) |

---

## Data Visualization

| Feature | Status | Agent | Notes |
|---------|--------|-------|-------|
| Radar Charts | ✅ Live | Product | Multiple variants for different contexts |
| Trend Charts | ✅ Live | Product | `TrendChart.tsx` historical data |
| Win Rate Trends | ✅ Live | Product | `WinRateTrend.tsx` KvK performance |
| Donut Charts | ✅ Live | Product | `DonutChart.tsx` percentage displays |
| Premium Comparison Chart | ✅ Live | Product | `PremiumComparisonChart.tsx` advanced viz |

---

## Tools & Utilities

| Feature | Status | Agent | Notes |
|---------|--------|-------|-------|
| Score Simulator | ✅ Live | Product | `ScoreSimulator/` - what-if calculations |
| Event Calendar | ✅ Live | Product | `EventCalendar.tsx` KvK/transfer schedule |
| KvK Countdown | ✅ Live | Product | `KvKCountdown.tsx` next event timer |
| Rally Coordinator | ✅ Live | Product | `RallyCoordinator.tsx` — Admin-only rally planner. Ally+enemy player database, march time management (regular/buffed per building), rally queue + counter-rally queue with drag-and-drop, simultaneous/chain hits modes, Gantt timelines, call order display. Enemy buff timer: 2hr countdown on toggle, localStorage persistence, auto-expire with sound+vibration+toast, confirmation popup on manual toggle-off, pulsing amber indicator on PlayerPill. Mobile UX: 44px touch targets (Apple HIG), tabbed layout (Players\|Rally\|Counter), auto-scroll on queue add. Data: presets save counter queue, JSON export/import players, undo toast on delete, player duplication. QoL: summary stats bar above timelines, pulsing empty drop zones, How To Use collapsed state persisted. Dead trial code removed, i18n keys for all user-facing strings. **Accessibility (2026-06):** WCAG AA contrast fixes (#6b7280→#9ca3af/#d1d5db on dark BGs), visible focus rings (focus-visible, 2px blue outline), ARIA labels on all interactive elements, role=dialog/alertdialog on modals with Escape-to-close, role=group/region/tablist/tab on sections, aria-pressed on toggle buttons, role=slider with keyboard arrow keys on interval slider, role=button+tabIndex+keyboard Enter/Space on PlayerPills, role=menu/menuitem on context menus, role=list on queue containers, aria-live on dynamic status messages, guided empty states with step-by-step instructions. **Accessibility Phase 2 (2026-06):** Focus trap in PlayerModal (Tab cycles within dialog), aria-live announcements on queue add/remove/clear, keyboard reordering in queue (Alt+ArrowUp/Down, Delete to remove), `prefers-reduced-motion` support (disables all animations), `forced-colors` support for Windows High Contrast. 7 new empty-state i18n keys × 8 languages. **i18n Phase 3 (2026-06):** Full audit of ~47 missing rallyCoordinator keys, translated to all 8 languages. |
| Battle Planner Presets | 🔨 Local | Product | `useBattlePlanner.ts` orchestrator + 3 sub-hooks (`useBattlePlannerSession`, `useBattlePlannerPlayers`, `useBattlePlannerQueues`). **Session management:** Create/switch/archive/delete sessions per kingdom. **Supabase-backed:** 4 tables (`battle_planner_sessions`, `battle_planner_players`, `battle_planner_queues`, `battle_planner_leaders`) with full RLS. **5-building tabs:** Queue count badges per building (Castle, T1-T4). **Battle Leaders:** Collapsible panel with building assignment overview, user search, assign/unassign/remove. **Realtime sync:** Supabase postgres_changes for players, queues, leaders. **Debounced saves:** 500ms queue persistence. **Cross-building tracking:** Player→building assignment map. **localStorage migration:** Import existing players into session. **Backward compatible:** Without session, all features work via localStorage as before. (2026-02-27) |
| KvK Battle Tier List | 🔨 Local | Product | `KvKBattleTierList.tsx` — Kingdom tool for ranking players by offensive and defensive combat power for KvK Castle Battles. Two sections: Offense (removes defensive EG inflation, applies offensive EG bonuses, sums all 12 stats) and Defense (raw scouted values summed directly). Input: 3 heroes with EG levels + Attack/Lethality/Defense/Health per troop type. Natural-breaks tier assignment (SS→D) with separate tiers for offense and defense. Supabase-backed persistence (`battle_tier_lists` + `battle_tier_list_managers` tables with full RLS). Multi-list support. Kingdom-wide access: all Gold kingdom users can view, Editors/Co-Editors/Battle Managers can edit. Landing page at `/tools/battle-tier-list/about` with orange theme. Tool card in Kingdom Tools section. i18n: EN complete + nav/tools keys in all 12 locales. (2026-03-10) |
| Bear Rally Tier List | ✅ Live | Product | `BearRallyTierList.tsx` — Alliance tool for ranking members by Bear Hunt rally power. Input scouted stats (3 heroes, EG levels, Attack/Lethality), auto-calculates Bear Score with EG adjustments, assigns tiers (SS→D). Multi-list support with localStorage. Bulk add/edit. Landing page at `/tools/bear-rally`. **Refactor (2026-03):** Fixed `canEdit` to include delegates (was owner+manager only). New list auto-populates with alliance roster members (empty stats, tier D). Redesigned empty state with prominent creation prompt (differentiates no-list vs empty-list). Updated read-only banner to mention delegates. Mobile UX polish (44px touch targets, 0.8rem+ font sizes). i18n: 6 new/updated keys × 9 languages. **Unranked Empty State (2026-06):** Players without complete data (hero names, gear levels, all 3 troop types' attack/lethality) are excluded from ranking. Shown in "Unranked — Missing Data" section with amber styling and "Add Data" CTA. `isPlayerComplete()` helper in `bearHuntData.ts`. Tier calculation uses only complete players' scores. BulkEdit updated to allow saving incomplete players without validation errors. Summary footer shows "X ranked / Y total" when incomplete players exist. |
| Keyboard Shortcuts | ✅ Live | Product | `useKeyboardShortcuts.ts`, help modal |
| Keyboard Navigation | ✅ Live | Product | `useKeyboardNavigation.ts` for lists |

---

## Submissions & Community

| Feature | Status | Agent | Notes |
|---------|--------|-------|-------|
| Post-KvK Submission | ✅ Live | Product | `PostKvKSubmission.tsx` report results |
| Status Submission | ✅ Live | Product | `StatusSubmission.tsx` kingdom updates |
| Status Submission Hardening | ✅ Live | Platform | Retry logic, duplicate prevention, session error handling, admin notifications (2026-02-04) |
| Report Data Modal | ✅ Live | Product | `ReportDataModal.tsx` flag inaccuracies |
| Data Attribution | ✅ Live | Product | `DataAttribution.tsx` source credits |
| Reputation Service | ✅ Live | Platform | `reputationService.ts` user trust scores |
| KvK Correction Service | ✅ Live | Platform | `kvkCorrectionService.ts` - Supabase-backed corrections |
| KvK History Service | ✅ Live | Platform | `kvkHistoryService.ts` - Supabase + CSV fallback |
| KvK Data Migration | ✅ Live | Platform | All records in Supabase (continuously growing) + indexes + RLS |
| KvK Data Validation | ✅ Live | Platform | `scripts/validate-kvk-data.js` - CSV integrity tests |
| KvK Data Sync | ✅ Live | Platform | `scripts/sync-kvk-data.js` - Future update utility |
| Data Source Stats | ✅ Live | Platform | `DataSourceStats.tsx` - Admin parity dashboard |
| Data Freshness Alerts | ✅ Live | Platform | `dataFreshnessService.ts` - Staleness tracking + alerts |
| Correction Approval Workflow | ✅ Live | Platform | `kvkCorrectionService.ts` - Supabase-backed pending/approve/reject |
| KvK History Pagination | ✅ Live | Platform | `kvkHistoryService.ts` - Paginated queries |
| IndexedDB Caching | ✅ Live | Platform | `kvkHistoryService.ts` - Offline support with 1-hour TTL |
| User Correction Stats | ✅ Live | Platform | `UserCorrectionStats.tsx` - profile correction tracking |
| KvK Realtime Updates | ✅ Live | Platform | `useKingdomsRealtime.ts` - Supabase Realtime for instant kvk_history updates |
| KvK Bye Outcome Support | ✅ Live | Platform | Bye outcomes display with gray "-" for Prep/Battle, "No match" for opponent, zero Atlas Score impact (2026-02-03) |
| Kingdom 0 Bug Fix | ✅ Live | Platform | Prevented phantom Kingdom 0 creation: deleted row from DB, added CHECK constraint `kingdom_number > 0` on kingdoms table, added guard in `recalculate_kingdom_stats` SQL function to skip p_kingdom_number <= 0, added Python-side guard in `recalculate_kingdom_in_supabase` and `_update_kingdom_stats_directly` (2026-02-26) |
| KvK Spreadsheet Admin Tool | ✅ Live | Platform | `KvKSpreadsheetTab.tsx` — Spreadsheet-like bulk KvK results entry in Admin Dashboard (Review > KvK Spreadsheet). Bidirectional sync: editing prep/battle on either side of a matchup instantly updates the counterpart row with flipped results (flash highlight). Auto-outcome: computes Domination/Comeback/Reversal/Invasion from prep+battle. Bye toggle. Per-row and bulk Save All via `submit_kvk_partial` RPC with `p_is_admin: true`. Cmd+Enter shortcut. Stats bar (total/complete/pending/byes) + progress bar. Kingdom filter with separate "Jump to" scroll-to-row. Hide-complete toggle to focus on incomplete rows. Cyan hue on incomplete rows for visual spotting. Auto-populate with localStorage persistence (rows survive refresh). Supabase Realtime subscription for live updates from user submissions (LIVE/OFFLINE indicator). `HIGHEST_KINGDOM_IN_KVK` updated to 1403 for KvK #11 (battle day Feb 28, 2026). (2026-03-02) |
| Historical Atlas Scores | ✅ Live | Platform | `kingdom_score` column in kvk_history stores Atlas Score at time of each KvK (2026-02-04) |
| KvK Seasons Enhanced UI | ✅ Live | Product | Prep Win/Battle Win columns, historical prep/battle records, rank display per mockup (2026-02-04) |
| Community Reviews Enhancement | ✅ Live | Product | Linked Kingshot account profile display with tier-colored usernames, TC Level 20+ requirement to prevent spam (2026-02-05) |
| Community Reviews v2 (Supabase) | ✅ Live | Product | Migrated to Supabase for persistence, edit/delete own reviews, helpful voting, reviewer's kingdom badge, admin moderation (delete only, no pre-approval) (2026-02-05) |
| Community Reviews v3 (Enhanced) | ✅ Live | Product | Sort by Most Helpful, rating breakdown stats, Top Reviewer badge (5+ helpful), review activity on Profile page (2026-02-05) |
| Community Reviews v4 (Social) | ✅ Live | Product | Verified Reviewer badge (home kingdom), Featured Review display (most helpful highlighted), reply functionality with Official badge for recruiters, notifications for helpful votes/replies (2026-02-05) |
| Kingdom Ranking History | ✅ Live | Product | Collapsible chart showing rank over time from score_history, purple color scheme, inverted Y-axis (2026-02-05) |
| Rank Movers Table Layout | ✅ Live | Design | Biggest Climbers/Fallers redesigned as proper tables with centralized headers, columns (except Kingdom Name left-aligned), full kingdom names, Old Rank → New Rank with arrow, Change column. Mobile-optimized (2026-02-06) |
| Stat Type Styling System | ✅ Live | Design | `statTypeStyles` in styles.ts — SINGLE SOURCE OF TRUTH for all stat type colors & emojis (Atlas Score=💎cyan, Prep=🛡️yellow, Battle=⚔️orange, Domination=👑green, Comeback=💪blue, Reversal=🔄purple, Invasion=💀red). All ranking cards updated (2026-02-06) |
| Rankings Global Controls | ✅ Live | Product | Top N + Experience controls moved to top of page, affect ALL cards including Rank Movers. Changed to Top 5/10/25 (default 5). Bug fix: Rank Movers now filtered by both controls via filteredRankMovers (2026-02-06) |
| Experience Filter Redesign | ✅ Live | Product | Replaced dropdown with named preset chips (All, Rookies 1-3, Veterans 4-6, Elite 7-9, Legends 10+, Custom) + custom KvK range with min/max steppers. "Exactly N KvKs" label when min=max. Mobile-optimized 44px touch targets (2026-02-06) |
| Review 200-Char Limit | ✅ Live | Product | Frontend maxLength + service validation + DB CHECK constraint, character counter (gray→yellow→red), preview panel (2026-02-05) |
| Review Rate Limiting | ✅ Live | Product | Max 3 reviews per user per day, enforced in reviewService.createReview() (2026-02-05) |
| Review Report System | ✅ Live | Product + Platform | review_reports table with RLS, flag button on reviews, report modal (reason + details), success toast, unique per user/review (2026-02-05) |

---

## Premium Features

| Feature | Status | Agent | Notes |
|---------|--------|-------|-------|
| Premium Context | ✅ Live | Platform | `PremiumContext.tsx` subscription state + refreshSubscription() |
| Tier Refactor: Recruiter Removed | ✅ Live | Product | Removed recruiter tier entirely, renamed pro→supporter across all files. 3 tiers: anonymous, free, supporter (2026-02-08) |
| Content Gating Overhaul | ✅ Live | Product | Reviews: linked+TC20+. KvK submissions: linked+TC20+. Status submissions: linked. Compare: 2 anon/3 free/5 linked (2026-02-08) |
| Upgrade Page Simplification | ✅ Live | Product | Single Supporter tier card, removed recruiter pricing/features, simplified comparison table to Free vs Supporter (2026-02-08) |
| Link Account Nudge | ✅ Live | Product | `LinkAccountNudge.tsx` — contextual nudge for non-linked users. Removed from KingdomProfile (2026-02-08), still used on Transfer Hub |
| Kingdom Profile Login Gating | ✅ Live | Product | 6 expandable sections + KingdomPlayers gated behind login for anonymous users. `LoginGatedSection` component with 🔒 sign-in prompt (2026-02-08) |
| Conversion Funnel Analytics | ✅ Live | Product | Tracks `Gated Section Expanded` (with section name), `Gated CTA: {section}` clicks, `Gated CTA: Kingdom Players`, `Gated CTA: Compare Page`, `Gated CTA: Sticky Banner`. All flow to Admin Dashboard (2026-02-08) |
| Anonymous Sticky Banner | ✅ Live | Product | Persistent fixed bottom banner on KingdomProfile for anonymous users: "Sign in free to unlock detailed analytics" with Sign In CTA. Safe-area-aware (2026-02-08) |
| Your Kingdom Badge | ✅ Live | Product | "YOUR KINGDOM" badge on KingdomCard when viewing your linked kingdom (2026-02-08) |
| Score Change Hook | ✅ Live | Product | Blurred score delta on KingdomProfile header for non-linked users; linked users see real ▲/▼ value. `KingdomHeader.tsx` (2026-02-08) |
| RIVAL Badge | ✅ Live | Product | "RIVAL" badge on KingdomCard for kingdoms that faced user's linked kingdom in KvK. Shows count (×N). `KingdomCard.tsx` (2026-02-08) |
| Match Score Teaser | ✅ Live | Product | Blurred "87%" match score on TransferBoard recruiting cards for non-linked users. `TransferBoard.tsx` (2026-02-08) |
| Stripe Checkout Flow | ✅ Live | Platform | API-based checkout session creation |
| Stripe Webhook Handler | ✅ Live | Platform | Handles subscription events, updates Supabase |
| Checkout Success/Error UX | ✅ Live | Platform | Success/canceled/error messages on Upgrade page |
| Customer Portal Integration | ✅ Live | Platform | API-based portal session for subscription management |
| Support Prompts | ✅ Live | Business | `UpgradePrompt.tsx` gentle support nudges |
| Supporter Badge | ✅ Live | Design | `SupporterBadge.tsx` visual indicator |
| Ad Banners | ✅ Live | Business | `AdBanner.tsx` for free tier |
| Ad-Free Perk Removed | ✅ Live | Business | Removed misleading "Ad-Free Experience" from supporter perks, set `adFree: false` in PremiumContext, updated AdBanner copy (2026-02-20) |
| Onboarding Funnel (4 Stages) | ✅ Live | Business | Stage 1: `SignupNudgeBar.tsx` — bottom bar nudge for anon users after 3+ profile views. Stage 2: `WelcomeToAtlas.tsx` — one-time welcome screen after linking Kingshot account showing kingdom score, rivals, favorites. Stage 3: `BattlePlannerTrialTooltip.tsx` — 1-hour free Battle Planner trial for engaged free users (3+ sessions, has favorites, activates after Feb 25). Stage 4: `ConversionBanner.tsx` — supporter pitch for active users (3+ sessions/week), dismissable with 30-day cooldown. All tracking via `useOnboardingTracker.ts` hook using localStorage. (2026-02-20) |
| Cancel Survey (Churn Recovery) | ✅ Live | Business | `/cancel-survey` page with exit survey (6 reasons + freetext), pause subscription offer, annual billing downgrade offer. `churn_surveys` Supabase table with RLS. (2026-02-20) |
| Kingdom Fund Alliance Pitch | ✅ Live | Business | `KingdomFundContribute.tsx` — shows "Your kingdom needs $X more to reach [tier]" with per-alliance-member cost breakdown ($X/100 members). Encourages collective contributions. (2026-02-20) |
| Gilded Badge System | ✅ Live | Product + Design | Users from Gold-tier Kingdom Fund kingdoms get "GILDED" badge (#ffc30b gold color), colored username, avatar border across Player Directory, KingdomPlayers, KingdomReviews, PlayersFromMyKingdom, LinkKingshotAccount. Priority: Admin > Gilded > Supporter. `getDisplayTier()` checks `goldKingdoms` set. (2026-02-14) |
| Admin Card Redesign | ✅ Live | Design | Admin cards in Player Directory get subtle cyan gradient bg, enhanced glow, cyan (#22d3ee) border. Distinguished from regular user cards. (2026-02-14) |
| Gold Tier: +2 Alliance Slots | ✅ Live | Product | Gold tier now gives 5 alliance slots (3 base + 2 gold bonus) instead of +5 invites. Managed in `KingdomProfileTab.tsx`. (2026-02-14) |
| Gold Tier: Alliance Details | ✅ Live | Product | Gold-only section in KingdomProfileTab for per-alliance main language and open spots. `alliance_details` field on `FundInfo`. (2026-02-14) |
| Gold Tier: CSV Download | ✅ Live | Product | Gold tier recruiters can download approved applicants as CSV from InboxTab. Includes username, kingdom, TC, power, language, date. (2026-02-14) |
| Alliance Info Rename | ✅ Live | Product | "Alliance Event Times" renamed to "Alliance Information" across KingdomListingCard, KingdomProfileTab, KingdomFundContribute, TransferHubLanding. (2026-02-14) |
| Transfer Season Management | ✅ Live | Product | Admin Season Mgmt sub-tab: events table with per-event analytics (kingdoms, apps, accepted, transferred, invites), toggle is_current, add new event, season reset (expires apps/invites, deactivates profiles, resets special invite caps). Auto-notifies editors on new season. `SeasonTab.tsx` (2026-03-09) |
| KvK #11 Silver Tier Promotion | ✅ Live | Business + Product | Time-limited promo: Silver Tier kingdoms get KvK Prep Scheduler + Battle Planner access (normally Gold-only) until Feb 28, 2026 22:00 UTC. `useKvk11Promo.ts` hook fetches silver kingdoms, auto-expires. `Kvk11PromoBanner.tsx` on homepage with countdown + dynamic kingdom fund link. Access gates updated in `useRallyCoordinator.ts`, `usePrepScheduler.ts`, `BattlePlannerLanding.tsx`, `PrepSchedulerList.tsx`. Zero cleanup needed — auto-reverts after deadline. Bug fix: PrepSchedulerList had 7 gold-only gates that didn't account for silver promo (2026-02-19) |

---

## Accessibility & UX

| Feature | Status | Agent | Notes |
|---------|--------|-------|-------|
| Accessibility Context | ✅ Live | Product | `AccessibilityContext.tsx` preferences |
| High Contrast Mode | ✅ Live | Design | Toggle in accessibility settings |
| Theme Context | ✅ Live | Design | `ThemeContext.tsx` dark/light modes |
| Trajan Pro Font System | ✅ Live | Design | Premium display font for headers, titles, kingdom names, logo. Two-tone styling (white/cyan, pink for Support). `FONT_DISPLAY` constant, `PageTitle` component (2026-02-04) |
| Skeleton Loaders | ✅ Live | Product | `Skeleton.tsx`, `SkeletonCard.tsx`, `LeaderboardSkeleton`, `KingdomProfileSkeleton`, `CompareCardSkeleton` |
| Feedback Widget | ✅ Live | Product | `FeedbackWidget.tsx` - floating button for bug/feature/general feedback |
| DataLoadError | ✅ Live | Product | `DataLoadError.tsx` - graceful error display with retry |
| Toast Notifications | ✅ Live | Product | `Toast.tsx` feedback system |
| Tooltips | ✅ Live | Product | `Tooltip.tsx` hover info |
| Error Boundaries | ✅ Live | Product | `ErrorBoundary.tsx` graceful failures |
| Page Transitions | ✅ Live | Product | Smooth route animations |

---

## API Endpoints

| Endpoint | Status | Agent | Notes |
|----------|--------|-------|-------|
| `/api/v1/kingdoms` | ✅ Live | Platform | CRUD, search, filters |
| `/api/v1/auth` | ✅ Live | Platform | Authentication flow |
| `/api/v1/leaderboard` | ✅ Live | Platform | Rankings data |
| `/api/v1/compare` | ✅ Live | Platform | Comparison endpoint |
| `/api/v1/submissions` | ✅ Live | Platform | Community submissions |
| `/api/v1/agent` | ✅ Live | Platform | Agent system endpoints |
| `/api/v1/discord` | ✅ Live | Platform | Discord bot integration |
| `/api/v1/player-link` | ✅ Live | Platform | Kingshot account linking |
| `/api/feedback` | ✅ Live | Platform | User feedback submission endpoint |
| `/api/v1/admin/email/inbox` | ✅ Live | Platform | Email inbox fetch with status/direction filters (2026-02-11) |
| `/api/v1/admin/email/send` | ✅ Live | Platform | Send email via Resend API, store in outbox (2026-02-11) |
| `/api/v1/admin/email/{id}/read` | ✅ Live | Platform | Mark email as read (2026-02-11) |
| `/api/v1/admin/email/stats` | ✅ Live | Platform | Email inbox statistics (2026-02-11) |

---

## Infrastructure

| Feature | Status | Agent | Notes |
|---------|--------|-------|-------|
| FastAPI Backend | ✅ Live | Platform | Python API server |
| Supabase Database | ✅ Live | Platform | Postgres with RLS |
| SQLite Local DB | ✅ Live | Platform | `kingshot_atlas.db` for API |
| Rate Limiting | ✅ Live | Platform | `rate_limiter.py` |
| CORS Configuration | ✅ Live | Platform | Secure origin allowlist |
| GZip Compression | ✅ Live | Platform | Response compression |
| CSP Headers | ✅ Live | Platform | Security headers |
| Sentry Integration | ✅ Live | Platform | Error monitoring |
| Cloudflare Pages Deployment | ✅ Live | Ops | Auto-deploy from main (migrated from Netlify 2026-02-01) |
| Cloudflare Email Worker | ✅ Live | Platform | `apps/email-worker/worker.js` — receives inbound emails to support@ks-atlas.com, stores in Supabase `support_emails` table, forwards to Gmail backup. Deployed to Cloudflare Workers with Email Routing rule. Secrets: SUPABASE_URL, SUPABASE_SERVICE_KEY, FORWARD_TO. (2026-02-11) |
| Admin Email System | ✅ Live | Product + Platform | `EmailTab.tsx` — full inbox/compose UI in Admin Dashboard. Backend: 4 API endpoints (inbox, send, read, stats). DB: `support_emails` table. Outbound via Resend API (free tier). (2026-02-11) |
| Admin Dashboard Improvements | ✅ Live | Product | P1: FeedbackTab extracted. P2: Removed Plausible duplication from Overview. P3: Moved engagement widgets off Live Traffic. P4: Subscriber duration badges + CSV export. P5: 60s auto-refresh on analytics tab. P6: CSV export utility for subscribers/feedback. (2026-02-11) |
| Custom Domain | ✅ Live | Ops | ks-atlas.com |
| React Query Caching | ✅ Live | Product + Platform | `queryClient.ts`, `useKingdoms.ts`, `useAdminQueries.ts` (12 hooks: pending counts, unread emails, submissions, claims, feedback, webhook events/stats, transfer apps/analytics, subscription tier). Phase 1 complete — 7 eslint-disable comments eliminated. (2026-02-19) |
| IndexedDB Cache | ✅ Live | Product | `indexedDBCache.ts` offline support |
| Code Splitting | ✅ Live | Product | Lazy-loaded routes |
| i18n Optimization | ✅ Live | Product | Phase 1-6 complete. 12 languages: EN, ES, FR, ZH, DE, KO, JA, AR, TR, ID, RU, PT. HTTP backend lazy loading (EN bundled, others on-demand). Centralized SUPPORTED_LANGUAGES + LANGUAGE_META (with RTL dir groundwork) in i18n.ts. Pluralization support (_one/_other). CI validation on every PR. Hardcoded string detector + translation diff script. I18N_GUIDE.md checklist. /i18n-translate workflow. PT coverage 98.1% (3,133/3,202 strings; remaining 69 intentionally English game terms/brands). PT rebuilt from scratch with 300+ exact EN→PT translations, 200+ ES→PT word mappings, 110 manual path overrides — zero Spanish remnants. All user-facing public components translated. npm scripts: validate:i18n, i18n:sync, i18n:add, i18n:check, i18n:diff, i18n:snapshot. (2026-02-28) |
| Analytics | ✅ Live | Ops | `analyticsService.ts`, Plausible |
| Dynamic Meta Tags | ✅ Live | Ops | `useMetaTags.ts` - PAGE_META_TAGS for all pages with SEO keywords (2026-02-05) |
| Structured Data | ✅ Live | Ops | `useStructuredData.ts` - JSON-LD for FAQ, Breadcrumbs (2026-02-05) |
| Expanded Sitemap | ✅ Live | Ops | Dynamic sitemap.xml (all kingdoms + seasons + static pages) (2026-02-05) |
| SEO Schema Markup | ✅ Live | Ops | WebApplication, Organization, WebSite w/ SearchAction in index.html (2026-02-05) |
| SEO Keyword Optimization | ✅ Live | Ops | Title tags, meta descriptions optimized for 13 target keywords (rankings, transfer, scouting, recruiting, kvk history, best kingdom). All pages have useMetaTags + useStructuredData breadcrumbs (2026-02-10) |
| SEO Redirect Fixes | ✅ Live | Ops | 301 redirects for /leaderboards→/rankings, /transfer-board→/transfer-hub, /pro→/support, /upgrade→/support. Fixes GSC "Page with redirect" (2026-02-10) |
| SEO FAQ Rich Snippets | ✅ Live | Ops | About page: 12 FAQ items. Rankings page: 5 FAQ items targeting "best kingdoms", "S-tier", "kingdom rankings" featured snippets. Dual injection: client-side useStructuredData + middleware edge-side JSON-LD for bots (2026-02-12) |
| SEO Crawl Budget Optimization | ✅ Live | Ops | robots.txt disallows /admin, /auth, /profile, /components, legacy URLs (2026-02-10) |
| Data Retention: kingdom_listing_views | ✅ Live | Platform | pg_cron job `cleanup_old_listing_views()` runs daily at 03:00 UTC, deletes rows older than 90 days. Prevents unbounded growth (~9M rows/year projected). (2026-03-09) |
| Data Retention: notifications | ✅ Live | Platform | pg_cron job `cleanup_old_notifications()` runs daily at 03:00 UTC, deletes read notifications older than 90 days. (2026-03-09) |
| Transfer Profile Views Bug Fix | ✅ Live | Platform | Fixed `BrowseTransfereesTab.tsx` useEffect dependency array missing `editorInfo?.kingdom_number` and `user?.id`, causing view tracking to silently fail when data loaded before editorInfo was ready. (2026-03-09) |
| Alliance Center Application Process | ✅ Live | Product | Full application flow for Alliance Centers: `AllianceCenterOnboarding` component (kingdom-based alliance discovery, apply-to-join with message, pending status, withdraw), `ApplicationsInbox` as collapsible section (collapsed by default, pending count badge on header, chevron toggle), auto-add member on approval, set resolved_at, notify applicant. Fixed RLS INSERT policy (NOT EXISTS self-referencing bug prevented all inserts). `alliance_applications.message` column, DELETE RLS policy for withdraw, notifications on approve/reject. i18n: 11 languages. (2026-03-15) |
| Admin Access Viewer | ✅ Live | Product | `AccessViewerTab.tsx` — Operations tab to look up who has access to each tool, by kingdom or username. **Tool-centric design** with 5 sections: Kingdom Profile (editors/co-editors), KvK Battle Registry (managers), Prep Day Scheduler (managers), Battle Planner (admin-granted + battle managers), Alliance Center (owners/managers/delegates with specific tool callout: Base Designer, Bear Rally, Rally Coord.). Color-coded role badges (Editor, Co-Editor, Manager, Owner, Delegate, Admin Granted). (2026-03-09) |
| Prerendering Strategy | 📄 Documented | Ops | `/docs/SEO_PRERENDERING_STRATEGY.md` - Cloudflare Workers roadmap (2026-02-05) |
| Cloudflare Prerender Middleware | ✅ Live | Ops | `functions/_middleware.ts` — Two-tier: prerender.io if PRERENDER_TOKEN set, else free HTMLRewriter edge-side meta injection for all bot-served pages (2026-02-12) |
| SEO hreflang Tags | ✅ Live | Ops | `<link rel="alternate" hreflang>` for all 9 languages (EN/ES/FR/ZH/DE/KO/JA/AR/TR) + x-default. Injected via middleware HeadInjector for bot-served pages. SPA client-side detection pattern (2026-02-12) |
| Google Search Console Guide | 📄 Documented | Ops | `/docs/GOOGLE_SEARCH_CONSOLE_SETUP.md` - GSC verification + sitemap submission (2026-02-05) |
| Primary Use Case SEO | ✅ Live | Ops | Keywords: Transfer Events, Kingdom Rankings, KvK Event (2026-02-05) |

---

## Discord Bot

| Feature | Status | Date | Agent | Notes |
|---------|--------|------|-------|-------|
| Bot Infrastructure | ✅ Live | 2026-02-07 | Platform | `/apps/discord-bot/` — Cloudflare Worker proxy bypasses IP ban, all REST calls routed via `discordFetch()` |
| Webhook Integration | ✅ Live | 2026-01 | Platform | Patch notes posting |
| Public Bot Invite | ✅ Live | 2026-02-02 | Platform | Invite link on About page |
| Bot Admin Dashboard | ✅ Live | 2026-02-02 | Platform | `BotDashboard.tsx` in Admin panel |
| Bot API Endpoints | ✅ Live | 2026-02-02 | Platform | `/api/v1/bot/*` - status, servers, send-message |
| Server Browser | ✅ Live | 2026-02-02 | Platform | View/manage connected Discord servers |
| Message Sender | ✅ Live | 2026-02-02 | Platform | Send messages/embeds to any channel |
| Command Usage Logging | ✅ Fixed | 2026-02-06 | Platform | Fixed: syncToApi sends JSON body, bot.py log_command uses data.* |
| Settler Role Auto-Assign | ✅ Live | 2026-02-07 | Platform | Bot-side: `syncSettlerRoles()` every 30min + `guildMemberAdd` check. API-side: `discordService.syncSettlerRole()` on link/unlink. Role ID: `1466442878585934102` |
| Settler Role Backfill | ✅ Live | 2026-02-04 | Platform | Admin endpoint to backfill Settler roles for existing linked users |
| Discord Roles Dashboard | ✅ Live | 2026-02-04 | Platform | Admin UI to view linked users and manage Discord role assignments |
| /link Command | ✅ Live | 2026-02-06 | Platform | Discord command linking users to ks-atlas.com/profile for Settler role |
| Reconnection Retry | ✅ Live | 2026-02-06 | Platform | Exponential backoff retry for login failures + session invalidation recovery |
| Stripe Role Sync | ✅ Verified | 2026-02-06 | Platform | Confirmed: Supporter/Recruiter roles sync on subscription change via stripe.py |
| Supporter Role Periodic Sync | ✅ Live | 2026-02-11 | Platform | `syncSupporterRoles()` every 30min in bot.js. API: `/api/v1/bot/supporter-users`. Adds/removes Supporter role based on `subscription_tier=supporter` + `discord_id`. |
| Explorer Role Auto-Assign | ✅ Built | 2026-02-11 | Platform | `DISCORD_EXPLORER_ROLE_ID` env var. Assigned instantly to every new member on `guildMemberAdd`. No eligibility check — universal role for all Discord members. |
| Discord Unlink Bug Fix | ✅ Live | 2026-02-11 | Platform | Hid unlink button for Discord-auth users (AuthContext auto-repopulates discord_id from OAuth metadata). `isDiscordAuth` prop on LinkDiscordAccount. |
| Stripe Metadata Fallback | ✅ Live | 2026-02-11 | Platform | `handle_subscription_updated` falls back to `get_user_by_stripe_customer(customer_id)` when subscription metadata is empty (Payment Link subs). Warning logs on missing metadata. |
| Supporter Role Admin Panel | ✅ Live | 2026-02-11 | Platform | DiscordRolesDashboard: Settler/Supporter tabs, Supporter stats card, per-user Sync buttons, Force Supporter Sync (bulk). API: `POST /bot/backfill-supporter-roles`, `POST /bot/sync-supporter-role`. |
| Gateway Rate-Limit Fix | ✅ Live | 2026-02-06 | Platform | Login-first architecture, health always 200, internal retry with backoff (2/4/8/16/32min) |
| Health Diagnostics | ✅ Live | 2026-02-06 | Platform | /health exposes disconnect codes, token validation, gateway status, login attempts |
| Token Pre-Validation | ✅ Live | 2026-02-06 | Platform | Raw fetch to /users/@me and /gateway/bot before discord.js login |
| Bot Analytics Dashboard | ✅ Live | 2026-02-07 | Product + Platform | Analytics tab in BotDashboard: 24h/7d/30d period selector, summary cards (commands, unique users, avg/p95 latency), command usage bar chart with unique user counts, server activity breakdown, latency-by-command table (avg/p50/p95), daily activity bar chart. API: `/api/v1/bot/analytics` endpoint. DB: `latency_ms` column in `bot_command_usage` |
| Per-Command Latency Tracking | ✅ Live | 2026-02-07 | Platform | Bot measures response time per command, sends `latency_ms` via `syncToApi()` to Supabase. Color-coded in dashboard (green <1s, yellow 1-2s, red >2s) |
| Gilded Role Periodic Sync | ✅ Live | 2026-02-14 | Platform | `syncGildedRoles()` every 30min in bot.js. API: `/api/v1/bot/gilded-users` fetches Gold-tier kingdom users with Discord. Adds/removes Gilded role (ID: `1472230516823556260`). |
| AtlasBot Page Copy Rewrite | ✅ Live | 2026-02-07 | Design | All 8 command descriptions rewritten with brand voice (competitive, analytical, direct). Feature cards and CTA updated. /help excluded from public listing |
| Premium Commands Section | ✅ Live | 2026-02-09 | Product | /multirally moved to dedicated "PREMIUM COMMANDS" section with full-width card, detailed how-it-works, 3-step flow, 3 free daily credits callout, Supporter CTA. "Free. Always." → "Free Core" |
| Multirally Credit Enforcement | ✅ Live | 2026-02-09 | Platform + Product | Persistent credit tracking via `multirally_usage` Supabase table. API: `/bot/multirally-credits/check`, `/increment`, `/multirally-stats`. Bot uses API-backed credits with in-memory fallback. BotDashboard: premium stats section (total/supporter/free uses, upsell impressions, conversion signal). Support page: "Unlimited Premium Bot Commands" perk added |
| Persistent Telemetry | ✅ Live | 2026-02-11 | Platform | `telemetry.js` logs 12 lifecycle events to Supabase `bot_telemetry` table via REST API. Memory monitoring (warn 200MB, critical 400MB). Fire-and-forget writes. Env vars set on Render. |
| Bot Observability Dashboard | ✅ Live | 2026-02-11 | Platform | `BotTelemetryTab` in Admin Dashboard (System > Bot Telemetry). Summary cards, severity bar, filterable event list, expandable metadata. API: `GET /api/v1/bot/telemetry`. Auto-refresh 60s. |
| Bot Telemetry Auto-Cleanup | ✅ Live | 2026-02-11 | Platform | pg_cron `bot-telemetry-cleanup` runs weekly Sunday 03:00 UTC, deletes rows >30 days old. |
| Bot Critical Event Alerts | ✅ Ready | 2026-02-11 | Platform | `notify_critical_bot_event()` trigger fires on error/critical INSERT to `bot_telemetry`. Posts Discord embed via pg_net. Webhook URL from vault secret `bot_alerts_discord_webhook`. |
| Transfer Group Role Sync | ✅ Live | 2026-02-19 | Product + Platform | `syncTransferGroupRoles()` every 30min in bot.js. Supabase `transfer_groups` table is single source of truth. API: `GET /api/v1/bot/transfer-groups` (public), `GET /api/v1/bot/linked-users` (now returns `all_kingdoms` per user incl. alt accounts). Bot auto-creates Discord roles named `Transfer: K{min}–K{max}` (purple #a855f7) if they don't exist, assigns/removes based on linked kingdom. `checkAndAssignTransferGroupRole()` on guildMemberAdd for instant assignment. Frontend `useTransferGroups()` hook in `useTransferHubQueries.ts` reads from Supabase, falls back to static config. |
| #-readme Welcome Flow | ✅ Live | 2026-02-19 | Product | `DISCORD_LINK_PROMPT_CHANNEL_ID` env var now used to add `#-readme` channel mention to welcome embed (not per-member spam). Welcome embed enhanced with "Start here → #-readme" + "Link your account" CTA. |
| Spotlight Automation | ✅ Live | 2026-02-20 | Product | Full rewrite of `SpotlightTab.tsx`: 3 sub-tabs (Compose/Pending/History), 10+ random messages per role (supporter/ambassador/booster), avatar=AtlasBotAvatar.webp, name="Atlas", auto-populate Discord User ID from Supabase profiles, Discord `<@ID>` mention syntax. Backend: `send_spotlight_to_discord()` helper, `_log_spotlight_history()`, `POST /bot/process-pending-spotlights`. Auto-trigger on Supporter subscription (stripe.py `handle_checkout_completed`). Ambassador auto-trigger via DB trigger `spotlight_on_ambassador` on `referral_tier` change. Supabase: `spotlight_history` table with RLS (admin-only). Mobile UX: 44px touch targets, responsive layout. |

---

## Agent System Infrastructure

| Feature | Status | Date | Agent | Notes |
|---------|--------|------|-------|-------|
| Agent Registry | ✅ Live | 2026-01-28 | Director | `/agents/AGENT_REGISTRY.md` |
| Vision Document | ✅ Live | 2026-01-29 | Director | `/docs/VISION.md` |
| Auto-Router Workflow | ✅ Live | 2026-01-29 | Director | `/.windsurf/workflows/task.md` (renamed from work.md) |
| Pre/Post Task Protocols | ✅ Live | 2026-01-29 | Director | Vision alignment, duplicate checks |
| Features Implemented Registry | ✅ Live | 2026-01-29 | Director | This file |
| Decisions Record (ADR) | ✅ Live | 2026-01-29 | Director | `/agents/project-instances/kingshot-atlas/DECISIONS.md` |
| Parking Lot | ✅ Live | 2026-01-29 | Director | `/agents/project-instances/kingshot-atlas/PARKING_LOT.md` |
| Data Quality Specialist | ✅ Live | 2026-01-29 | Director | Sub-agent under Platform Engineer |
| Frontend Testing Specialist | ✅ Live | 2026-01-29 | Director | Sub-agent under Product Engineer |
| Activity Curator | ✅ Live | 2026-01-29 | Director | Sub-agent under Release Manager |
| Daily Patch Notes (02:00 UTC) | ✅ Live | 2026-01-29 | Release Manager | `scheduler.js`, Discord webhook |
| Coming Soon Page | ✅ Live | 2026-01-29 | Release Manager | `/docs/releases/coming-soon.md` |
| Data Quality Audit | ✅ Live | 2026-01-29 | Platform | `data_quality_audit.py` |
| Submission Validation | ✅ Live | 2026-01-29 | Platform | `validate_submission.py` |

---

## Admin Dashboard Enhancements

| Feature | Status | Date | Agent | Notes |
|---------|--------|------|-------|-------|
| Stripe-Based Subscription Counts | ✅ Live | 2026-01-31 | Platform | Uses Stripe as source of truth for subscription counts |
| Admin Subscription Sync | ✅ Live | 2026-01-31 | Platform | POST /api/v1/admin/subscriptions/sync-all |
| Sync with Stripe Button | ✅ Live | 2026-01-31 | Platform | One-click reconciliation in User Breakdown section |
| Feedback Tab | ✅ Live | 2026-02-02 | Product | View/manage user feedback with status workflow |
| 2-Tier Navigation | ✅ Live | 2026-02-03 | Product | Primary categories (Analytics/Review/System) + contextual sub-tabs |
| Compact Header | ✅ Live | 2026-02-03 | Product | Reduced header, total pending badge, 40% vertical space reduction |
| Lazy-Loaded Sub-Components | ✅ Live | 2026-02-03 | Product | AnalyticsDashboard, EngagementDashboard, BotDashboard, DataSourceStats, WebhookMonitor |
| Performance Optimization | ✅ Live | 2026-02-03 | Product | Chunk size reduced from 528KB to 74KB (86% reduction) |
| CSV Import Pipeline | ✅ Live | 2026-02-07 | Product | 4-step wizard: Input → Preview & Validate → Duplicate Review → Import with Progress. Batched inserts (50/batch), animated progress bar, validation feedback with highlighted errors, Bye match support |
| Import History Audit Log | ✅ Live | 2026-02-07 | Product | `import_history` table in Supabase. Logs admin, row counts, KvK numbers per import. Visible on Import tab |
| Recalculate Atlas Scores | ✅ Live | 2026-02-07 | Product | Button calls `recalculate_all_kingdom_scores()` + `verify_and_fix_rank_consistency()`. Shows kingdoms updated, avg score, ranks fixed |
| Analytics Growth Charts | ❌ Removed | 2026-02-09 | Platform | Removed — Plausible was connected after site launch (Jan 25), causing misleading zero-padded charts. Charts + backend endpoints deleted. |
| S1.1: Email Templates | ✅ Live | 2026-02-11 | Product | Pre-built reply templates in EmailTab compose view (Welcome, Bug, Feature, Resolved) |
| S1.2: Email Notification Badge | ✅ Live | 2026-02-11 | Product | Unread email count badge on Admin header, polls every 30s |
| S1.3: Email Thread Grouping | ✅ Live | 2026-02-11 | Product | Group emails by thread_id, show thread count, toggle button |
| S1.4: Email Search | ✅ Live | 2026-02-11 | Product | Full-text search on subject, body, sender via backend ilike |
| S1.5: Canned Responses Library | ✅ Live | 2026-02-11 | Product + Platform | Supabase `canned_responses` table, CRUD API endpoints, usage tracking, replaces hardcoded templates |
| S2.1: Tab Extraction | ✅ Live | 2026-02-11 | Product | `CorrectionsTab`, `KvKErrorsTab`, `TransferStatusTab` extracted from AdminDashboard (~200 lines reduced) |
| S2.2: Feedback Email Reply | ✅ Live | 2026-02-11 | Product | "Reply via Email" button on feedback items, pre-fills compose via sessionStorage |
| S2.3: Admin Notes Display | ✅ Live | 2026-02-11 | Product | Show review_notes on corrections and KvK error cards with styled ADMIN NOTE badge |
| S2.4: Dashboard Search Bar | ✅ Live | 2026-02-11 | Product | Global search input between header and category tabs |
| S2.5: CSV Export Extended | ✅ Live | 2026-02-11 | Product | CSV export buttons on Corrections and KvK Errors tabs |
| S3.1: Response Time Tracking | ✅ Live | 2026-02-11 | Platform | Avg response time (inbound→reply) calculated in email stats, displayed in EmailTab |
| S3.2: Subscriber Churn Alerts | ✅ Live | 2026-02-11 | Platform + Product | Backend `/churn-alerts` endpoint reads webhook_events, UI section in AnalyticsOverview |
| S3.3: Weekly Digest Email | ✅ Live | 2026-02-11 | Platform | POST `/email/weekly-digest` compiles stats and sends via Resend |
| S3.4: Trend Sparklines | ✅ Live | 2026-02-11 | Product | Inline SVG sparklines on key metric cards in AnalyticsOverview |
| S3.5: Date Range Picker | ✅ Live | 2026-02-11 | Product | Date range inputs + 7d/14d/30d quick buttons in AnalyticsOverview |
| Admin Gold Tier Grant/Revoke | ✅ Live | 2026-02-13 | Product + Ops | Grant/revoke Gold/Silver/Bronze tier override to any kingdom from Admin Dashboard → Transfer Hub → Funds tab. DB trigger `enforce_admin_tier_override` preserves override through depletion cycles. Can grant to kingdoms without existing fund entries (creates one). "ADMIN OVERRIDE" badge shown on overridden funds. |

---

## CI/CD Pipeline

| Feature | Status | Date | Agent | Notes |
|---------|--------|------|-------|-------|
| GitHub Actions CI | ✅ Live | 2026-01 | Ops | Lint, test, build pipeline |
| Playwright E2E Tests | ✅ Live | 2026-02-02 | Product | E2E tests in CI with artifact uploads |
| Lighthouse Audit | ✅ Live | 2026-01 | Ops | Performance monitoring |
| CI Hardening: npm ci | ✅ Live | 2026-02-13 | Ops | Replaced `npm install` with `npm ci` in lint-and-test + build jobs for deterministic installs |
| CI Hardening: npm Cache | ✅ Live | 2026-02-13 | Ops | Added npm cache to lint-and-test + build jobs via `actions/setup-node` cache option |
| CI Hardening: E2E Quality Gate | ✅ Live | 2026-02-13 | Ops | Removed `continue-on-error: true` from E2E job — failures now block merges |
| CI Hardening: Lighthouse Quality Gate | ✅ Live | 2026-02-13 | Ops | Removed `continue-on-error: true` from Lighthouse step — regressions now fail the build |
| Deploy Notifications (Discord) | ✅ Live | 2026-02-13 | Ops | `deploy-notify` job posts to Discord webhook on push to main. Shows all job statuses. Requires `DISCORD_DEPLOY_WEBHOOK_URL` secret |

---

## Data Correction System

| Feature | Status | Date | Agent | Notes |
|---------|--------|------|-------|-------|
| KvK Correction Service | ✅ Live | 2026-01-30 | Platform | `kvkCorrectionService.ts` - stores/applies KvK corrections |
| KvK Correction Auto-Apply | ✅ Live | 2026-01-30 | Platform | Corrections apply when loading KvK records in `api.ts` |
| Admin KvK Error Approval | ✅ Live | 2026-01-30 | Platform | AdminDashboard applies corrections on approval |
| Opponent Correction Sync | ✅ Live | 2026-01-30 | Platform | Auto-applies inverse correction for opponent kingdom |
| Correction Audit Trail | ✅ Live | 2026-01-30 | Platform | Tracks approved_at, approved_by for transparency |

---

## Multi-Kingdom Comparison

| Feature | Status | Date | Agent | Notes |
|---------|--------|------|-------|-------|
| Multi-Kingdom Inputs | ✅ Live | 2026-01-30 | Product | Up to 5 kingdom input slots (Pro feature) |
| Dynamic Comparison Table | ✅ Live | 2026-01-30 | Product | `ComparisonRow` supports 2-5 kingdoms with dynamic grid |
| Multi-Kingdom Header | ✅ Live | 2026-01-30 | Product | Color-coded kingdom names with tier badges |
| Multi-Kingdom Radar Chart | ✅ Live | 2026-01-30 | Product | `MultiCompareRadarChart` overlays up to 5 kingdoms |
| Multi-Kingdom Winner Calc | ✅ Live | 2026-01-30 | Product | Scores kingdoms across 11 metrics, handles ties |

---

## New Kingdom Submission System

| Feature | Status | Date | Agent | Notes |
|---------|--------|------|-------|-------|
| Add Kingdom Modal | ✅ Live | 2026-01-31 | Product | Submit new kingdoms not tracked in Atlas |
| First KvK Selection | ✅ Live | 2026-02-02 | Platform | Select first KvK to determine relevant history |
| "No KvK Yet" Option | ✅ Live | 2026-02-02 | Platform | Support kingdoms that haven't had their first KvK |
| KvK Date Helper | ✅ Live | 2026-02-02 | Platform | Dates shown in dropdown to help identify correct KvK |
| Admin Auto-Creation | ✅ Live | 2026-02-02 | Platform | Approval creates kingdom + KvK history in Supabase |
| first_kvk_id Column | ✅ Live | 2026-02-02 | Platform | Migration: docs/migrations/add_first_kvk_id.sql |

---

## Extended Feature Registry

| Feature | Status | Notes |
|---------|--------|-------|
| Transfer Hub — Access Gate | ✅ Built | Owner-only access during pre-launch. Non-admin users see "Coming soon" page with back link. Rename from Transfer Board → Transfer Hub, URL /transfer-hub (2026-02-07) |
| Transfer Hub — Transfer Profile Form | ✅ Built | Player-created transfer cards with auto-fill from linked account, validation, Supabase upsert (2026-02-06) |
| Transfer Hub — Application System | ✅ Built | Apply modal with 3-slot visualization, MyApplicationsTracker, withdraw, status tracking (2026-02-06) |
| Transfer Hub — Recruiter Dashboard | ✅ Built | Full-screen modal: inbox with status actions, team view, fund overview, recruiting toggle. Profile tab with tier-gated editing for pitch, offer/want, min requirements, event times, languages, contact link, recruitment tags (2026-02-07) |
| Transfer Hub — Kingdom Fund (Stripe) | ✅ Built | Full pipeline: Stripe product/prices/payment links, KingdomFundContribute modal, webhook handler (credit_kingdom_fund), weekly depletion Edge Function cron, tier auto-upgrade, dedicated contribution success overlay (2026-02-07) |
| Kingdom Fund — Grace Period & Transactions | ✅ Live | 1-week grace period before tier downgrade on depletion. `kingdom_fund_transactions` table logs all balance changes. FundTab restructured with Overview + Activity sub-tabs. Grace period alert banners on FundTab and KingdomProfile. Depletion starts Feb 23 via cron `0 0 * * 1`. i18n 19 keys × 9 langs. (2026-02-20) |
| Transfer Hub — Editor Claiming | ✅ Built | Nominate form with TC20+ check, endorsement progress bar, share link, endorse button (2026-02-06) |
| Transfer Hub — Tier Info Display | ✅ Built | 4-tier breakdown (Standard/Bronze/Silver/Gold) with costs, features, and current tier highlight in Recruiter Dashboard Profile tab (2026-02-07) |
| Transfer Hub — Co-Editor Assignment | ✅ Built | Primary editors can invite co-editors by user ID with kingdom link validation, TC20+ check, duplicate detection, reactivation support (2026-02-07) |
| Transfer Hub — Application Auto-Expiry | ✅ Built | Edge Function `expire-transfer-applications` expires pending/viewed/interested apps past `expires_at`. Cron runs daily at 06:00 UTC via pg_cron (2026-02-07) |
| Transfer Hub — RLS Policies | ✅ Built | 3 new policies: editor UPDATE on kingdom_funds (profile editing), editor INSERT on kingdom_editors (co-editor invites), editor UPDATE on kingdom_editors (co-editor management). Full audit on all 6 tables (2026-02-07) |
| Transfer Hub — Editor Role Management | ✅ Built | Admin action buttons (Activate/Suspend/Remove) on editor & co-editor cards. Promote to Editor on co-editors. Bulk deactivate 30d+ inactive. Confirmation dialogs for destructive actions. Notifications on every status change. (2026-02-11) |
| Transfer Hub — Co-Editor Self-Nomination | ✅ Built | "Become a Co-Editor" CTA on EditorClaiming when kingdom has active editor. No endorsements required. Max 2 co-editors/kingdom enforced. Slot counter shown. Editor approval flow via notifications. TC20+ required. Realtime sync: applicant sees approval/decline instantly via Supabase Realtime on their claim; editor sees new co-editor requests AND transfer applications instantly via Realtime subscription on RecruiterDashboard (INSERT+UPDATE on kingdom_editors + transfer_applications). Silent refresh avoids skeleton flash. Purple badge on Recruiter Dashboard button shows pending co-editor count (outside dashboard). Analytics funnel: `Co-Editor Request Submitted` → `Co-Editor Request Response`. Auto-expire verified: pg_cron `expire_pending_coeditor_requests()` runs daily at 07:00 UTC. (2026-02-11, Realtime+polish 2026-02-13) |
| Transfer Hub — Co-Editors Admin Tab | ✅ Built | Dedicated 🤝 Co-Editors sub-tab in Transfer Hub admin. No endorsement data shown. Purple badge (#a855f7). Separated from Editor Claims tab. (2026-02-11) |
| Transfer Hub — Editor Role Enhancements | ✅ Built | Approve/Reject buttons for pending co-editor requests in RecruiterDashboard. Pending count badge on Co-Editors tab. Co-editor request notification preference. "Managed by [editor]" on kingdom profile header. RLS for co-editor self-nomination. Rate limit (1/user/day). Admin audit log table. Auto-expire pending requests after 7 days (pg_cron). Removal cascade trigger. (2026-02-11) |
| Nearby Kingdoms Transfer Group Filter | ✅ Built | SimilarKingdoms now compares within same transfer group (was ±50 range). Uses `getTransferGroup()` config. Tooltip shows group label. (2026-02-21) |
| PrepScheduler Minutes Display | ✅ Built | `formatMinutes()` always shows minutes (e.g. `10,000m` not `6d 22h 40m`). Cleaner for Prep Scheduler submissions table. (2026-02-21) |
| Atlas Bot Dashboard v2 | ✅ Built | `/atlas-bot/dashboard` — full guild management. Multi-guild support (manage multiple servers). Tab navigation: Events, Settings, Admins, History. Discord permission verification via `verify-guild-permissions` Edge Function (MANAGE_GUILD check). Timezone toggle (UTC + local time preview). Admin management UI (add/remove by Atlas username). Event history log (last 50 sent reminders with status). Custom reminder range 0–60 minutes (presets + custom input). Reference date picker for recurring event cycles. Bear Hunt corrected to "Every 2 Days". Auth: sign-in + Discord link + MANAGE_GUILD required. (2026-02-22) |
| Alliance Event Reminders (Bot) | ✅ Built | `allianceReminders.js` — reads `bot_alliance_events` from Supabase every minute via cron. Sends Discord embeds with optional role mentions. Handles Bear Hunt (every 2 days), Viking Vengeance/Swordland Showdown (biweekly), Tri-Alliance Clash (monthly/4-week) via `reference_date` cycle counting. Updates `last_reminded_at` for duplicate prevention (90-min guard). Logs all attempts to `bot_event_history` table (sent/failed). (2026-02-22) |
| Bot Dashboard 500 Fix | ✅ Fixed | Supabase trigger functions `fn_bot_guild_auto_owner` and `fn_bot_guild_default_events` were missing `SET search_path = public` on SECURITY DEFINER functions. Migration recreated both with explicit search_path. Also added: `last_reminded_at` column, `bot_event_history` table with RLS, `reminder_minutes_before` CHECK (0-60), performance indexes. (2026-02-22) |
| Bot Dashboard 401 Fix | ✅ Fixed | `BotDashboard.tsx` `fetchDiscordGuilds` was missing `Authorization: Bearer` header when calling `verify-guild-permissions` Edge Function. Supabase API gateway requires this header even when `verify_jwt: false`. Added `'Authorization': \`Bearer ${SB_ANON}\`` to the fetch headers. (2026-02-23) |
| Partial KvK History Submissions | ✅ Built | Progressive KvK matchup updates: users can submit matchup-only (Sunday after matchmaking), then add prep winner, then battle winner. DB migration: `prep_result`, `battle_result`, `overall_result` now nullable in `kvk_history`. `submitted_by` UUID column added. Supabase RPC `submit_kvk_partial()` handles insert + update of both mirror records atomically. New `KvKMatchupSubmission.tsx` component with auto-detection of existing records and mode switching. KvK Seasons page: "Add Matchup" button for logged-in users, partial matchup cards with dashed border + status badges (Matchup Only / Prep Done / Awaiting Battle). `scoreHistoryService` updated to handle null prep/battle results. `MatchupWithScores.is_partial` flag. (2026-02-23) |
| Transfer Status Submitter Username | ✅ Fixed | Admin dashboard Transfer Status tab now shows the submitter's username. `statusService.ts` joins `profiles` table; `TransferStatusTab.tsx` displays `submitted_by_name`. (2026-02-23) |
| Transfer Group K847+ | ✅ Built | Open-ended transfer group `[847, 99999]` added to `transferGroups.ts` for kingdoms beyond last transfer event. Label shows "K847+". `getTransferGroup` handles open-ended range. `MAX_TRANSFER_KINGDOM` excludes sentinel value. (2026-02-23) |
| KvK Phase Schedule System | ✅ Built | `kvk_schedule` table tracks per-KvK phase timestamps (matchups_open_at, prep_open_at, battle_open_at, is_complete). `kvk_matchup_reports` table for user-submitted error reports with RLS. `submit_kvk_partial` RPC enforces: user must own one of the kingdoms (non-admin), phase-based restrictions via schedule timestamps, prevents overwriting existing results. pg_cron job `auto-increment-kvk` runs every Saturday 00:00 UTC to auto-create next KvK schedule and mark previous complete. Seeded KvK #10 (complete) and #11 schedules. (2026-02-23) |
| KvK Matchup Submission v2 | ✅ Built | `KvKMatchupSubmission.tsx` rewritten: auto-fills user's kingdom from profile (locked field for non-admins), phase status badge from `kvk_schedule`, prep/battle winner pickers blocked by phase with "Opens [date]" message, 🚩 Report Issue button+modal for existing matchups (inserts to `kvk_matchup_reports`), admin bypass for all restrictions, frontend kingdom ownership guard. (2026-02-23) |
| KvK Phase Banner | ✅ Built | `KvKPhaseBanner.tsx` — dismissable banner below header showing current KvK phase (matchup/prep/battle) with color-coded styling and CTA link to seasons page. Auto-detects phase from `kvk_schedule`. Dismissal persisted in localStorage per KvK+phase. Renders in `App.tsx` between Header and CampaignNotificationBanner. (2026-02-23) |
| Admin KvK Bulk Matchup + Reports | ✅ Built | `KvKBulkMatchupTab.tsx` in admin Review category. Bulk matchup input: paste multiple lines (K172 vs K189, 172-189, 172,189 formats), parse preview with validation, batch submit via `submit_kvk_partial` RPC. Matchup Reports review: load/resolve/dismiss user-submitted reports from `kvk_matchup_reports`. (2026-02-23) |
| Bot Dashboard v3 — Simplified Embeds | ✅ Built | Event test embeds simplified: title="[icon] [Event] starting soon!" (links to ks-atlas.com), description="[message]\nJoin us at **HH:MM UTC**.", footer="Brought to you by Atlas · ks-atlas.com". No fields. Gift code embed: title links to /tools/gift-codes, shows code + "Redeem with 1 click in Atlas!" link. Bot `allianceReminders.js` updated to match. (2026-02-16) |
| Bot Dashboard v3 — Discord Admin Search | ✅ Built | Admin tab: "ADD BY DISCORD USERNAME" with live search dropdown. Queries `profiles.discord_username` (min 2 chars). Shows Discord username + Atlas username per suggestion. Click-to-add. Admin list displays Discord usernames. (2026-02-16) |
| Bot Dashboard v3 — Supporter Gate | ✅ Built | Non-supporters redirected to upsell page with Atlas Bot avatar, feature checklist (event reminders, gift codes, test messages, multi-server), and gradient "Become a Supporter →" CTA. Admins bypass gate. (2026-02-16) |
| Bot Dashboard v4 — Gift Code Role Mentions | ✅ Built | `gift_code_role_id` column on `bot_guild_settings`. Searchable role dropdown in Settings. Bot auto-posts gift codes with `<@&roleId>` mention per guild. `createNewGiftCodeEmbed()` accepts customMessage, green color, title links to /tools/gift-codes. (2026-02-24) |
| Bot Dashboard v4 — Multi-Guild Gift Code Auto-Post | ✅ Built | `scheduler.js` queries ALL guilds with `gift_code_alerts=true` from Supabase. Posts to each guild's `gift_code_channel_id` (fallback: `reminder_channel_id`) with per-guild custom message + role mention. Atlas Discord hardcoded channel kept as backward compat. (2026-02-24) |
| Bot Dashboard v4 — Access Control | ✅ Built | Replaced "Admins" tab with "Access Control". Anyone with Discord Manage Server permission gets dashboard access by default. Server owner can block specific users via Discord username search (role='blocked' in `bot_guild_admins`). Blocked users list with unblock. (2026-02-24) |
| Bot Dashboard v4 — Connected Servers | ✅ Built | New section in Settings tab listing all registered servers with server icon, name, and "Currently viewing" indicator. Owner can remove a server (cascading delete of events, history, admins). Stats bar shows Blocked count. (2026-02-24) |
| Prep Scheduler — Parallel Init Fetch | ✅ Built | `usePrepScheduler.ts` init effect changed from 4 sequential awaits to `Promise.all` for ~4x faster page load. (2026-02-25) |
| Prep Scheduler — i18n Deadline Countdown | ✅ Built | `getDeadlineCountdown()` in `utils.ts` now accepts optional `t` function. Deadline strings ("3d 2h left", "Deadline passed") are translatable. Backward-compatible — callers without `t` get English fallback. 4 new i18n keys across 9 languages × 2 dirs (72 translations). (2026-02-25) |
| Prep Scheduler — i18n Toast Day Labels | ✅ Built | Replaced hardcoded `DAY_LABELS[day]` with `getDayLabel(day, t)` in `exportOptedOut` and `runAutoAssign` toast messages. Removed unused `DAY_LABELS` import. (2026-02-25) |
| Prep Scheduler — Empty State Landing | ✅ Built | `PrepSchedulerList.tsx` shows guidance card with 📭 icon when user has no schedules. Different messages for Gold Tier users ("Create your first schedule") vs non-Gold ("Ask your Prep Manager"). 3 new i18n keys across 9 languages × 2 dirs (54 translations). (2026-02-25) |
| Prep Scheduler — Duplicate Schedule Prevention | ✅ Built | `createSchedule()` in `usePrepScheduler.ts` checks for existing active schedule on same kingdom (+KvK number if specified) before creating. Shows error toast if duplicate found. 1 new i18n key across 9 languages × 2 dirs (18 translations). (2026-02-25) |
| Discord Welcome Message Overhaul | ✅ Built | `bot.js` `guildMemberAdd` handler: embedded message → plain text. 20 concise variations with Atlas personality copy (competitive, data-driven). Mentions user directly via `<@userId>`. Dynamically resolves #general and #atlas-commands channel IDs for proper Discord channel mentions. Invites to chat, use `/kingdom`, and visit ks-atlas.com. Explorer role assignment preserved. (2026-02-25) |
| Prep Scheduler — Mobile UX Pass (Batch 3) | ✅ Built | 5 mobile-focused improvements: (1) iOS auto-zoom fix — input/select fontSize 1rem on mobile across List/Form/Manager/TimeRangePicker; (2) TimeRangePicker stacked layout on mobile with From/To labels, larger touch targets, full-width Add button; (3) Manager action buttons — primary actions always visible + collapsible "More Actions" drawer on mobile; (4) Day tabs — short labels (Mon/Tue/Thu) on mobile with count as subtitle, 48px min-height; (5) Slot grid collapse — mobile shows only assigned slots + gaps by default, "Show All 48 Slots" toggle. 11 new i18n keys × 9 langs × 2 dirs (198 translations). `getDayLabelShort` helper added to types.ts. (2026-02-17) |
| Prep Scheduler — 49-Slot Stagger Toggle | ✅ Built | Editors, Co-Editors, and Prep Managers can toggle a 23:45 UTC slot before the normal 48 half-hour slots, giving 49 total. DB column `stagger_enabled` on `prep_schedules`. Toggle button in both mobile and desktop action areas. Auto-assign respects stagger (caps at 49 when enabled). All hardcoded 48 references replaced with dynamic `maxSlots`. Slot grid, day tab counts, waitlist cutoff, and mobile "Show All Slots" label all update dynamically. Manual add/remove of players to slots works at any time (post auto-assign included). (2026-02-19) |
| Prep Scheduler — Optimized Auto-Assign (Maximum Bipartite Matching) | ✅ Built | Replaced greedy slot assignment with maximum bipartite matching via augmenting paths. Guarantees the maximum number of top-N users (N=maxSlots, 49 with stagger / 48 without) get assigned. Users ranked beyond N by effective speedups are never accommodated — slots left empty instead. Priority-aware: processes low→high so top-ranked players can "bump" lower ones. Enhanced toast shows "X/49 top players" when submissions exceed maxSlots. Files: `utils.ts` (algorithm), `usePrepScheduler.ts` (toast). (2026-02-22) |
| Kingdom Ambassador Program | 🚧 Planned | Full spec at `/docs/KINGDOM_AMBASSADOR_PROGRAM.md` — 3-phase rollout, 1 per kingdom, referral tracking |
| FilterPanel Integration | 🚧 Planned | Component exists, needs wiring to KingdomDirectory |
| Mobile Responsive Pass | ✅ Live | 2026-02-05 - Touch targets fixed to 44px min on Header, KingdomProfile, CompareKingdoms, Leaderboards, KingdomCard, KingdomReviews, KvKHistoryTable, SupportAtlas, Profile |
| Mobile UX Refinement v2 | ✅ Built | Comprehensive mobile polish: scoped global touch target rule (was bloating inline elements), body scroll lock on MobileMenu with scroll position preservation, backdrop overlay for MobileMenu dismiss, safe-area-inset padding on MobileMenu, smooth scrolling + reduced-motion respect, tap highlight control, overflow-wrap on body, range input touch-friendly thumbs (24px), sticky search bar perf hints (will-change/contain), typography bumps across MobileCountdowns/WinRates/KingdomCard/EditorClaiming (all above 10px minimum), mobile sort select consistency (0.85rem), ReportDataModal/KingdomProfile close button 44px touch targets, TransferBoard compare bar touch targets. Files: index.css, Header.tsx, MobileMenu.tsx, QuickActions.tsx, MobileCountdowns.tsx, KingdomCard.tsx, WinRates.tsx, ReportDataModal.tsx, KingdomDirectory.tsx, KingdomProfile.tsx, TransferBoard.tsx, EditorClaiming.tsx (2026-02-16) |
| Transfer Hub Mobile UX Pass | ✅ Built | Bottom-sheet modals, 44px touch targets, iOS zoom prevention (16px inputs), 2-col grid on mobile, safe area insets across all Transfer Hub components (2026-02-07) |
| Transfer Hub — Infinite Scroll | ✅ Built | IntersectionObserver-based infinite scroll for standard listings, loading skeletons, spinner sentinel (2026-02-07) |
| Transfer Group Filters (Site-Wide) | ✅ Built | Centralized config in `src/config/transferGroups.ts` with flexible group ranges, outdated-disclaimer logic, and helper functions. Transfer Group dropdown filter added to: Home Directory, Kingdom Rankings, Player Directory, and Transfer Hub ("I'm Transferring" tab with auto-detect from linked kingdom). Disclaimer auto-shows when groups are likely outdated. HOW TO UPDATE: edit `TRANSFER_GROUPS` array and `TRANSFER_GROUPS_UPDATED_AT` in the config file. (2026-02-12) |
| Transfer Hub — KingdomListingCard Redesign | ✅ Built | Transfer Status: gold/silver colors. Performance: centered title, cyan Atlas Score+Rank merged, gray-bordered stat boxes. Characteristics: Vibe tags, language pair, min power/TC, kingdom bio. Reviews moved to More Details. Alliance Event Times grid with UTC/Local toggle. NAP/Sanctuaries/Castle row in More Details. Fixed broken emoji (2026-02-09) |
| Transfer Hub — Browse Tab Invites | ✅ Built | Send Invite button on transferee cards. Duplicate check (pending invite query), recipient notification, budget enforcement, "✓ Invited" state tracking via `sentInviteIds`. Uses `transfer_invites` table (2026-02-09) |
| Transfer Hub — Anonymous Alias System | ✅ Built | Deterministic alias generator (`getAnonAlias`) converts profile UUIDs into memorable identifiers like "Anon-falcon38". FNV-1a hash on UUID halves → word from 120-word list + 2-digit number. Same profile always produces same alias across all languages. Updated 8 display points: ApplicationCard (header + message senders), BrowseTransfereesTab (card + watchlist save), RecommendedSection, SentInvitesPanel, Messages (conversations + pre-app + sender names), InboxTab CSV export, TransferProfileForm share text, TransferHubSubTabsExtra admin. Real identity revealed on acceptance (existing `isAnon` checks preserved). Added `transfer_profile_id` and `is_anonymous` fields to Conversation type for proper detection without string-matching. **Recommendations (v2):** (1) Tooltip on 🔒 icon explaining anonymity across 4 components, (2) "You appear as: 🔒 Anon-xxx" banner on TransfereeDashboard overview, (3) Client-side search/filter by username or alias in BrowseTransfereesTab, (4) Alias collision detection + alias search in admin ProfilesTab, (5) Pre-app message sender name audit — confirmed clean. i18n: 5 new keys in all 12 locales. Files: `anonAlias.ts` (new), `ApplicationCard.tsx`, `BrowseTransfereesTab.tsx`, `RecommendedSection.tsx`, `SentInvitesPanel.tsx`, `Messages.tsx`, `InboxTab.tsx`, `TransferProfileForm.tsx`, `TransferHubSubTabsExtra.tsx`, `TransfereeDashboard.tsx`, `messages/types.ts`. (2026-02-26) |
| Transfer Hub — Contribution History | ✅ Built | Fund tab shows contribution log with amount, date, running total. Auto-loads on tab select. RLS: editors can view their kingdom's contributions. Empty state with share CTA (2026-02-09) |
| Transfer Hub — Fund Contribution Notifications | ✅ Built | DB trigger `on_fund_contribution_notify` fires on INSERT to `kingdom_fund_contributions`. Notifies all active editors with 💰 icon. Wired to Stripe webhook pipeline (2026-02-09) |
| Transfer Hub — Application Expiry Warnings | ✅ Built | `notify_expiring_applications()` DB function finds apps expiring within 24h, deduplicates via metadata, inserts ⏳ notification. Cron at 05:00 UTC via pg_cron (2026-02-09) |
| Transfer Hub — Real-Time Browse | ✅ Built | Supabase Realtime subscription on `transfer_profiles` INSERT. New profiles auto-prepend to browse list. Channel cleaned up on tab switch (2026-02-09) |
| Transfer Hub — Transfer Notification Preferences | ✅ Built | `transfer_updates` toggle in NotificationPreferences. Controls new_application, application_status, co_editor_invite, fund_contribution, application_expiring notifications. Defaults enabled (2026-02-09) |
| Transfer Hub — Open Access Gate | ✅ Built | Removed owner-only gate. Requires linked Kingshot account. Shows "Sign In" or "Link Account" CTA for gated users. (2026-02-09) |
| Transfer Hub — Self-Kingdom Protection | ✅ Built | Users cannot apply to own kingdom. "Your Kingdom" badge on listing card. Own kingdom excluded from transferring mode. Guard in ApplyModal. (2026-02-09) |
| Transfer Hub — My Invites | ✅ Built | New section in MyApplicationsTracker: pending invites with Accept/Decline, past invites collapsible. Fetches from `transfer_invites` via recipient's transfer profile. (2026-02-09) |
| Transfer Hub — Recruiter Onboarding | ✅ Built | 3-step dismissible banner (Claim → Fund → Recruit) in RecruiterDashboard. Steps show ✅ when done. Persisted in localStorage. (2026-02-09) |
| Transfer Hub — Analytics Events | ✅ Built | 8 tracking calls: tab switch, invite sent, contribution link copied, mode select, mode toggle, apply click, fund click, dashboard open. (2026-02-09) |
| Homepage Restructure (Option B) | ✅ Live | Quick Actions (4 tiles: Transfer Hub, Rankings, KvK Seasons, Atlas Bot with original SVG icons), Transfer Hub Banner (dismissable CTA with countdown), Mobile Countdowns (KvK + Transfer thin pills with "Next KvK"/"Next Transfer" labels + seconds). Mobile-first: 2×2 grid on mobile, 4-col on desktop. Reuses KvKCountdown status logic. (2026-02-09) |
| Homepage Analytics Tracking | ✅ Live | QuickAction Clicked (with tile label), Transfer Banner CTA Clicked, Transfer Banner Dismissed, Scroll Depth (25/50/75/100%) on 4 pages (Homepage, Kingdom Profile, Transfer Hub, Rankings). Admin Dashboard: Homepage CTR section with Quick Action breakdown, Transfer Banner CTR, per-page scroll depth bar charts, drop-off alert for pages where <30% reach 50% depth. Uses `useScrollDepth` hook + `getHomepageCTR()` in analyticsService. (2026-02-09) |
| Transfer Hub — Apply Button Fix | ✅ Built | Removed `isPremium` gate from Apply button — all kingdoms show Apply in transferring mode, not just Silver/Gold. (2026-02-10) |
| Transfer Hub — React Hooks Fix | ✅ Built | Moved all useState/useEffect/useMemo/useCallback/useRef hooks before conditional early return to comply with React Rules of Hooks. Prevents crash on login state change. (2026-02-10) |
| Transfer Hub — Match Score Sort | ✅ Built | Added `case 'match'` to sort switch. Lightweight `calculateMatchScoreForSort` function avoids details array allocation. (2026-02-10) |
| Transfer Hub — Browse Filters | ✅ Built | TC level, power, and language filters in Recruiter Dashboard Browse tab. Client-side filtering with count display and clear button. (2026-02-10) |
| Transfer Hub — Profile Comparison | ✅ Built | Compare up to 4 transferee profiles side-by-side. Checkbox selection on each card, comparison modal with table view (TC, power, language, KvK availability, saving status, group size, looking for). (2026-02-10) |
| Transfer Hub — Code Review Fixes | ✅ Built | 8 bugs fixed: real-time subscription filter, LANGUAGE_OPTIONS sync, invite notification type, falsy kingdom check, expired invite filtering. (2026-02-10) |
| Transfer Hub — How It Works Guide | ✅ Built | Collapsible `TransferHubGuide.tsx` panel between hero and mode toggle. Two-tab layout (Transferring/Recruiting) with 4-step flows, quick tips, localStorage persistence. Auto-expanded for first-timers, dismissable with "Got it" button, re-openable anytime. Atlas brand voice copy. (2026-02-10) |
| Transfer Hub — Match Score SmartTooltip | ✅ Built | Replaced native `title` on match % badge with SmartTooltip showing full breakdown: each criteria (power, TC, language, vibe) with ✅/❌ and detail. Color-coded by score range. (2026-02-10) |
| Transfer Hub — Empty State (Applications) | ✅ Built | MyApplicationsTracker shows "No applications yet — browse kingdoms below" card instead of returning null. (2026-02-10) |
| Transfer Hub — Fund Tier Badge | ✅ Built | Visible Bronze/Silver/Gold badge next to kingdom name on listing cards. SmartTooltip explains all fund tiers, costs, and features. Only shown for funded kingdoms. (2026-02-10) |
| Transfer Hub — Guide Analytics | ✅ Built | `trackFeature` calls for "Transfer Guide Tab Switch" (with tab name) and "Transfer Guide Dismissed". (2026-02-10) |
| Transfer Hub — Stats Banner | ✅ Built | Live stats row (Kingdoms · Recruiting · Transferees) between guide and mode toggle. Transferee count from lightweight Supabase count query on active visible profiles. (2026-02-10) |
| Transfer Hub — About Page FAQ | ✅ Built | Added "What is the Transfer Hub?" to `ABOUT_FAQ_DATA` structured data for SEO. About page already had Transfer Hub feature section. (2026-02-10) |
| Transfer Hub — Discord Announcement | ✅ Draft | `docs/TRANSFER_HUB_DISCORD_ANNOUNCEMENT.md` with main announcement, embed format, and Day 2/3 follow-ups. Not sent yet. (2026-02-10) |
| Transfer Hub — Structured Coordinates | ✅ Built | Replaced single freeform contact_coordinates input with 3 structured fields: Kingdom (pre-filled from linked account, read-only), X (0-1199), Y (0-1199). Storage format `K:231 X:765 Y:722`. DB CHECK constraint on both `transfer_profiles.contact_coordinates` and `profiles.coordinates`. RecruiterDashboard parses and formats nicely. (2026-02-10) |
| Public Profile — In-Game Coordinates | ✅ Built | Optional toggable "Show In-Game Coordinates" on user profile. Same Kingdom/X/Y format as transfer profile. Kingdom pre-filled from linked account. Default hidden. Displayed on public profile view with monospace formatting when enabled. DB columns: `profiles.show_coordinates` (bool), `profiles.coordinates` (text). (2026-02-10) |
| Homepage — Hero Quote Marks Removed | ✅ Built | Removed `"` marks from homepage subtitle text under KINGSHOT ATLAS title. (2026-02-10) |
| Transfer Profile — Looking For 4 Chips | ✅ Built | Increased "What I'm looking for" chip selection limit from 3 to 4. Updated logic and label. (2026-02-10) |
| Transfer Profile — Preview Mode | ✅ Built | Live preview card in TransferProfileForm modal showing exactly how recruiters see the profile: username/anon toggle, TC badge, power badge, language, KvK, group size, looking-for tags, bio. Toggle button in action bar. (2026-02-10) |
| Transfer Profile — Readiness Score | ✅ Built | `TransferReadinessScore` component on Profile page. Fetches active transfer profile, calculates 10-field completeness %. Progress bar + incomplete-only checklist. CTA to create profile if none exists. Auto-hides at 100%. (2026-02-10) |
| Transfer Profile — Share to Discord | ✅ Built | "🔗 Share" button in TransferProfileForm (existing profiles only). Generates Discord-formatted text (bold name, stats, tags, bio, Transfer Hub link). Copies to clipboard with toast. (2026-02-10) |
| Homepage — Mobile Hero Line Break | ✅ Built | "Dominate Kingshot." always on its own line via `<br />` instead of space on mobile. (2026-02-10) |
| Transfer Hub — Analytics Tracking | ✅ Built | `trackFeature` calls for Preview toggle, Share click, Readiness Score CTA (create/edit), and full funnel: Profile Created → Application Sent → Application Accepted. (2026-02-10) |
| Transfer Hub — Completeness Nudge Banner | ✅ Built | Enhanced Transfer Profile CTA on Transfer Hub page shows X% badge, progress bar, and "Complete Profile" button when profile is incomplete. Calculates 10-field completeness. (2026-02-10) |
| Transfer Hub — Recommended Kingdoms | ✅ Built | "🎯 Top Matches For You" section showing top 3 kingdoms by Match Score (≥50%) above the filter panel in transferring mode. Memoized computation. (2026-02-10) |
| Transfer Profile — Last Active Timestamp | ✅ Built | `last_active_at` column on `transfer_profiles`. Updated on profile save and Transfer Hub visits (debounced 1hr). Displayed as 🟢/⚪ freshness indicator on transferee cards in Recruiter Dashboard. (2026-02-10) |
| Transfer Profile — Auto-Deactivation | ✅ Built | `deactivate-stale-profiles` edge function deactivates profiles inactive >30 days and sends notification. Profile reactivates on next edit. (2026-02-10) |
| Transfer Hub — Bug Fixes | ✅ Built | Fixed: application expiry text (14d→72h), profile reactivation on edit, missing `last_active_at` in recruiter queries. (2026-02-10) |
| Transfer Hub — Analysis Report | ✅ Built | Comprehensive report at `docs/TRANSFER_HUB_ANALYSIS.md`: 4 bugs, 5 UX issues, 3 perf concerns, 14 prioritized recommendations. (2026-02-10) |
| Transfer Application — Applicant Note | ✅ Built | Optional 300-char note field in ApplyModal. "Why are you interested?" textarea with char counter. Stored as `applicant_note` on `transfer_applications`. Displayed as 📝 Applicant Note card in RecruiterDashboard expanded view. (2026-02-10) |
| Transfer Application — Accepted Next Steps | ✅ Built | Accepted applications stay in active section (not collapsed past). Shows 🎉 Next Steps block with recruiter Discord usernames fetched from `kingdom_editors` → `profiles`. Fallback links to kingdom page. Withdraw button hidden for accepted apps. (2026-02-10) |
| Transfer Application — Per-Kingdom Cooldown | ✅ Built | 24-hour cooldown after withdrawing an application to the same kingdom. Prevents spam re-applications. Server-side check via `transfer_applications` query for recent withdrawn apps. (2026-02-10) |
| Transfer Hub — Slot Count Indicator | ✅ Built | Shows "📋 2/3 application slots used" or "3/3 — withdraw one to apply again" badge on Transfer Hub CTA banner when user has 2+ active apps. Color-coded amber/red. (2026-02-10) |
| Transfer Hub — Match Score Fallback | ✅ Built | When kingdoms have no explicit min requirements (power/TC), Match Score now uses fallback heuristic: language match + vibe overlap + recruiting status. Applied to both `calculateMatchScore` (with details) and `calculateMatchScoreForSort`. Previously showed 0% for all unfunded/unconfigured kingdoms. (2026-02-10) |
| Transfer Hub — Treasury Fund Priority | ✅ Built | Within same fund tier, kingdoms with higher fund balance sort higher before Atlas Score tiebreaker. Rewards contributors who invest more in their kingdom's listing visibility. (2026-02-11) |
| Editor Transfer Status Control | ✅ Built | Active editors and co-editors can change their kingdom's Transfer Status (Unannounced/Ordinary/Leading) without admin approval. Auto-approved via `isKingdomEditor` check in KingdomProfile.tsx. DB trigger syncs to `kingdoms.most_recent_status`. (2026-02-11) |
| Editor Status Indicator | ✅ Built | "You can update this" pencil icon + text next to Transfer Status badge on Kingdom Profile. Shown only to active editors/co-editors. Clicks open status modal. (2026-02-11) |
| Transfer Status Audit Trail | ✅ Built | Status change history section in Recruiter Dashboard Profile tab. Shows old→new status, submitter name, date, approval status (✓/⏳/✕). Lazy-loaded on tab switch. Last 15 entries. (2026-02-11) |
| Transfer Hub — Tier Badge Removal | ✅ Built | Removed S/A/B/C/D tier badges from KingdomListingCard in Transfer Hub. Score still shown in details section. Cleaned up unused SCORE_TIER_COLORS constant. (2026-02-17) |
| Transfer Hub — Persistent Read Tracking | ✅ Built | `message_read_status` table (application_id, user_id, last_read_at) with RLS. Replaced 48h heuristic unread counts with accurate per-application tracking. ApplicationCard upserts read status on message panel open. Both recruiter and transferee dashboards use persistent tracking. (2026-02-17) |
| Transfer Hub — Application Expiry Auto-Cleanup | ✅ Built | `expire_overdue_transfers()` function runs hourly via pg_cron. Auto-expires overdue applications and invites. `get_expiring_soon()` RPC returns items expiring within 24h. TransfereeDashboard shows ⏰ expiry warning banner with per-item countdown. `expiry_warnings_sent` table prevents duplicate notifications. (2026-02-17) |
| Transfer Hub — Transferee Messaging | ✅ Built | Full message thread UI in TransfereeDashboard application cards. Real-time Supabase subscription on `application_messages`. Send/receive with chat bubbles, auto-scroll, mark-as-read on open. Available on both pending and accepted applications. (2026-02-17) |
| Transfer Hub — Smart Invite Recommendations | ✅ Built | "✨ Recommended for You" horizontal scroll section at top of Browse Transferees. Reverse match scoring (power 30%, TC 25%, language 25%, vibe 20%) against fund requirements. Shows top 8 matches ≥50% score with quick invite button. (2026-02-17) |
| Transfer Hub — Transfer Outcome Tracking | ✅ Built | `transfer_outcomes` table with RLS. Accepted application cards show "📋 Did you transfer?" prompt with Yes/No buttons. Tracks did_transfer, satisfaction_rating, feedback. "✓ Outcome submitted" badge after submission. Fetched on load to prevent re-prompting. (2026-02-17) |
| Transfer Hub — Recruiter Outcome Tracking | ✅ Built | Recruiter-side outcome tracking in ApplicationCard.tsx for accepted applications. Same UX as transferee side — "📋 Did they transfer?" prompt, Yes/No buttons, submitted badge. Upserts to `transfer_outcomes` with `confirmed_role: 'recruiter'`. Checks existing outcome on mount to prevent re-prompting. (2026-02-17) |
| Transfer Hub — Admin Outcomes Dashboard | ✅ Built | New "Outcomes" sub-tab under Admin → Transfers. Stats cards (total, transferred, not transferred, success rate, avg satisfaction). Per-kingdom success rate breakdown with progress bars. Recent outcomes table with player, kingdom, role badge, status, rating, date. `TransferOutcomesTab.tsx` component. (2026-02-17) |
| Transfer Hub — Component Extraction | ✅ Built | Extracted `RecommendedSection` from `BrowseTransfereesTab.tsx` (scoring logic + recommendation UI) and `TransfereeAppCard` from `TransfereeDashboard.tsx` (messaging, outcome, withdraw UI). Reduces parent component complexity by ~200 lines each. Self-contained real-time subscriptions and state management. (2026-02-17) |
| Transfer Hub — Per-App Unread Indicators | ✅ Built | Red badge with unread count on each ApplicationCard's Messages button. `perAppUnreadCounts` map computed in `useRecruiterDashboard.ts` alongside total unread count. Flows through `InboxTab` → `ApplicationCard`. Badge hidden when messages panel is open. (2026-02-17) |
| Transfer Hub — Message Notifications | ✅ Built | DB trigger `notify_on_new_message` on `application_messages` inserts into `notifications` table. Applicant messages → notify kingdom editors; recruiter messages → notify applicant. `new_message` notification type with 💬 icon (blue). NotificationBell links to `/messages?app=ID` for direct thread open. Transferee side now has per-app unread badges matching recruiter side. (2026-02-21) |
| Dedicated Messages Page | ✅ Built | `/messages` route aggregates all recruiter + transferee conversations. Mobile-first split-pane UI (list/chat). Conversation list shows role badges, unread counts, last message preview, relative timestamps. Full chat with real-time Supabase subscription, auto-scroll, mark-as-read. URL param `?app=ID` auto-opens specific conversation. "Mark all read" bulk action. 2s rate limiting on sends. Translation support for non-English users. (2026-02-21) |
| Message Sound Notifications | ✅ Built | `/sounds/message.wav` notification beep plays on real-time message receive in Messages page, ApplicationCard, and TransfereeAppCard. Generated two-tone 880Hz+1320Hz fade-out beep. Silent catch for autoplay restrictions. (2026-02-21) |
| Last Message Preview on Cards | ✅ Built | Collapsed ApplicationCard and TransfereeAppCard show 💬 last message preview (truncated 60 chars) with timestamp. `perAppLastMessages` fetched in useRecruiterDashboard and TransfereeDashboard, passed through InboxTab. Updates in real-time via Supabase subscriptions. (2026-02-21) |
| Real-Time Unread Count Refresh | ✅ Built | TransfereeDashboard subscribes to `application_messages` INSERT events per active app. Increments `perAppUnread` and `unreadMsgCount` live without page reload. Also updates last message preview. Recruiter side uses React Query refetch on team/app changes. (2026-02-21) |
| Message Rate Limiting | ✅ Built | 2-second cooldown on message sending in ApplicationCard, TransfereeAppCard, and Messages page. Uses `useRef` timestamp comparison. Prevents spam without server-side enforcement. (2026-02-21) |
| Message Notification Preferences | ✅ Built | `message_notifications` boolean added to `NotificationPreferences` interface. 💬 "Messages" toggle in NotificationPreferences component. Default: enabled. Persisted in `user_data.settings.notification_preferences`. (2026-02-21) |
| Header Messages Navigation | ✅ Built | "Messages" button in desktop UserMenu dropdown (below My Profile, blue 💬 icon) and mobile MobileMenu (between profile and Home). `useUnreadMessages` hook fetches total unread count across all apps (recruiter + transferee). Real-time Supabase subscriptions for new messages and read status. Unread badge on desktop profile button and mobile hamburger (hides when menu open, transfers to Messages button). Badge caps at "99+". (2026-02-23) |
| Typing Indicator | ✅ Built | Real-time typing indicator via Supabase broadcast channels (ephemeral, no DB table). Animated "typing..." bubble with 3 bouncing dots appears when other party is composing. 2s throttle on outgoing broadcasts, 3s timeout to auto-hide. CSS keyframes animation (`typingDot`). (2026-02-23) |
| Read Receipts | ✅ Built | Sent messages show ✓ (delivered) or ✓✓ (read, blue) based on other party's `message_read_status.last_read_at`. Real-time Supabase subscription updates read status live when the other party opens the conversation. (2026-02-23) |
| Conversation Search | ✅ Built | Sticky search bar above conversation list on Messages page. Filters conversations by other party name, kingdom number (K###), or last message content. "No conversations found" empty state for zero-result searches. (2026-02-23) |
| Messages Page Launch Notification | ✅ Sent | System announcement notification sent to all 2,044 users about the new Messages page. Type: `system_announcement`, links to `/messages`. Users see it in NotificationBell with 📢 icon. (2026-02-23) |
| Gift Code Redeemer | ✅ Live | One-click gift code redemption at `/tools/gift-codes`. Backend proxies to Century Games API via `POST /api/v1/player-link/redeem` (10/min rate limit). Auto-fetches active codes from kingshot.net (15min cache). Bulk "Redeem All" with 1.5s delay. Manual code entry. "Copy All Codes" clipboard button. Requires linked Kingshot account. Error mapping for all known response codes. Direct kingshot.net fallback when backend unavailable. (2026-02-12) |
| Discord `/codes` Command | ✅ Live | `/codes` slash command shows active gift codes with copy-friendly formatting, code age indicators, copy-all block, redeem links (web + in-game), and "Redeem on Atlas" link button. Added to help embed and presence rotation. (2026-02-12) |
| Discord `/redeem` Command | ✅ Live | `/redeem [code]` slash command. Autocomplete dropdown shows all active codes + "All" option. Links Discord→Atlas profile→Kingshot ID. Sequential redemption with progress embed. 30s cooldown. Usage tracking via syncToApi. Last redeemed timestamp in footer. (2026-02-12) |
| Gift Codes Auto-Post | ✅ Live | Scheduler polls backend API every 30 min (auto-syncs kingshot.net→Supabase). Seeds known codes on first run (no restart spam). Posts new codes to `#giftcodes` channel (ID: 1471516156639576177) via bot client with @Giftcodes role mention (ID: 1471516628125749319). Atlas personality copy with `/redeem` and website links. Webhook fallback. Auto-prunes expired codes. (2026-02-12) |
| Gift Codes Supabase Table | ✅ Live | `gift_codes` table: code (unique), rewards, source (manual/kingshot.net/discord), is_active, expire_date, added_by. RLS: public SELECT, authenticated write. Auto-deactivate trigger for expired codes. `deactivate_expired_gift_codes()` standalone function. Backend merges DB + kingshot.net on GET. Admin endpoints: POST /gift-codes/add, POST /gift-codes/deactivate. (2026-02-12) |
| Gift Code Admin Dashboard | ✅ Live | GiftCodeAnalyticsTab enhanced: "Manage Codes" section (add new codes with auto-uppercase + upsert, view all codes with source badges, activate/deactivate toggle) + "Analytics" section (redemption stats, daily chart, top codes, recent redemptions). (2026-02-12) |
| Redemption Analytics | ✅ Live | `gift_code_redemptions` Supabase table tracks every redemption attempt (player_id, code, success, error_code, message, user_id, ip_address). RLS enabled. Indexed on user_id, code, created_at. Backend logs via fire-and-forget `log_gift_code_redemption()`. (2026-02-12) |
| Alt Accounts Cloud Sync | ✅ Built | Alt accounts now stored in `profiles.alt_accounts` JSONB column (Supabase source of truth). On page load: fetches from Supabase, merges lastRedeemed from localStorage. One-time migration: pushes localStorage alts to cloud if cloud is empty. On save: writes to both localStorage (cache) and Supabase. Enables Discord bot access to alt accounts. (2026-02-12) |
| Discord `/redeem-all` Command | ✅ Built | `/redeem-all [code]` Supporter-only slash command. Redeems codes for main account + all alt accounts from Supabase `profiles.alt_accounts`. Progress embed updates every 3 ops. Per-account results with success/fail counts. 60s cooldown. Truncates to short summary if embed exceeds 4000 chars. Free users see upgrade prompt to ks-atlas.com/support. (2026-02-12) |
| Upgrade CTA Tracking | ✅ Built | `analyticsService.trackFeatureUse('Alt Panel Upgrade CTA')` fires when free users click "Upgrade" link in the alt panel supporter teaser. Enables conversion tracking from alt panel to /support page. (2026-02-12) |
| Transfer Hub — Shareable Listing URLs | ✅ Built | `?kingdom=N` URL param scrolls to & highlights kingdom card with cyan glow. Entry modal skipped. Dynamic OG meta tags (title, description, URL). Share + Discord buttons on every listing card. `generateTransferListingDiscordMessage` in sharing.ts. (2026-02-10) |
| Transfer Hub — Shared Link CTA | ✅ Built | Unauthenticated users landing via `?kingdom=N` see "Interested in Kingdom N? Sign Up to Apply" banner with auth link. (2026-02-10) |
| Transfer Hub — Recruiting Toast | ✅ Built | Landing on a recruiting kingdom via shared link shows "Kingdom N is actively recruiting!" info toast. (2026-02-10) |
| Transfer Hub — Conversion Funnel | ✅ Built | Tracks `Transfer Listing Shared Link` (kingdom, authenticated), `Transfer Apply Click` with `source: shared_link` when applying to the highlighted kingdom. (2026-02-10) |
| Transfer Hub — Copy Listing Link (Recruiter) | ✅ Built | "🔗 Copy Listing Link" button in RecruiterDashboard fund section alongside existing contribution link. Copies `?kingdom=N` URL. (2026-02-10) |
| Transfer Hub — Discord Share Button | ✅ Built | Discord-branded button on KingdomListingCard copies formatted message with kingdom number, tier, score, recruiting status, language, fund tier. (2026-02-10) |
| Transfer Hub — Transfer Listing Card (OG) | ✅ Built | `generateTransferListingCard` in sharing.ts creates 600×315 canvas PNG with kingdom number, tier, recruiting badge, score, language, fund tier, CTA. (2026-02-10) |
| Kingdom Profile — View Transfer Listing | ✅ Built | "View Transfer Listing" link moved next to Transfer Status in KingdomHeader Row 4. Compact pill style matching status badge height. Desktop+mobile optimized. (2026-02-10) |
| Transfer Hub — Sticky Search/Filter | ✅ Live | FilterPanel uses `position: sticky; top: 0; z-index: 50` with dark background. Stays visible during scroll for quick access. Mobile edge-to-edge padding. (2026-02-10) |
| Transfer Hub — Layout Reorder | ✅ Live | Mode toggle (Transferring/Recruiting/Browsing) moved right below How It Works guide. Transfer countdown removed from hero section. (2026-02-10) |
| Transfer Hub — Referral Tracking | ✅ Live | All shared listing links (Share, Discord, Copy Listing Link in RecruiterDashboard) append `?ref=<linked_username>` for referral-eligible users. Landing tracked via `Transfer Hub Referral Landing` analytics event. Uses existing `isReferralEligible` from constants. (2026-02-10) |
| Transfer Hub — Copy as Image | ✅ Live | "Image" button on KingdomListingCard generates 600×315 PNG via `generateTransferListingCard`, copies to clipboard (desktop) or uses Web Share API (mobile), falls back to download. (2026-02-10) |
| Transfer Hub — CTA Animation | ✅ Live | Unauthenticated CTA banner on shared listing landing uses `fadeSlideUp` CSS keyframe animation (0.5s ease-out). (2026-02-10) |
| Transfer Hub — Premium Tier Visual Polish | ✅ Live | Gold/Silver/Bronze inner gradient overlay (subtle tier-tinted highlight at card top), enhanced hover glow (Gold 3-layer 80px, Silver 3-layer 72px), tier badge micro-animations (Gold 3s, Silver 4s, Bronze 5s glow pulse), enhanced tooltip with cumulative tier comparison. STYLE_GUIDE.md updated with Kingdom Fund Tier Borders SOURCE OF TRUTH. (2026-02-10) |
| Transfer Hub — Why Fund? Banner | ✅ Live | Standard tier cards show subtle upgrade nudge above footer: "✨ Funded listings get shimmer borders, glow effects & more visibility". Non-intrusive, informational. Gold/silver highlighted keywords. (2026-02-10) |
| i18n — German (de) Translation | ✅ Live | Full German translation (1584 lines). Proper German gaming terminology. Registered in i18n config, language switcher (🇩🇪 Deutsch), and all locale files updated with `"de": "Deutsch"`. Supported languages: en, es, fr, zh, de. (2026-02-12) |
| i18n — Korean (ko) Translation | ✅ Live | Full Korean translation (1606 lines, 1442 keys). Natural Korean phrasing with proper gaming terminology. Registered in i18n config, language switcher (🇰🇷 한국어). i18n-diff script and /i18n-translate workflow updated. Supported languages: en, es, fr, zh, de, ko. (2026-02-11) |
| i18n — Japanese (ja) Translation | ✅ Live | Full Japanese translation (1620 lines, 1453 keys). Natural Japanese phrasing with game terms kept in English (KvK, Prep, Battle). Registered in i18n config, language switcher (🇯🇵 日本語). i18n-diff script and /i18n-translate workflow updated. Supported languages: en, es, fr, zh, de, ko, ja. (2026-02-12) |
| Homepage Quick Menu Enhancement | ✅ Live | QuickActions.tsx rewritten: 6 buttons (Transfer Hub, KvK Battle Planner, Discord Bot Atlas, Gift Code Redeemer, Kingdom Rankings, KvK Seasons). New layout: icon left-oriented + vertically centered, 2-line text labels for i18n. 3-col mobile / 6-col desktop grid. New SVG icons for Battle Planner (red) and Gift Code (yellow). Translation keys added for all 9 languages. (2026-02-13) |
| Gift Code Landing Page | ✅ Live | Marketing landing page at `/gift-codes` (GiftCodeLanding.tsx). Atlas personality copy. Hero + How It Works (3 steps) + 6 feature cards + Free vs Supporter comparison table + problem/solution narrative + Supporter CTA. Links to functional tool at `/tools/gift-codes`. Full i18n support. (2026-02-13) |
| Atlas Bot `/link` Command Listed | ✅ Live | `/link` command added to AtlasBot.tsx commands list with description and green accent. Connects Discord account to Atlas profile for Settler role, /redeem, and synced alt accounts. (2026-02-13) |
| Discord `/link` Command | ✅ Built | `/link` slash command registered in index.js, handler in handlers.js, wired in bot.js, added to /help embed. 3-state flow: already linked (shows status), partially linked (guides to profile), not linked (full onboarding with Sign In button). Ephemeral replies. Usage tracked via syncToApi. (2026-02-12) |
| Gift Code Redeemer Navigation Update | ✅ Live | Header dropdown (desktop + mobile) and /tools page Gift Code card now link to `/gift-codes` landing page instead of `/tools/gift-codes` tool. /tools card CTA changed to "Learn More". Drives awareness of landing page before tool. (2026-02-12) |
| Brand Rename: Discord Bot Atlas | ✅ Live | "Atlas Discord Bot" renamed to "Discord Bot Atlas" across: Header dropdown, /tools page, QuickActions homepage, AtlasBot.tsx page title area, and all 18 translation files (9 languages × src + public). tools.botTitle fallback updated. (2026-02-12) |
| Multirally 5 Free Uses/Day | ✅ Live | `MULTIRALLY_DAILY_LIMIT` increased from 3 to 5 in `handlers.js`. AtlasBot.tsx and all 18 translation files (src + public × 9 languages) updated. More generous free tier to drive adoption before Supporter upsell. (2026-02-13) |
| i18n — quickAction Keys (8 langs) | ✅ Live | quickAction.* translation keys (12 keys: transferHub, battlePlanner, atlasBot, giftCode, rankings, kvkSeasons × line1/line2) added to ES, FR, ZH, DE, KO, JA, AR, TR. Synced src→public via i18n:sync. (2026-02-12) |
| Component Refactoring Phase 3 | ✅ Done | Product | RecruiterDashboard.tsx 1761→765 lines (extracted ApplicationCard, CoEditorsTab, FundTab; removed duplicate types). RallyCoordinator.tsx 1072→997 lines (extracted QueueDropZone). Header.tsx already 346 lines from prior refactoring. New files: `recruiter/ApplicationCard.tsx`, `recruiter/CoEditorsTab.tsx`, `recruiter/FundTab.tsx`, `rally/QueueDropZone.tsx`. Zero regressions — vite build clean. (2026-02-16) |
| Multi-Kingdom Share/Export | 🚧 Planned | ShareButton still uses 2-kingdom format |

---

## Proposed Nudges (Awaiting Approval)

| Nudge Idea | Description | Where | Effort | Impact |
|------------|-------------|-------|--------|--------|
| Linked User Flair | Subtle glow/border on comments and reviews from linked users, making their contributions visually distinct. Encourages linking for social proof. | KingdomReviews, UserDirectory | Low | Medium |
| Contributor Badge | Auto-awarded badge on Profile for users who submit 3+ verified KvK results. Shows "Verified Contributor" tag next to username. Requires linked account to submit, so it naturally encourages linking. | Profile, KingdomPlayers, UserDirectory | Medium | High |
| Kingdom Rivals | "Your kingdom has faced K-XXX 3 times" contextual card on Kingdom Profile when viewing a kingdom your linked kingdom has fought. Personalized data drives curiosity and linking. | KingdomProfile | Medium | High |
| ~~Score Change Notification Hook~~ | **IMPLEMENTED** — see Score Change Hook above | — | — | — |
| ~~Match Score Teaser (Transfer Hub)~~ | **IMPLEMENTED** — see Match Score Teaser above | — | — | — |
| ~~RIVAL Badge~~ | **IMPLEMENTED** — see RIVAL Badge above | — | — | — |
| Personalized Insights Panel | "You vs K-XXX" mini comparison card on Kingdom Profile for linked users viewing a rival kingdom. Shows head-to-head prep/battle record at a glance. | KingdomProfile | Medium | High |
| ~~Return Visit Delta~~ | **IMPLEMENTED** — localStorage-based score tracking, dismissible banner on KingdomProfile showing score delta since last visit for ALL users (2026-02-08) | — | — | — |
| Watchlist Score Alerts | Toast notification on login if any favorited kingdom's score changed since last session. "K-1234 moved up 3 ranks!" Encourages daily engagement. | Global (on auth) | Medium | High |
| Transfer Readiness Score | On user's profile, show a "Transfer Readiness" percentage based on how complete their transfer profile is. Incomplete fields show blurred potential score. | Profile | Low | Medium |

### Recently Shipped

| Feature | Status | Details |
|---------|--------|---------|
| Page Analytics v2 — Chart Consolidation | ✅ Live | Unified unique visitors chart with tab selector (Today/Last 24h/7 Days/30 Days/Custom). Hourly charts for Today/24h, daily charts for 7d/30d/Custom. Replaced 3 separate charts with single adaptive view. Centered stat box text. (2026-03-22) |
| Page Analytics v2 — New vs Returning Visitors | ✅ Live | Split bar showing first-time vs returning visitors for selected period. Supabase RPC `get_new_vs_returning_visitors` with admin-only access. Color-coded counts + percentages. (2026-03-22) |
| Page Analytics v2 — Peak Hours Heatmap | ✅ Live | 7×24 grid (day of week × hour) showing traffic intensity. Supabase RPC `get_peak_hours_heatmap`. Horizontal scroll on mobile. Color legend. (2026-03-22) |
| Page Analytics v2 — User Journey Funnel | ✅ Live | 4-step conversion funnel: All Visitors → Browsed Kingdoms → Visited Profile → Used Tools. Supabase RPC `get_visitor_journey_funnel`. Drop-off percentages between steps. (2026-03-22) |

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Live | Deployed and working in production |
| 🚧 Planned | Approved, not yet built |
| 🔨 In Progress | Currently being developed |
| ⏸️ Paused | Started but blocked/deferred |
| ❌ Rejected | Considered and declined |

---

*Update this file after every feature completion. Check before every feature start.*
