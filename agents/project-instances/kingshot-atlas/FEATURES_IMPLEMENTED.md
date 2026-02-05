# Features Implemented

**Last Updated:** 2026-01-31  
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
| Tools | `/tools` | ✅ Live | Product | Score simulator, event calendar |
| Leaderboards | `/leaderboards` | ✅ Live | Product | Multi-category rankings |
| User Profile | `/profile` | ✅ Live | Product | User settings, linked accounts, achievements |
| Public Profiles | `/profile/:userId` | ✅ Live | Product | View other users' profiles |
| Player Directory | `/players` | ✅ Live | Product | Browse Atlas users |
| About Page | `/about` | ✅ Live | Design | Mission, FAQ, team info |
| Admin Dashboard | `/admin` | ✅ Live | Platform | Data management, submissions review |
| Support Atlas | `/support`, `/upgrade`, `/pro` | ✅ Live | Business | Community support page (formerly Upgrade) |
| Changelog | `/changelog` | ✅ Live | Release | Version history and updates |

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
| Linked Account Card Redesign | ✅ Live | Product | Table layout with tier-based username colors (2026-01-31) |
| Public Profile Tier Coloring | ✅ Live | Product | Tier-colored usernames on public profiles (2026-01-31) |
| Kingdom Players Section | ✅ Live | Product | `KingdomPlayers.tsx` - Atlas users from kingdom on profile page (2026-01-31) |
| User Directory Enhancement | ✅ Live | Product | Shows only linked Kingshot accounts with tier coloring, Kingdom, TC Level (2026-01-31) |
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
| KvK Data Migration | ✅ Live | Platform | 5042/5042 records in Supabase (100% parity) + indexes + RLS |
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
| Kingdom Ranking History | ✅ Live | Product | Collapsible chart showing rank over time from score_history, purple color scheme, inverted Y-axis (2026-02-05) |

---

## Premium Features

| Feature | Status | Agent | Notes |
|---------|--------|-------|-------|
| Premium Context | ✅ Live | Platform | `PremiumContext.tsx` subscription state + refreshSubscription() |
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
| Netlify Deployment | ✅ Live | Ops | Auto-deploy from main |
| Custom Domain | ✅ Live | Ops | ks-atlas.com |
| React Query Caching | ✅ Live | Product | `queryClient.ts` |
| IndexedDB Cache | ✅ Live | Product | `indexedDBCache.ts` offline support |
| Code Splitting | ✅ Live | Product | Lazy-loaded routes |
| Analytics | ✅ Live | Ops | `analyticsService.ts`, Plausible |

---

## Discord Bot

| Feature | Status | Date | Agent | Notes |
|---------|--------|------|-------|-------|
| Bot Infrastructure | ✅ Live | 2026-01 | Platform | `/apps/discord-bot/` |
| Webhook Integration | ✅ Live | 2026-01 | Platform | Patch notes posting |
| Public Bot Invite | ✅ Live | 2026-02-02 | Platform | Invite link on About page |
| Bot Admin Dashboard | ✅ Live | 2026-02-02 | Platform | `BotDashboard.tsx` in Admin panel |
| Bot API Endpoints | ✅ Live | 2026-02-02 | Platform | `/api/v1/bot/*` - status, servers, send-message |
| Server Browser | ✅ Live | 2026-02-02 | Platform | View/manage connected Discord servers |
| Message Sender | ✅ Live | 2026-02-02 | Platform | Send messages/embeds to any channel |
| Command Usage Logging | ✅ Live | 2026-02-02 | Platform | API sync for dashboard stats |
| Settler Role Auto-Assign | ✅ Live | 2026-02-04 | Platform | Auto-assigns "Settler" Discord role when user links Kingshot account |
| Settler Role Backfill | ✅ Live | 2026-02-04 | Platform | Admin endpoint to backfill Settler roles for existing linked users |
| Discord Roles Dashboard | ✅ Live | 2026-02-04 | Platform | Admin UI to view linked users and manage Discord role assignments |

---

## Agent System Infrastructure

| Feature | Status | Date | Agent | Notes |
|---------|--------|------|-------|-------|
| Agent Registry | ✅ Live | 2026-01-28 | Director | `/agents/AGENT_REGISTRY.md` |
| Vision Document | ✅ Live | 2026-01-29 | Director | `/docs/VISION.md` |
| Auto-Router Workflow | ✅ Live | 2026-01-29 | Director | `/.windsurf/workflows/work.md` |
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
| FilterPanel Integration | 🚧 Planned | Component exists, needs wiring to KingdomDirectory |
| Mobile Responsive Pass | 🚧 Planned | Some pages need work |
| Component Refactoring | 🚧 Planned | KingdomCard, ProfileFeatures too large |
| Multi-Kingdom Share/Export | 🚧 Planned | ShareButton still uses 2-kingdom format |

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
