# Atlas Discord Bot

**Status:** ✅ DEPLOYED (2026-01-29)  
**Bot Tag:** Atlas#6732  
**Internal Documentation**

**Bot Name:** Atlas  
**Version:** 1.0.0  
**Last Updated:** 2026-01-29

---

## Overview

Atlas is the official Discord bot for Kingshot Atlas.

> **✅ Production Ready:** API deployed to Render at `https://kingshot-atlas.onrender.com`. UptimeRobot configured to keep it awake. It provides instant access to kingdom data, rankings, and event schedules directly in Discord. The bot also posts automated patch notes and announcements via webhooks.

**Tagline:** *"Know your enemy. Choose your allies. Dominate KvK."*

---

## Bot Character

Atlas is personified as a **mystical strategist and data oracle**:

- **Knowledgeable** — Has instant access to all kingdom data
- **Strategic** — Thinks in terms of advantages and outcomes
- **Dry wit** — Delivers facts with occasional sardonic commentary
- **Competitive spirit** — Respects winners, challenges underdogs
- **Loyal to the community** — Genuinely wants players to succeed

**Avatar:** `/apps/web/public/AtlasBotAvatar.webp`

---

## Commands

### Lookup Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/kingdom <number>` | Get detailed stats for a kingdom | `/kingdom 172` |
| `/compare <k1> <k2>` | Compare two kingdoms head-to-head | `/compare 172 247` |
| `/tier <tier>` | List kingdoms by tier (S/A/B/C/D) | `/tier S` |
| `/random` | Discover a random kingdom | `/random` |

### Ranking Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/leaderboard` | Top 10 kingdoms by Atlas Score | `/leaderboard` |
| `/top <phase>` | Top 10 by phase win rate | `/top prep` |

### Event Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/upcoming` | Next KvK and Transfer Event dates | `/upcoming` |
| `/countdown` | Live countdown to next KvK | `/countdown` |

### Help

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |

---

## Engagement Strategy

### Why Each Feature Matters

| Feature | Engagement Value | User Utility |
|---------|------------------|--------------|
| `/kingdom` | Quick data access keeps users coming back | Instant stats without leaving Discord |
| `/compare` | Sparks discussion and debates | Pre-KvK scouting made easy |
| `/leaderboard` | Competitive players check rankings | Track kingdom performance |
| `/tier` | Browse kingdoms at your level | Find transfer targets |
| `/upcoming` | Time-sensitive info drives return visits | Never miss events |
| `/countdown` | Urgency and excitement | Prep phase awareness |
| `/random` | Fun discovery feature | Explore new kingdoms |
| **Patch Notes** | Automated updates keep channel active | Stay informed effortlessly |

### Actual Server Structure

```
📢 ATLAS BILLBOARD
├── #announcements    ← Major announcements
└── #patch-notes      ← Patch notes posted here (webhook)

💬 ATLAS COMMUNITY
├── #general          ← General discussion
├── #suggestions      ← Ideas from members
├── #bugs             ← Bug reports from members
└── #atlas-commands   ← Users issue bot commands here
```

---

## Webhook Integration

### Patch Notes Flow

```
Release Manager compiles patch notes (every 3 days)
        ↓
Saves to /docs/releases/PATCH_NOTES_YYYY-MM-DD.md
        ↓
Calls POST /api/discord/webhook/patch-notes
        ↓
Atlas posts formatted embed to #updates channel
        ↓
Users see update in Discord
```

### API Endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `POST /api/discord/webhook/patch-notes` | Regular updates | X-API-Key |
| `POST /api/discord/webhook/major-release` | Big releases | X-API-Key |
| `POST /api/discord/webhook/maintenance` | Maintenance notices | X-API-Key |
| `POST /api/discord/webhook/status` | Outage/resolution | X-API-Key |

### Patch Notes Request Format

```json
{
  "date": "January 29, 2026",
  "new": [
    "Added Discord bot integration",
    "New /tier command for browsing kingdoms"
  ],
  "fixed": [
    "Fixed timezone display for KvK countdown"
  ],
  "improved": [
    "Faster kingdom data loading"
  ]
}
```

---

## Technical Architecture

### Project Location

```
/apps/discord-bot/
├── package.json
├── .env.example
├── README.md
└── src/
    ├── bot.js              # Main entry point
    ├── config.js           # Configuration
    ├── register-commands.js
    ├── webhook-test.js
    ├── commands/
    │   ├── index.js        # Command definitions
    │   └── handlers.js     # Business logic
    ├── services/
    │   └── webhook.js      # Webhook service
    └── utils/
        ├── api.js          # API client
        ├── embeds.js       # Embed builders
        └── events.js       # Event calculations
```

### Dependencies

- `discord.js` ^14.14.1 — Discord API wrapper
- `dotenv` ^16.3.1 — Environment variables
- `node-cron` ^3.0.3 — Scheduled tasks (future)
- `node-fetch` ^3.3.2 — HTTP client

### Environment Variables

```env
DISCORD_TOKEN=           # Bot token (required)
DISCORD_CLIENT_ID=       # Application ID (required)
DISCORD_GUILD_ID=        # Guild ID for dev (optional)
DISCORD_PATCH_NOTES_WEBHOOK=  # Webhook URL
API_URL=https://ks-atlas.com
BOT_CHANNEL_ID=          # Bot commands channel
UPDATES_CHANNEL_ID=      # Patch notes channel
```

---

## Setup Instructions

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create new application named "Atlas"
3. Go to Bot → Add Bot
4. Copy bot token

### 2. Configure Bot

```bash
cd apps/discord-bot
cp .env.example .env
# Edit .env with credentials
```

### 3. Install & Run

```bash
npm install
npm run register  # Register slash commands
npm start         # Start bot
```

### 4. Invite to Server

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2147485696&scope=bot%20applications.commands
```

---

## Deployment Options

### PM2 (Recommended)

```bash
npm install -g pm2
pm2 start src/bot.js --name atlas-bot
pm2 save
pm2 startup
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

### Railway/Render

- Connect GitHub repo
- Set environment variables
- Auto-deploy on push

---

## Brand Compliance

All bot output follows `/docs/BRAND_GUIDE.md`:

- **Voice:** Competitive, analytical, direct, community-powered
- **Colors:** Cyan primary, gold for S-Tier, green for wins, red for losses
- **Terminology:** KvK, Prep Phase, Battle Phase, Atlas Score, Domination

---

## Release Manager Integration

The Release Manager agent should call the webhook API after publishing patch notes:

```python
import httpx

async def post_to_discord(patch_notes: dict):
    await httpx.AsyncClient().post(
        "https://ks-atlas.com/api/discord/webhook/patch-notes",
        json=patch_notes,
        headers={"X-API-Key": os.getenv("DISCORD_API_KEY")}
    )
```

---

## Future Enhancements

- [ ] Scheduled KvK reminders (24h, 1h before)
- [ ] Transfer Event phase notifications
- [ ] User-linked kingdom tracking
- [ ] Leaderboard change alerts
- [ ] Interactive buttons for pagination

---

*Documentation maintained by Platform Engineer*
