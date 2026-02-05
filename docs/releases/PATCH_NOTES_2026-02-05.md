# Patch Notes — February 5, 2026

*Know your enemy. Choose your allies. Dominate KvK.*

---

## ✨ New

### ⚔️ KvK Seasons (Rankings → KvK Seasons)
Relive every battle. See who dominated, who got invaded, and who pulled off the comeback.

- **Browse by Season** — Select any KvK and see all matchups with historical Atlas Scores
- **Combined Score Ranking** — Matchups sorted by combined Atlas Score (higher = more elite)
- **All-Time Greatest** — Top 50 highest-stakes matchups across all KvK history
- **Phase Winners** — See who won Prep Phase and Battle Phase for each matchup
- **Outcome Classification** — Domination, Invasion, Reversal, Comeback labels
- Gold, silver, bronze card borders for top 3 matchups per season

### 📈 Kingdom Profile — Atlas Score History
Track how any kingdom's score has evolved over time.

- Interactive chart showing score progression across every KvK
- Tap/hover data points to see score, tier, and rank at that moment
- Mobile-optimized with larger touch targets and tap-to-toggle tooltips

---

## 🔧 Improved

### 🏰 Kingdom Profile Layout
- Reorganized section order for better flow
- New "Expand/Collapse All" button controls 5 sections at once
- Centered section titles with consistent styling

### 📊 Atlas Score Breakdown
- **6 Donut Charts:** Base, Dom/Inv, Form, Streaks, Experience, History
- Point contributions now add up: "5.60 base + 0.21 dom - 0.27 form = 5.89"
- All values show 2 decimal places
- Color-coded: green for positive modifiers, red for negative
- Added "(breakdown is approximate)" disclaimer

### 🎮 Atlas Score Simulator
- Cleaner interface with centered styling
- More intuitive scenario testing

### 🎯 Path to Next Tier
- Removed misleading "Elite Status Buffer" section
- Clearer requirements for tier advancement

### 🔢 Atlas Score Display
- Now shows 2 decimal places everywhere (10.43 instead of 10.4)
- More precise comparisons between kingdoms

### 📝 KvK Submission Form
- Outcome labels updated: Invasion (L/L), Reversal (W/L), Comeback (L/W)

---

## 🐛 Fixed

- **KvK Seasons phase winners** — Now correctly shows who won each phase
- **Score history accuracy** — Charts use correct formula matching database
- **KvK corrections** — Only approved corrections apply to displayed data
- **Duplicate submissions** — Fixed check that was querying wrong table

---

## 🔒 Security

- Hardened admin authentication for production
- Database security improvements (RLS policies, function search paths)
- Added CSP reporting for violation monitoring

---

*Questions? Hit the feedback button or join our Discord.*

🚀 **Support development** → [ks-atlas.com/support](https://ks-atlas.com/support)
