# Discord Community Manager — Latest Knowledge

**Last Updated:** 2026-01-29  
**Purpose:** Current best practices, platform updates, and community management insights

---

## Revenue Conversion Strategy (PRIORITY)

**Reference:** `/docs/DISCORD_REVENUE_PLAYBOOK.md`

### Premium CTAs Implemented
Bot embeds now include premium conversion messages:
- `/kingdom` → "🔓 Unlock more with Atlas Pro"
- `/compare` → "🔓 Get matchup predictions with Atlas Pro"
- `/leaderboard` → "🔓 Track historical rankings with Atlas Pro"
- `/help` → Full "⭐ Atlas Pro" features section
- Patch Notes → "Support development with Atlas Pro"

### Key Channels for Conversion
- **#premium-showcase** — Weekly premium insights/teasers
- **#announcements** — KvK reminders with premium pitch
- **#patch-notes** — Updates with soft conversion CTA

### Conversion Funnel
```
Discord Member → Bot Usage → Premium CTA Click → ks-atlas.com/pro → Subscriber
```

### @Pro Role
Exists and ready. Assign to premium subscribers for:
- Social proof (visible in member list)
- Status recognition (competitive players value this)
- Future: Exclusive channel access

---

## Discord Platform Updates (2025-2026)

### Recent Feature Changes
- **AutoMod v2** — Enhanced keyword filtering with regex support
- **Forum channels** — Better for organized discussions, Q&A
- **Onboarding flow** — Customizable new member experience
- **Server subscriptions** — Monetization options (if needed)
- **App Directory** — Discoverability for public servers
- **Linked Roles** — Connect external accounts for role verification

### Slash Commands Best Practices
- All bots should use slash commands (legacy prefixes deprecated)
- Ephemeral responses for sensitive/personal data
- Autocomplete for better UX
- Subcommands group related functionality
- Description field is crucial for discoverability

---

## Community Engagement Best Practices (2026)

### The 90-9-1 Rule
- **90%** of members are lurkers (read only)
- **9%** contribute occasionally
- **1%** are power contributors

**Strategy:** Design for lurkers to consume, make it easy for the 9% to contribute, and recognize the 1%.

### Engagement Hooks
1. **Questions at the end** — "Which kingdom surprised you this KvK?"
2. **Polls for opinions** — Low-friction engagement
3. **Milestone celebrations** — "We just hit 500 members!"
4. **Exclusive previews** — Reward Discord presence
5. **Community spotlights** — Highlight helpful members

### Timing Matters
| Time (UTC) | Activity Level | Best For |
|------------|----------------|----------|
| 14:00-18:00 | Peak | Major announcements |
| 18:00-22:00 | High | Discussion posts |
| 08:00-14:00 | Medium | Patch notes |
| 22:00-08:00 | Low | Scheduled/automated only |

### Gaming Community Specifics
- Align content with game events (KvK, Transfer Events)
- Competitive players want data, not fluff
- Quick access to info beats elaborate presentations
- Drama-free zone is a feature, not a bug
- Respect players' time—be concise

---

## Bot Design Patterns

### Response Architecture
```
User command
     ↓
Instant acknowledgment (if slow operation)
     ↓
Rich embed with structured data
     ↓
Footer with helpful context
     ↓
Optional: Related command suggestions
```

### Embed Best Practices
- **Color coding** — Consistent meanings (green=good, red=bad, cyan=info)
- **Thumbnail** — Kingdom flag or relevant icon
- **Fields** — Max 25, but use sparingly (3-6 is ideal)
- **Footer** — Timestamp, data freshness, help hint
- **Buttons** — For pagination, related actions

### Error Handling
```
❌ Bad: "Error"
❌ Bad: "Something went wrong"
✅ Good: "Kingdom not found. Try `/kingdom 172` — numbers only!"
✅ Good: "I couldn't reach the database. Try again in a moment."
```

### Personality Guidelines (Atlas Bot)
- Mystical strategist vibes
- Dry wit, not sarcastic
- Competitive but respectful
- Never condescending
- Gaming terminology natural

**Example responses:**
- "Kingdom 172 stands strong. Here's the data to prove it."
- "Two titans, one battlefield. Let's see how they compare."
- "The oracles have spoken. Your next KvK begins in 3 days."

---

## Server Architecture Patterns

### Recommended Category Structure
```
📢 OFFICIAL
├── #rules
├── #announcements
└── #patch-notes

💬 COMMUNITY
├── #general
├── #off-topic
└── #introductions

🤖 ATLAS BOT
├── #bot-commands
└── #bot-help

📝 FEEDBACK
├── #suggestions
├── #bugs
└── #feature-requests

📚 RESOURCES
├── #guides
├── #faq
└── #links
```

### Role Hierarchy Best Practices
```
@Owner/Admin          — Full control
@Moderator            — Message management
@Verified             — Passed onboarding
@Member               — Basic access
@Bot                  — Separate from humans
```

### Permission Philosophy
- **Deny by default** — Explicitly grant permissions
- **Least privilege** — Only what's needed
- **Channel overrides** — Specific channels, specific rules
- **Verified gate** — Reduce spam with verification

---

## Metrics That Matter

### Health Indicators
| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Daily active messages | 50+ | 20-50 | <20 |
| Command usage/day | 30+ | 10-30 | <10 |
| Member growth/week | Positive | Flat | Negative |
| Response time (bot) | <500ms | 500ms-2s | >2s |
| Error rate | <1% | 1-5% | >5% |

### Engagement Ratios
- **Announcement engagement:** Reactions/views > 5% is good
- **Command diversity:** Using >50% of available commands = healthy
- **Help channel resolution:** Questions answered < 24h

### Red Flags
- Spike in member leaves
- Declining command usage
- Unanswered questions aging
- Negative sentiment in general

---

## Competitive Analysis Insights

### What Top Gaming Discord Servers Do
1. **Clear value proposition** — Why join? What do I get?
2. **Instant utility** — Bot commands work immediately
3. **Low-friction onboarding** — Rules accept → access
4. **Event alignment** — Content synced with game schedule
5. **Recognition systems** — Top contributors highlighted
6. **Fast response** — Questions answered within hours

### Common Mistakes to Avoid
- Too many channels (paralysis of choice)
- Unclear channel purposes
- Dead channels visible
- No welcome message
- Bot in wrong channel
- Stale announcements
- Over-moderation

---

## Kingshot Atlas Specific Context

### Our Server Structure (Current)
```
📢 ATLAS BILLBOARD
├── #announcements
└── #patch-notes

💬 ATLAS COMMUNITY
├── #general
├── #suggestions
├── #bugs
└── #atlas-commands
```

### Bot Capabilities
- `/kingdom <number>` — Kingdom stats
- `/compare <k1> <k2>` — Head-to-head comparison
- `/tier <tier>` — Kingdoms by tier
- `/random` — Discover random kingdom
- `/leaderboard` — Top 10 by Atlas Score
- `/top <phase>` — Top 10 by phase win rate
- `/upcoming` — Next events
- `/countdown` — KvK countdown
- `/help` — Command list

### Webhook Endpoints
- `POST /api/discord/webhook/patch-notes`
- `POST /api/discord/webhook/major-release`
- `POST /api/discord/webhook/maintenance`
- `POST /api/discord/webhook/status`

### Brand Voice Reminders
- "Stop guessing. Start winning."
- "Know your enemy. Choose your allies. Dominate KvK."
- "Data-driven dominance"
- S-Tier, A-Tier (not "top tier")
- KvK (not "Kingdom vs Kingdom" after first use)

---

## Tools & Resources

### Discord Developer Tools
- [Discord Developer Portal](https://discord.com/developers)
- [Discord.js Guide](https://discordjs.guide/)
- [Discord API Documentation](https://discord.com/developers/docs)

### Analytics Options
- Discord Server Insights (built-in, requires Community enabled)
- Bot-level logging (custom implementation)
- Third-party bots (Statbot, etc.) — evaluate privacy implications

### Testing
- Development server for bot testing
- Webhook testing endpoints
- Command simulation

---

## Immediate Priorities (2026-01-29)

### Evaluation Focus
1. **Server structure** — Is it optimal for our size and purpose?
2. **Bot performance** — Commands working, errors handled?
3. **Engagement baseline** — Current activity levels?
4. **Missing features** — What do users want that we don't have?

### Quick Wins (Low Effort, High Impact)
- Welcome message optimization
- Channel topic descriptions
- Bot error message improvements
- Announcement engagement hooks

### Medium-Term Goals
- Server health diagnostics command
- Automated event reminders
- Community feedback collection system

---

*Knowledge maintained by Discord Community Manager*
