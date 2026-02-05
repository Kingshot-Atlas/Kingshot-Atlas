# Changelog

All notable changes to Kingshot Atlas are documented here.

---

## [2026-02-05] — KvK Seasons & Kingdom Profile Overhaul

### ✨ New
- **KvK Seasons page** — Browse matchups by season, see Combined Score rankings, All-Time Greatest battles
- **Atlas Score History chart** — Track how any kingdom's score evolved across every KvK

### 🔧 Improved
- Kingdom Profile layout reorganized with Expand/Collapse All button
- Atlas Score Breakdown now shows 6 donut charts with point contributions that add up
- Atlas Score Simulator with cleaner interface
- Path to Next Tier with clearer requirements (removed misleading buffer section)
- Atlas Score now displays 2 decimal places everywhere
- KvK outcome labels: Domination, Invasion, Reversal, Comeback

### 🐛 Fixed
- KvK Seasons phase winners now display correctly
- Score history charts use correct formula
- Only approved KvK corrections apply to displayed data
- Duplicate submission check fixed

### 🔒 Security
- Hardened admin authentication for production
- Database security improvements (RLS, function search paths)
- CSP reporting for violation monitoring

---

## [2026-02-03] — Atlas Supporter & Profile Overhaul

### ✨ New
- Atlas Pro rebranded to **Atlas Supporter** with new support page
- In-app notification system with real-time alerts
- Atlas Discord bot with `/kingdom` and `/compare` commands
- Feedback widget on all pages

### 🔧 Improved
- Home page decluttered (removed sticky Compare button)
- My Profile redesigned with 2×3 info grid and tier-colored avatar borders
- Public profiles show Kingshot data with cleaner layout
- Kingdom profiles support "Bye" outcomes and show score freshness
- Contribute data submissions now sync across devices

### 🐛 Fixed
- Discord bot stability (resolved 4+ days of 502/503 errors)
- Profile bio persistence after refresh
- Mobile Discord login guidance
- Missing KvK chip visibility on mobile

### ⚡ Performance
- Removed ~2MB legacy data files
- Added skeleton loaders on key pages

---

## [2026-01-28] — Agent System Restructure

### 🔧 Improved
- Reorganized agent team with clearer roles and responsibilities
- Added Release Manager for user communications
- Enhanced Director role with executive autonomy
- Improved documentation and workflows for all agents

---

## Previous Changes

*Historical changes will be added as patch notes are compiled.*

---

*Maintained by Release Manager*
