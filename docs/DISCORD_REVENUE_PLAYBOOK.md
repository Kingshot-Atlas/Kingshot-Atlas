# Discord Revenue Playbook

**Version:** 1.0  
**Created:** January 29, 2026  
**Owner:** Discord Community Manager (under Release Manager)

---

## Overview

This document contains all templates, strategies, and workflows for converting Discord community members into Atlas Supporter subscribers.

---

## Current Server Structure

```
📋 TOP SECTION
├── 👥 Members
├── 🚀 Server Boosts
├── ✅ rules
├── #welcome
└── #admin-only

📢 ATLAS BILLBOARD
├── #announcements
├── #premium-showcase ← NEW (Revenue Driver)
└── #patch-notes

💬 ATLAS COMMUNITY
├── #general
├── #suggestions
├── #bugs
└── #atlas-commands

👨‍💻 ATLAS DEVELOPERS
└── #discussion

🔊 VOICE CHANNELS
└── 🔊 English
```

---

## Roles Structure

| Role | Color | Members | Purpose |
|------|-------|---------|---------|
| Admin | Red | 2 | Server management |
| Moderator | Pink | 0 | Community moderation |
| Atlas | Purple | 1 | Bot role |
| Recruiter | Yellow | 0 | Community growth |
| **Pro** | Pink | 0 | **Premium subscribers** ← Revenue tracking |
| Supporter | Pink | 0 | Early supporters |
| Settler | Green | 0 | Engaged members |
| Explorer | Green | 46 | Default/new members |
| Patch Notes | Gray | 0 | Update notifications |

---

## Premium CTA Locations

The bot now includes premium CTAs in these responses:

| Command | CTA Type | Message |
|---------|----------|---------|
| `/kingdom` | Soft | "🔓 Unlock more with Atlas Supporter" |
| `/compare` | Feature | "🔓 Get matchup predictions with Atlas Supporter" |
| `/leaderboard` | Feature | "🔓 Track historical rankings with Atlas Supporter" |
| `/help` | Section | Full "⭐ Atlas Supporter" features list |
| Patch Notes | Support | "💬 Love these updates? Support development" |

---

## Templates

### 1. Premium Showcase Post

**Channel:** #premium-showcase  
**Frequency:** 1-2x per week  
**Purpose:** Create FOMO, demonstrate premium value

```markdown
🔮 **Premium Insight — Week of [DATE]**

This week, Atlas Supporter members got early access to:

📊 **[FEATURE/INSIGHT NAME]**
[1-2 sentence teaser about what Pro members saw]

👀 **Sneak Peek:**
> [Partial data or blurred insight that creates curiosity]

---

**Atlas Supporter members saw this first.**
Don't miss the next insight → https://ks-atlas.com/support
```

**Example:**
```markdown
🔮 **Premium Insight — Week of January 27**

This week, Atlas Supporter members got early access to:

📊 **KvK #10 Matchup Predictions**
Our algorithm predicted 8 out of 10 prep phase outcomes correctly.

👀 **Sneak Peek:**
> Kingdom 172 vs Kingdom 84: **72% win probability** for K172
> Kingdom 156 vs Kingdom 203: Closer than expected...

---

**Atlas Supporter members saw this first.**
Don't miss the next insight → https://ks-atlas.com/support
```

---

### 2. KvK Reminder (24h Before)

**Channel:** #announcements  
**Trigger:** Automated, 24h before KvK start  
**Purpose:** High-intent moment for conversions

```markdown
⚔️ **KvK #[NUMBER] starts in 24 hours!**

Time to scout your opponents and plan your strategy.

📊 **Free:**
• Check kingdom stats with `/kingdom`
• Compare matchups with `/compare`
• View the leaderboard

🔓 **Atlas Supporter:**
• Matchup win probabilities
• Historical performance trends
• Advanced predictions

**Don't go in blind.** → https://ks-atlas.com/support
```

---

### 3. Enhanced Patch Notes

**Channel:** #patch-notes  
**Trigger:** On release  
**Purpose:** Build goodwill + soft conversion

```markdown
📢 **Kingshot Atlas Update — [DATE]**

✨ **New**
• [Feature 1]
• [Feature 2]

🔧 **Improved**
• [Improvement 1]

🐛 **Fixed**
• [Bug fix 1]

---

📖 Full notes: https://ks-atlas.com/changelog

💬 **What feature do you want next?** Drop it in #suggestions!

🚀 Love these updates? Support development → https://ks-atlas.com/support
```

---

### 4. Welcome Message

**Channel:** #welcome (or auto-DM)  
**Trigger:** New member join  
**Purpose:** Onboarding + early premium awareness

```markdown
# Welcome to Kingshot Atlas! 🏰

Hey [USERNAME]! **Stop guessing. Start winning.**

We're a community of competitive players who make decisions with data, not rumors.

**🚀 Quick Start:**
1. Read the #rules
2. Try `/kingdom YOUR_NUMBER` in #atlas-commands
3. Browse the leaderboard: https://ks-atlas.com/leaderboard

**💬 Get Involved:**
• Chat in #general
• Share feedback in #suggestions
• Report issues in #bugs

**⭐ Want More?**
Upgrade to Atlas Supporter for historical trends, predictions, and advanced analytics.
→ https://ks-atlas.com/support

*Built by Kingdom 172 — Data-driven dominance.*
```

---

### 5. Weekly Engagement Post

**Channel:** #general  
**Frequency:** Weekly (e.g., Wednesday)  
**Purpose:** Spark discussion + bot usage

```markdown
🏰 **Kingdom Spotlight — K[NUMBER]**

This week's random kingdom:
• **Atlas Score:** X.X (Tier X)
• **Record:** XW - XL
• **Notable:** [Something interesting]

💬 **Discussion:** Would you migrate here? Why or why not?

*Use `/kingdom [NUMBER]` to see full stats!*
```

---

## Revenue Metrics to Track

### Bot Analytics (via `/stats`)
- Total commands per day
- Unique users per day
- Most used commands
- Error rate

### Conversion Funnel
| Stage | Metric | Target |
|-------|--------|--------|
| Awareness | Discord members | Growing |
| Engagement | Daily active bot users | 10+ |
| Interest | Pro link clicks | Track via UTM |
| Conversion | New Pro subscribers | Track manually |

### UTM Tracking
Use these UTM parameters for Discord links:
- `?utm_source=discord&utm_medium=bot&utm_campaign=kingdom_embed`
- `?utm_source=discord&utm_medium=bot&utm_campaign=help_command`
- `?utm_source=discord&utm_medium=announcement&utm_campaign=kvk_reminder`
- `?utm_source=discord&utm_medium=channel&utm_campaign=premium_showcase`

---

## Implementation Checklist

### ✅ Completed
- [x] Premium CTAs added to bot embeds
- [x] `/help` command includes Pro features section
- [x] Patch notes template includes conversion CTA
- [x] KvK reminder embed created
- [x] Premium showcase embed created
- [x] Welcome embed created
- [x] #premium-showcase channel created (by owner)
- [x] @Pro role exists

### 🔜 Pending (Owner Action)
- [ ] Post first Premium Showcase message
- [ ] Add welcome message to #welcome or enable auto-DM
- [ ] Re-deploy bot with updated embeds
- [ ] Test premium CTAs in all commands

### 📋 Future Enhancements
- [ ] Automated KvK reminder (requires cron/scheduler)
- [ ] `/subscribe` command for notifications
- [ ] Pro role auto-assignment on purchase
- [ ] A/B test different CTA messages

---

## Brand Voice Reminders

All Discord content must follow brand guidelines:

**Tone:** Competitive, analytical, direct, community-powered

**Key Phrases:**
- "Stop guessing. Start winning."
- "Data-driven dominance"
- "No more blind migrations"

**Terminology:**
- KvK (not Kingdom vs Kingdom after first use)
- Prep Phase / Battle Phase
- Atlas Score (not rating/points)
- S-Tier, A-Tier, etc.

---

## Contact

**Discord Community Manager** reports to **Release Manager**  
All recommendations require owner approval before implementation.

See: `/agents/release-manager/discord-community-manager/SPECIALIST.md`
