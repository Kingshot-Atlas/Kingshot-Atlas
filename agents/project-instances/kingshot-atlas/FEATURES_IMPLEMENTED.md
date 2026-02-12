# Features Implemented

**Last Updated:** 2026-02-06  
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
| Transfer Board | `/transfer-board` | 🔨 In Progress | Product + Business | Kingdom listings, transfer profiles, applications. Coming Soon tag. (2026-02-06) |

---

## Core Features

| Feature | Status | Agent | Notes |
|---------|--------|-------|-------|
| Kingdom Search | ✅ Live | Product | `SearchAutocomplete.tsx` with instant results |
| Atlas Score System | ✅ Live | Product | Bayesian scoring with tier badges (S/A/B/C/D/F) |
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
| Auth Modal | ✅ Live | Product | `AuthModal.tsx` login/signup flow |
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
| Rally Coordinator | ✅ Live | Product | `RallyCoordinator.tsx` — Admin-only rally planner. Ally+enemy player database, march time management (regular/buffed per building), rally queue + counter-rally queue with drag-and-drop, simultaneous/chain hits modes, Gantt timelines, call order display. Enemy buff timer: 2hr countdown on toggle, localStorage persistence, auto-expire with sound+vibration+toast, confirmation popup on manual toggle-off, pulsing amber indicator on PlayerPill. (2026-02-11) |
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
| Supporter Badge | ✅ Live | Design | `ProBadge.tsx` visual indicator (renamed to Supporter) |
| Ad Banners | ✅ Live | Business | `AdBanner.tsx` for free tier |

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
| React Query Caching | ✅ Live | Product | `queryClient.ts` |
| IndexedDB Cache | ✅ Live | Product | `indexedDBCache.ts` offline support |
| Code Splitting | ✅ Live | Product | Lazy-loaded routes |
| i18n Optimization | ✅ Live | Product | Phase 1-6 complete. HTTP backend lazy loading (EN bundled, others on-demand). Centralized SUPPORTED_LANGUAGES + LANGUAGE_META (with RTL dir groundwork) in i18n.ts. 1442 keys across 5 languages (EN/ES/FR/ZH/DE), zero dead keys. Pluralization support (_one/_other). CI validation on every PR. Hardcoded string detector + translation diff script. I18N_GUIDE.md checklist. /i18n-translate workflow. Translated components: ProfileFeatures, SubmissionHistory, SideBySideAnalysis, AllianceScoring, KingdomLeaderboardPosition, MiniKingdomCard, RallyCoordinator, MissingDataRegistry, ReferralFunnel, ReferralIntelligence, ReportKvKErrorModal, KingdomFundContribute, ShareableCard, SupportButton, ClaimKingdom, RadarChart, ReportDataModal, UserAchievements, MetaAnalysis (87/149 public files = 58%). All user-facing public components translated; remaining 9 flagged files are admin-only or false positives. npm scripts: validate:i18n, i18n:sync, i18n:add, i18n:check, i18n:diff, i18n:snapshot. (2026-02-12) |
| Analytics | ✅ Live | Ops | `analyticsService.ts`, Plausible |
| Dynamic Meta Tags | ✅ Live | Ops | `useMetaTags.ts` - PAGE_META_TAGS for all pages with SEO keywords (2026-02-05) |
| Structured Data | ✅ Live | Ops | `useStructuredData.ts` - JSON-LD for FAQ, Breadcrumbs (2026-02-05) |
| Expanded Sitemap | ✅ Live | Ops | Dynamic sitemap.xml (all kingdoms + seasons + static pages) (2026-02-05) |
| SEO Schema Markup | ✅ Live | Ops | WebApplication, Organization, WebSite w/ SearchAction in index.html (2026-02-05) |
| SEO Keyword Optimization | ✅ Live | Ops | Title tags, meta descriptions optimized for 13 target keywords (rankings, transfer, scouting, recruiting, kvk history, best kingdom). All pages have useMetaTags + useStructuredData breadcrumbs (2026-02-10) |
| SEO Redirect Fixes | ✅ Live | Ops | 301 redirects for /leaderboards→/rankings, /transfer-board→/transfer-hub, /pro→/support, /upgrade→/support. Fixes GSC "Page with redirect" (2026-02-10) |
| SEO FAQ Rich Snippets | ✅ Live | Ops | About page: 12 FAQ items. Rankings page: 5 FAQ items targeting "best kingdoms", "S-tier", "kingdom rankings" featured snippets. Dual injection: client-side useStructuredData + middleware edge-side JSON-LD for bots (2026-02-12) |
| SEO Crawl Budget Optimization | ✅ Live | Ops | robots.txt disallows /admin, /auth, /profile, /components, legacy URLs (2026-02-10) |
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
| AtlasBot Page Copy Rewrite | ✅ Live | 2026-02-07 | Design | All 8 command descriptions rewritten with brand voice (competitive, analytical, direct). Feature cards and CTA updated. /help excluded from public listing |
| Premium Commands Section | ✅ Live | 2026-02-09 | Product | /multirally moved to dedicated "PREMIUM COMMANDS" section with full-width card, detailed how-it-works, 3-step flow, 3 free daily credits callout, Supporter CTA. "Free. Always." → "Free Core" |
| Multirally Credit Enforcement | ✅ Live | 2026-02-09 | Platform + Product | Persistent credit tracking via `multirally_usage` Supabase table. API: `/bot/multirally-credits/check`, `/increment`, `/multirally-stats`. Bot uses API-backed credits with in-memory fallback. BotDashboard: premium stats section (total/supporter/free uses, upsell impressions, conversion signal). Support page: "Unlimited Premium Bot Commands" perk added |
| Persistent Telemetry | ✅ Live | 2026-02-11 | Platform | `telemetry.js` logs 12 lifecycle events to Supabase `bot_telemetry` table via REST API. Memory monitoring (warn 200MB, critical 400MB). Fire-and-forget writes. Env vars set on Render. |
| Bot Observability Dashboard | ✅ Live | 2026-02-11 | Platform | `BotTelemetryTab` in Admin Dashboard (System > Bot Telemetry). Summary cards, severity bar, filterable event list, expandable metadata. API: `GET /api/v1/bot/telemetry`. Auto-refresh 60s. |
| Bot Telemetry Auto-Cleanup | ✅ Live | 2026-02-11 | Platform | pg_cron `bot-telemetry-cleanup` runs weekly Sunday 03:00 UTC, deletes rows >30 days old. |
| Bot Critical Event Alerts | ✅ Ready | 2026-02-11 | Platform | `notify_critical_bot_event()` trigger fires on error/critical INSERT to `bot_telemetry`. Posts Discord embed via pg_net. Webhook URL from vault secret `bot_alerts_discord_webhook`. |

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
| Stripe-Based Subscription Counts | ✅ Live | 2026-01-31 | Platform | Uses Stripe as source of truth for Pro/Recruiter counts |
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

---

## CI/CD Pipeline

| Feature | Status | Date | Agent | Notes |
|---------|--------|------|-------|-------|
| GitHub Actions CI | ✅ Live | 2026-01 | Ops | Lint, test, build pipeline |
| Playwright E2E Tests | ✅ Live | 2026-02-02 | Product | E2E tests in CI with artifact uploads |
| Lighthouse Audit | ✅ Live | 2026-01 | Ops | Performance monitoring |

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

## Planned / Not Yet Built

| Feature | Status | Notes |
|---------|--------|-------|
| Transfer Hub — Access Gate | ✅ Built | Owner-only access during pre-launch. Non-admin users see "Coming soon" page with back link. Rename from Transfer Board → Transfer Hub, URL /transfer-hub (2026-02-07) |
| Transfer Hub — Transfer Profile Form | ✅ Built | Player-created transfer cards with auto-fill from linked account, validation, Supabase upsert (2026-02-06) |
| Transfer Hub — Application System | ✅ Built | Apply modal with 3-slot visualization, MyApplicationsTracker, withdraw, status tracking (2026-02-06) |
| Transfer Hub — Recruiter Dashboard | ✅ Built | Full-screen modal: inbox with status actions, team view, fund overview, recruiting toggle. Profile tab with tier-gated editing for pitch, offer/want, min requirements, event times, languages, contact link, recruitment tags (2026-02-07) |
| Transfer Hub — Kingdom Fund (Stripe) | ✅ Built | Full pipeline: Stripe product/prices/payment links, KingdomFundContribute modal, webhook handler (credit_kingdom_fund), weekly depletion Edge Function cron, tier auto-upgrade, dedicated contribution success overlay (2026-02-07) |
| Transfer Hub — Editor Claiming | ✅ Built | Nominate form with TC20+ check, endorsement progress bar, share link, endorse button (2026-02-06) |
| Transfer Hub — Tier Info Display | ✅ Built | 4-tier breakdown (Standard/Bronze/Silver/Gold) with costs, features, and current tier highlight in Recruiter Dashboard Profile tab (2026-02-07) |
| Transfer Hub — Co-Editor Assignment | ✅ Built | Primary editors can invite co-editors by user ID with kingdom link validation, TC20+ check, duplicate detection, reactivation support (2026-02-07) |
| Transfer Hub — Application Auto-Expiry | ✅ Built | Edge Function `expire-transfer-applications` expires pending/viewed/interested apps past `expires_at`. Cron runs daily at 06:00 UTC via pg_cron (2026-02-07) |
| Transfer Hub — RLS Policies | ✅ Built | 3 new policies: editor UPDATE on kingdom_funds (profile editing), editor INSERT on kingdom_editors (co-editor invites), editor UPDATE on kingdom_editors (co-editor management). Full audit on all 6 tables (2026-02-07) |
| Transfer Hub — Editor Role Management | ✅ Built | Admin action buttons (Activate/Suspend/Remove) on editor & co-editor cards. Promote to Editor on co-editors. Bulk deactivate 30d+ inactive. Confirmation dialogs for destructive actions. Notifications on every status change. (2026-02-11) |
| Transfer Hub — Co-Editor Self-Nomination | ✅ Built | "Become a Co-Editor" CTA on EditorClaiming when kingdom has active editor. No endorsements required. Max 2 co-editors/kingdom enforced. Slot counter shown. Editor approval flow via notifications. TC20+ required. (2026-02-11) |
| Transfer Hub — Co-Editors Admin Tab | ✅ Built | Dedicated 🤝 Co-Editors sub-tab in Transfer Hub admin. No endorsement data shown. Purple badge (#a855f7). Separated from Editor Claims tab. (2026-02-11) |
| Transfer Hub — Editor Role Enhancements | ✅ Built | Approve/Reject buttons for pending co-editor requests in RecruiterDashboard. Pending count badge on Co-Editors tab. Co-editor request notification preference. "Managed by [editor]" on kingdom profile header. RLS for co-editor self-nomination. Rate limit (1/user/day). Admin audit log table. Auto-expire pending requests after 7 days (pg_cron). Removal cascade trigger. (2026-02-11) |
| Kingdom Ambassador Program | 🚧 Planned | Full spec at `/docs/KINGDOM_AMBASSADOR_PROGRAM.md` — 3-phase rollout, 1 per kingdom, referral tracking |
| FilterPanel Integration | 🚧 Planned | Component exists, needs wiring to KingdomDirectory |
| Mobile Responsive Pass | ✅ Live | 2026-02-05 - Touch targets fixed to 44px min on Header, KingdomProfile, CompareKingdoms, Leaderboards, KingdomCard, KingdomReviews, KvKHistoryTable, SupportAtlas, Profile |
| Transfer Hub Mobile UX Pass | ✅ Built | Bottom-sheet modals, 44px touch targets, iOS zoom prevention (16px inputs), 2-col grid on mobile, safe area insets across all Transfer Hub components (2026-02-07) |
| Transfer Hub — Infinite Scroll | ✅ Built | IntersectionObserver-based infinite scroll for standard listings, loading skeletons, spinner sentinel (2026-02-07) |
| Transfer Hub — Transfer Groups | ✅ Built | Configurable `TRANSFER_GROUPS` array with `TRANSFER_GROUPS_ACTIVE` flag. Filters kingdoms by user's linked kingdom group. Banner shows active group or prompts linking. Groups updated per event. Documented in TRANSFER_EVENT_MECHANICS.md (2026-02-09) |
| Transfer Hub — KingdomListingCard Redesign | ✅ Built | Transfer Status: gold/silver colors. Performance: centered title, cyan Atlas Score+Rank merged, gray-bordered stat boxes. Characteristics: Vibe tags, language pair, min power/TC, kingdom bio. Reviews moved to More Details. Alliance Event Times grid with UTC/Local toggle. NAP/Sanctuaries/Castle row in More Details. Fixed broken emoji (2026-02-09) |
| Transfer Hub — Browse Tab Invites | ✅ Built | Send Invite button on transferee cards. Duplicate check (pending invite query), recipient notification, budget enforcement, "✓ Invited" state tracking via `sentInviteIds`. Uses `transfer_invites` table (2026-02-09) |
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
| Gift Code Redeemer | ✅ Live | One-click gift code redemption at `/tools/gift-codes`. Backend proxies to Century Games API via `POST /api/v1/player-link/redeem` (10/min rate limit). Auto-fetches active codes from kingshot.net (15min cache). Bulk "Redeem All" with 1.5s delay. Manual code entry. "Copy All Codes" clipboard button. Requires linked Kingshot account. Error mapping for all known response codes. Direct kingshot.net fallback when backend unavailable. (2026-02-12) |
| Discord `/codes` Command | ✅ Live | `/codes` slash command shows active gift codes with copy-friendly formatting, code age indicators, copy-all block, redeem links (web + in-game), and "Redeem on Atlas" link button. Added to help embed and presence rotation. (2026-02-12) |
| Discord `/redeem` Command | ✅ Live | `/redeem [code]` slash command. Autocomplete dropdown shows all active codes + "All" option. Links Discord→Atlas profile→Kingshot ID. Sequential redemption with progress embed. 30s cooldown. Usage tracking via syncToApi. Last redeemed timestamp in footer. (2026-02-12) |
| Gift Codes Auto-Post | ✅ Live | Scheduler polls backend API every 30 min (auto-syncs kingshot.net→Supabase). Seeds known codes on first run (no restart spam). Posts new codes to `#giftcodes` channel (ID: 1471516156639576177) via bot client with @Giftcodes role mention (ID: 1471516628125749319). Atlas personality copy with `/redeem` and website links. Webhook fallback. Auto-prunes expired codes. (2026-02-12) |
| Gift Codes Supabase Table | ✅ Live | `gift_codes` table: code (unique), rewards, source (manual/kingshot.net/discord), is_active, expire_date, added_by. RLS: public SELECT, authenticated write. Auto-deactivate trigger for expired codes. `deactivate_expired_gift_codes()` standalone function. Backend merges DB + kingshot.net on GET. Admin endpoints: POST /gift-codes/add, POST /gift-codes/deactivate. (2026-02-12) |
| Gift Code Admin Dashboard | ✅ Live | GiftCodeAnalyticsTab enhanced: "Manage Codes" section (add new codes with auto-uppercase + upsert, view all codes with source badges, activate/deactivate toggle) + "Analytics" section (redemption stats, daily chart, top codes, recent redemptions). (2026-02-12) |
| Redemption Analytics | ✅ Live | `gift_code_redemptions` Supabase table tracks every redemption attempt (player_id, code, success, error_code, message, user_id, ip_address). RLS enabled. Indexed on user_id, code, created_at. Backend logs via fire-and-forget `log_gift_code_redemption()`. (2026-02-12) |
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
| Component Refactoring | 🚧 Planned | KingdomCard, ProfileFeatures too large |
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
