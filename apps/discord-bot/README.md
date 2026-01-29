# Atlas Discord Bot

> "Know your enemy. Choose your allies. Dominate KvK."

Atlas is the official Discord bot for Kingshot Atlas — a data-driven companion for competitive Kingshot players.

![Atlas Avatar](../web/public/AtlasBotAvatar.webp)

---

## Features

### 🔍 Lookup Commands
| Command | Description | Engagement Value |
|---------|-------------|------------------|
| `/kingdom <number>` | Get detailed stats for any kingdom | Quick data access keeps users coming back |
| `/compare <k1> <k2>` | Compare two kingdoms head-to-head | Sparks discussion and debates |
| `/tier <S\|A\|B\|C\|D>` | Browse kingdoms by tier | Find kingdoms at your level |
| `/random` | Discover a random kingdom | Fun discovery feature |

### 📊 Rankings
| Command | Description | Engagement Value |
|---------|-------------|------------------|
| `/leaderboard` | Top 10 kingdoms by Atlas Score | Competitive players check rankings |
| `/top <prep\|battle>` | Top 10 by phase win rate | Phase-specific insights |

### 📅 Events
| Command | Description | Engagement Value |
|---------|-------------|------------------|
| `/upcoming` | Next KvK and Transfer Event dates | Time-sensitive info drives return visits |
| `/countdown` | Live countdown to next KvK | Urgency and excitement |

### 📖 Help
| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |

---

## Setup Guide

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"**
3. Name it **"Atlas"** (or your preferred name)
4. Go to **Bot** section → Click **"Add Bot"**
5. Copy the **Bot Token** (keep this secret!)
6. Under **Privileged Gateway Intents**, enable:
   - None required for slash commands only

### 2. Get Application ID

1. Go to **General Information**
2. Copy the **Application ID** (this is your Client ID)

### 3. Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Fill in:
```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here
DISCORD_GUILD_ID=your_test_server_id  # Optional, for faster dev
API_URL=https://ks-atlas.com
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Register Commands

```bash
# Register slash commands with Discord
npm run register
```

**Note:** Global commands take up to 1 hour to appear. For instant testing, set `DISCORD_GUILD_ID` in `.env`.

### 6. Invite Bot to Server

Generate an invite URL:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2147485696&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with your Application ID.

**Permissions included:**
- Send Messages
- Embed Links
- Use Slash Commands

### 7. Start the Bot

```bash
# Production
npm start

# Development (auto-restart on changes)
npm run dev
```

---

## Webhook Integration

Atlas can post automated updates to Discord channels via webhooks.

### Setting Up Webhooks

1. In Discord, go to your **#updates** channel
2. Click **Edit Channel** → **Integrations** → **Webhooks**
3. Click **"New Webhook"**
4. Name it **"Atlas"**
5. Copy the **Webhook URL**
6. Add to `.env`:
   ```env
   DISCORD_PATCH_NOTES_WEBHOOK=https://discord.com/api/webhooks/...
   ```

### Posting Patch Notes

**Via API (recommended for automation):**
```bash
curl -X POST https://ks-atlas.com/api/discord/webhook/patch-notes \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "date": "January 29, 2026",
    "new": ["Added Discord bot integration"],
    "fixed": ["Fixed timezone display"],
    "improved": ["Faster loading times"]
  }'
```

**Via Test Script:**
```bash
npm run webhook:test
```

### Available Webhook Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/discord/webhook/patch-notes` | Regular update announcements |
| `POST /api/discord/webhook/major-release` | Big feature releases |
| `POST /api/discord/webhook/maintenance` | Scheduled maintenance notices |
| `POST /api/discord/webhook/status` | Outage/resolution updates |

---

## Project Structure

```
apps/discord-bot/
├── package.json           # Dependencies and scripts
├── .env.example           # Environment template
├── README.md              # This file
└── src/
    ├── bot.js             # Main entry point
    ├── config.js          # Centralized configuration
    ├── register-commands.js  # Command registration script
    ├── webhook-test.js    # Webhook testing script
    ├── commands/
    │   ├── index.js       # Command definitions
    │   └── handlers.js    # Command business logic
    ├── services/
    │   └── webhook.js     # Webhook posting service
    └── utils/
        ├── api.js         # API client utilities
        ├── embeds.js      # Discord embed builders
        └── events.js      # KvK/Transfer event calculations
```

---

## Brand Compliance

Atlas follows the Kingshot Atlas brand guide:

### Voice
- **Competitive** — Speak to players who want to win
- **Analytical** — Facts over opinions, data over rumors
- **Direct** — No corporate fluff, get to the point
- **Community-powered** — Built by players, for players

### Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Primary (Cyan) | `#22d3ee` | Main accent |
| Gold | `#fbbf24` | S-Tier, highlights |
| Success | `#22c55e` | Wins, positive |
| Warning | `#eab308` | Prep phase |
| Error | `#ef4444` | Losses, negative |
| Orange | `#f97316` | Battle phase |

### Terminology
- Use **KvK** (not "Kingdom vs Kingdom" after first use)
- Use **Prep Phase** / **Battle Phase**
- Use **Transfer Event** (not "Migration Event")
- Use **Atlas Score** (not "Rating" or "Points")
- Use **Domination** (not "Double win")

---

## Recommended Server Setup

### Actual Server Structure

```
📢 ATLAS BILLBOARD
├── #announcements    ← Major announcements
└── #patch-notes      ← Patch notes webhook posts here

💬 ATLAS COMMUNITY
├── #general          ← General discussion
├── #suggestions      ← Ideas from members
├── #bugs             ← Bug reports from members
└── #atlas-commands   ← Users issue bot commands here
```

### Bot Channel Instructions
Pin this message in `#atlas-commands`:

```
🤖 **Atlas Bot Commands**

Use these commands to access Kingshot Atlas data:

**Lookup:**
• `/kingdom 172` - Get kingdom stats
• `/compare 172 247` - Compare kingdoms
• `/tier S` - Browse S-Tier kingdoms
• `/random` - Discover a random kingdom

**Rankings:**
• `/leaderboard` - Top 10 overall
• `/top prep` - Top 10 by Prep win rate

**Events:**
• `/upcoming` - Next KvK and Transfer dates
• `/countdown` - Time until next KvK

**Help:**
• `/help` - Show all commands

🌐 Full data at https://ks-atlas.com
```

---

## Troubleshooting

### Commands not appearing
- Global commands take up to 1 hour
- For instant testing, set `DISCORD_GUILD_ID` in `.env`
- Run `npm run register` again

### "Unknown interaction" errors
- Bot may have restarted during command execution
- Ensure bot stays running with a process manager

### API errors
- Check `API_URL` in `.env`
- Verify API is accessible from bot's network

### Webhook not posting
- Verify webhook URL is correct
- Check Discord channel permissions
- Test with `npm run webhook:test`

---

## Deployment

### Option 1: PM2 (Recommended)
```bash
npm install -g pm2
pm2 start src/bot.js --name atlas-bot
pm2 save
pm2 startup
```

### Option 2: Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

### Option 3: Railway/Render
- Connect GitHub repo
- Set environment variables
- Deploy automatically on push

---

## Release Manager Integration

The Release Manager agent posts patch notes every 3 days. Integration flow:

```
Release Manager compiles patch notes
        ↓
Saves to /docs/releases/PATCH_NOTES_YYYY-MM-DD.md
        ↓
Calls POST /api/discord/webhook/patch-notes
        ↓
Atlas posts formatted embed to #updates
        ↓
Users see update in Discord
```

### Automation Script (for Release Manager)

```python
import httpx
import os

async def post_patch_notes_to_discord(patch_notes: dict):
    """Post patch notes to Discord via API"""
    api_url = os.getenv("API_URL", "https://ks-atlas.com")
    api_key = os.getenv("DISCORD_API_KEY")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{api_url}/api/discord/webhook/patch-notes",
            json=patch_notes,
            headers={"X-API-Key": api_key}
        )
        return response.json()
```

---

## Contributing

1. Follow the brand guide
2. Test commands locally before deploying
3. Update documentation for new features
4. Log changes in worklog for Release Manager

---

*Built by Kingdom 172. Data-driven dominance.*
