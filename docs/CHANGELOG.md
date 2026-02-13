# Changelog

All notable changes to Kingshot Atlas are documented here.
*Auto-generated from `src/data/changelog.json` — do not edit manually.*

---

## [2026-02-13] — v1.13.0

### ✨ New
- 💰 Annual Plan — $49.99/yr (~17% savings). Available on the /support page with monthly/yearly toggle.
- 🏠 Homepage Quick Menu — 6 action tiles: Transfer Hub, Battle Planner, Discord Bot, Gift Codes, Rankings, KvK Seasons
- 🎁 Gift Code Landing Page — Dedicated /gift-codes page explaining the feature with free vs Supporter comparison
- 🤖 Discord /multirally — Now 5 free uses per day (was 3). Unlimited for Supporters.

### 🔧 Improved
- 🎨 Visual consistency — Unified color token system (bronze, pink, amber) across all components
- 🛡️ CI quality gates — E2E tests and Lighthouse audits now block deploys on failure
- 📢 Deploy notifications — Discord webhook alerts when new versions ship to production
---

## [2026-02-12] — v1.12.0

### ✨ New
- 🎁 Gift Code Redeemer — One-click redemption for active codes right from Atlas
- 👥 Alt Account Support — Manage up to 10 alt accounts, bulk redeem for all at once
- 🤖 Discord /redeem-all — Supporter command: redeem all active codes for every linked account
- 🤖 Discord /codes — View active gift codes with copy-friendly formatting
- 🤖 Discord /link — Check your Atlas-Discord account link status

### 🐛 Fixed
- Co-editor invite loop — Multiple co-editors can now accept invites without breaking
- Gift code "NOT LOGIN" — Fixed Century Games API login prerequisite for redemptions
- Battle Planner gating — Supporters now get instant access (was requiring manual DB entry)

### 🔧 Improved
- ⚔️ Battle Planner readability — Larger fonts and better contrast on desktop
- 🤖 Discord Bot Atlas — Rebranded from "Atlas Discord Bot" across all surfaces
- 🔍 SEO: Edge-side meta injection — Every page now has unique title, description, and OG tags for link previews
- 🌍 hreflang tags — Search engines now know Atlas is available in 9 languages
---

## [2026-02-11] — v1.11.0

### ✨ New
- 🌍 9 languages — Added Korean 🇰🇷, Japanese 🇯🇵, Arabic 🇸🇦, and Turkish 🇹🇷
- ⚔️ KvK Battle Planner — Coordinate rallies with your alliance in real-time. Buff timers, call orders, Gantt timeline.
- 🤝 Co-Editor System — Self-nominate as co-editor for any kingdom with an active editor
- 📊 Transfer Readiness Score — See how complete your transfer profile is on your Profile page

### 🐛 Fixed
- OAuth sign-in stuck at loading — New dedicated callback page with timeout recovery
- Referral system — Referral count was stuck at 0 for all users (missing RLS policy)
- Referral links — Spaces in usernames no longer break Discord referral URLs
- Discord unlink button — Hidden for users who signed in via Discord OAuth (was a no-op)

### 🔧 Improved
- 🏰 Editor transfer status control — Editors can update kingdom status without admin approval
- 💰 Treasury fund priority — Kingdoms with higher fund balance rank higher within same tier
- 👤 Subscriber experience — Welcome notification, "Supporting since" dates
- 🔗 Multi-source referral tracking — Referrals now tracked from endorsements, reviews, and transfer listings
- 📋 Player Directory — Filter by role, sort by newest/kingdom/TC, "My Kingdom" quick filter
---

## [2026-02-10] — v1.10.0

### ✨ New
- 🏠 Transfer Hub Guide — "How It Works" collapsible guide for first-time visitors
- 📊 Transfer Profile Preview — See exactly how recruiters view your profile before saving
- 🔗 Shareable Transfer Listings — Share any kingdom listing via link or Discord with formatted message
- 📸 Copy Listing as Image — Generate and share a PNG card of any transfer listing
- 📝 Application Notes — Add a personal message when applying to transfer

### 🐛 Fixed
- Apply button was gated behind premium — All users can now apply to transfer to any kingdom
- Comebacks/Reversals data — Stats were stuck at 0, now properly calculated
- Match Score sort — Was silently broken (no-op), now actually sorts by compatibility
- React Hooks crash — Fixed Rules of Hooks violation that crashed Transfer Hub on login state change

### 🔧 Improved
- 💎 Premium tier card polish — Gold/Silver/Bronze gradient overlays, hover glows, tier badge animations
- 📐 Match Score breakdown — Hover any match % to see exactly what matched and what didn't
- 🔍 Comprehensive SEO — 301 redirects for legacy URLs, expanded robots.txt, keyword-targeted meta tags
- 🛡️ Endorsement hardening — Server-side validation, notification on endorsement, stale claim daily reminders
- 📊 Coordinates — Structured in-game coordinate fields (Kingdom, X, Y) on transfer profiles
---

## [2026-02-09] — v1.9.0

### ✨ New
- 🚀 Transfer Hub is LIVE — Browse kingdoms, apply to transfer, manage your listing. Open to all linked accounts.
- 🏠 Homepage redesigned — Quick Actions grid, Transfer Hub banner, live KvK & Transfer countdowns
- 🏅 Ambassador Network — Public directory of top referrers with tier badges (Scout/Recruiter/Consul/Ambassador)
- 🏆 Premium /multirally — 3 free uses/day, unlimited for Supporters. Persistent credit tracking.

### 🔧 Improved
- 🏰 Kingdom Listing Cards — Full redesign with Transfer Status badges, performance stats, vibe tags, alliance event times
- 📋 Transfer Groups — Kingdoms grouped per transfer event. You only see kingdoms in your group.
- ⚖️ Real match scoring — Compares your power, TC, language, and kingdom vibe with each listing
- 📩 Transfer invitations — Recruiters can browse and invite transferees. Duplicate protection + notifications.
- 📊 Scroll depth tracking — Helps us understand which pages keep you engaged
---

## [2026-02-08] — v1.8.0

### ✨ New
- 📈 Return Visit Delta — See how any kingdom's score changed since your last visit
- ⚔️ RIVAL badge — Kingdoms that faced yours in KvK are now tagged with a red badge
- 💡 SmartTooltips — New tooltip system across all cards: tap on mobile, hover on desktop
- 🗺️ Dynamic sitemap — 14 more kingdoms now indexed by Google (1,204 total)

### 🐛 Fixed
- Streaks tooltip — No longer renders off-screen for bottom radar chart labels
- QuickStats cards — Now properly fill full width on all screen sizes
- Mobile hover borders — No more sticky hover effects on touchscreens
- Tier thresholds — Updated from old 0-10 scale to v3.1 0-100 scale across all tooltips

### 🔧 Improved
- 🔒 Content gating — Detailed analytics sections now require sign-in (free). Drives 3x more signups.
- 🏰 Kingdom header — Restructured with Atlas Rank row + rank change badge (▲/▼ positions)
- 🎖️ Badge ribbon — YOUR KINGDOM and RIVAL badges moved to elegant top-edge ribbon
- 📋 Transfer Status — Click "Unannounced" to submit a status update directly from the card
- 🆕 Locked states — Kingdoms with 0 KvKs show "Play your first KvK to unlock" instead of empty charts
---

## [2026-02-07] — v1.7.0

### ✨ New
- 🤖 /history — Full KvK season history with W/L per phase in Discord
- 🤖 /predict — Weighted matchup predictions with probability and confidence
- 🤖 /countdowntransfer — Transfer Event countdown alongside existing KvK countdown

### 🐛 Fixed
- Atlas Score inflation — 7 kingdoms were tied at 100.00. Now properly differentiated (K231: 82.39, K3: 76.15, K61: 71.56)
- Score History charts — 482 kingdoms were missing KvK #10 data. All backfilled.
- Atlas Score Breakdown — Donut charts now show correct 0-100 scale values that add up
- Discord emojis — Fixed 4 corrupted emoji characters across bot commands

### 🔧 Improved
- 🤖 Discord /kingdom — Cleaner layout with Atlas Score in description, added Invasions stat
- 🤖 Discord /compare — Side-by-side format with Dominations and Invasions
- 🤖 /leaderboard renamed to /rankings — Consistent with website terminology
- 📊 About page — Updated formula weights and tier descriptions for v3.1
---

## [2026-02-05] — v1.6.0

### ✨ New
- ⚔️ KvK Seasons page — Browse matchups by season, Combined Score rankings, All-Time Greatest battles
- 📈 Atlas Score History — Interactive chart showing how any kingdom's score evolved across every KvK

### 🐛 Fixed
- KvK Seasons phase winners — Now correctly shows who won Prep and Battle phases
- Score history accuracy — Charts use correct formula matching database
- KvK corrections — Only approved corrections apply to displayed data
- Duplicate submission check — Fixed query that was checking wrong table

### 🔧 Improved
- 🏰 Kingdom Profile layout — Reorganized sections with Expand/Collapse All button
- 📊 Atlas Score Breakdown — 6 donut charts with point contributions that add up
- 🎮 Atlas Score Simulator — Cleaner interface for "what if" scenarios
- 🎯 Path to Next Tier — Clearer requirements, removed misleading buffer section
- 🔢 Atlas Score precision — Now shows 2 decimal places everywhere (10.43 vs 10.4)
- 📝 KvK outcome labels — Domination, Invasion, Reversal, Comeback
- 🔒 Security hardening — Admin auth, database RLS, CSP reporting
---

## [2026-02-03] — v1.5.0

### ✨ New
- 💛 Atlas Supporter — Rebranded from previous tier name. Same features, clearer name. Support at ks-atlas.com/support
- 🔔 In-app notifications — Real-time alerts when your submissions are approved or need attention
- 🤖 Atlas Discord bot — Use /kingdom and /compare commands right in your server
- 💬 Feedback widget — Report bugs or request features from any page

### 🐛 Fixed
- Discord bot stability — Fixed 4+ days of intermittent 502/503 errors
- Profile bio saves correctly — No more changes lost after refresh
- Mobile Discord login — Clear guidance that OAuth opens in browser
- Missing KvK chip — Now shows on both desktop and mobile

### 🔧 Improved
- 👤 My Profile redesign — Centered avatar, tier-colored borders, bio section, display name privacy
- 👁️ Public profiles — Cleaner display with Kingshot avatar/username
- 🏰 Kingdom profiles — Bye outcome support, score freshness indicator
- 📊 Contribute data — Submissions now sync across all your devices
- ⚡ Faster page loads — Removed ~2MB of legacy data, added skeleton loaders
---

## [2026-01-30] — v1.4.0

### ✨ New
- 🆓 KvK History is now FREE — Full battle history for all users. No paywall.
- 💳 Stripe payments live — Upgrade to Atlas Supporter with real checkout.
- ⚖️ Compare limits updated — Anonymous: login required | Free: 2 | Supporter: 5

### 🐛 Fixed
- Atlas Score accuracy — Fixed formula bug deflating scores by ~10%
- Player verification — "Failed to verify" error resolved
- Kingdom profiles — No more "Kingdom not found" for valid kingdoms
- Profile page — Fixed race condition showing wrong error

### 🔧 Improved
- Upgrade page redesign with accurate feature comparison
- Tier thresholds unified across website and Discord bot
---

## [2026-01-29] — v1.3.0

### ✨ New
- 📅 Daily updates now post to Discord at 02:00 UTC — never miss a change
- 🔮 "Coming Soon" page — see what's cooking before anyone else
- 🧪 Frontend testing infrastructure — more stable releases ahead
- 📊 Data quality monitoring — your data, bulletproof
- ⚖️ Multi-Compare now supports 5 kingdoms — Supporters, go wild
- 🎭 Discord roles dropping soon for Atlas Supporter subscribers
- 🏰 Claim Kingdom preview — verify you're the real deal
- 🤖 Atlas Discord bot is LIVE — 9 slash commands at your fingertips
- 📢 Auto patch notes in Discord — updates delivered fresh
- 🔍 /kingdom command — lookup any kingdom without leaving Discord
- ⚔️ /compare command — head-to-head matchups on demand
- ⏰ /countdown command — know exactly when KvK drops

### 🐛 Fixed
- Supporter badge only shows when you're actually logged in (oops)
- Removed vaporware from upgrade page — honesty policy

### 🔧 Improved
- Streamlined agent system with 3 new specialists
- Activity tracking for transparent development
- Radar charts got a glow-up — cleaner, centered, sexier
- Stat labels are bolder — no more squinting
- Quick Compare icon swapped to ⚖️ — because balance matters
- Cinzel font finally loading right — titles look royal now
- Discord webhooks for instant notifications
- Mobile comparison views actually work now
---

## [2026-01-28] — v1.0.0

### ✨ New
- 🎉 Atlas goes live — stop guessing, start winning
- 🏆 1,190 kingdoms tracked and scored
- 📊 Atlas Score system — S/A/B/C/D tiers at a glance

### 🔧 Improved
- Complete backend overhaul for speed
- Agent team restructured for faster updates
---

## Previous Changes

*Historical changes will be added as patch notes are compiled.*

---

*Maintained by Release Manager*
