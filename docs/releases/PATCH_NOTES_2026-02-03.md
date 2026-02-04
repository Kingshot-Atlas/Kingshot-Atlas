# Patch Notes — February 3, 2026

*Stop guessing. Start winning.*

---

## ✨ New

### 💛 Atlas Supporter (Rebrand)
- **Atlas Pro is now Atlas Supporter** — Same features, clearer name. You're supporting the platform that helps you win.
- New dedicated support page at [ks-atlas.com/support](https://ks-atlas.com/support)

### 🔔 In-App Notifications
- **Real-time alerts** — Get notified when your submissions are approved or need attention. No more refreshing to check status.
- Bell icon in the header shows your unread count
- Mark as read, mark all read, or clear from the dropdown

### 🤖 Atlas Discord Bot
- **Invite Atlas to your server** — Use `/kingdom` and `/compare` commands right in Discord
- Embeds now show **Atlas Rank** alongside score (e.g., "Atlas Score: **12.7** (Rank #3)")
- Cleaner styling with website links to dive deeper

### 💬 Feedback Widget
- Floating feedback button on every page — report bugs, request features, or share thoughts
- We're listening. Help us build what you actually need.

---

## 🔧 Improved

### 🏠 Home Page
- **Cleaner layout** — Removed sticky Compare button for less clutter
- Compare feature still available on the dedicated /compare page
- Better error handling when data fails to load

### 👤 My Profile
- **Redesigned header** — Centered avatar with clean info grid below
- **New 2×3 info layout:** Kingdom, Alliance, Player ID | TC Level, Language, Region
- **Tier-colored avatar borders:** White (Free), Cyan (Supporter), Purple (Recruiter), Red (Admin)
- **Profile completion progress** — See exactly what to fill out with a progress bar
- **Bio section** — Add a personal bio that displays in a styled card
- **Display name** — Set a custom name if you don't want your Discord username public
- **Welcome toast** — New users see a personalized greeting
- **Random usernames** — Fresh accounts get fun placeholder names (change anytime)
- **Better mobile experience** — Larger touch targets, proper spacing, no tap flash

### 👁️ Public Profiles
- **Cleaner display** — Shows "PUBLIC PROFILE" header with Kingshot avatar/username
- **Kingdom link** — Click their kingdom to jump to that profile
- Info grid matches My Profile layout for consistency

### 🏰 Kingdom Profiles
- **"Bye" support** — Kingdoms that had no opponent show ⏸️ with "No match" (doesn't affect Atlas Score)
- **Score freshness indicator** — See when the Atlas Score was last calculated
- **Fixed Atlas Score display** — Now uses database value instead of recalculating (no more mismatches)
- Loading skeleton while data fetches

### 📊 Contribute Data
- **Submissions sync across devices** — Your corrections and reports now save to your account, not just your browser
- **Unified contribution stats** — See your totals across all submission types (KvK results, corrections, error reports)
- **Better duplicate detection** — System checks if you've already submitted the same data

---

## 🐛 Fixed

- **Discord bot stability** — Fixed 4+ days of intermittent 502/503 errors. Bot now reports accurate health status.
- **Profile bio saves correctly** — Fixed issue where bio changes weren't persisting after refresh
- **Mobile Discord login** — Added clear guidance that Discord OAuth opens in browser (Discord's policy)
- **Missing KvK chip** — Now shows on both desktop and mobile for kingdoms missing latest KvK data

---

## ⚡ Performance

- **Faster page loads** — Removed ~2MB of legacy data files
- **Smoother loading** — Added skeleton loaders on Leaderboards, Kingdom Profiles, and Compare pages

---

*Questions? Hit the feedback button or join our Discord.*

🚀 **Support development** → [ks-atlas.com/support](https://ks-atlas.com/support)
