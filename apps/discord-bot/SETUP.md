# Atlas Discord Bot - Setup Guide

**Complete step-by-step guide to deploy Atlas to your Discord server.**

---

## Prerequisites

- Node.js 18+ installed
- Access to Discord Developer Portal
- Admin access to your Discord server

---

## Step 1: Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"**
3. Name: **Atlas**
4. Click **Create**

### Get Application ID
1. Go to **General Information**
2. Copy **Application ID** → This is your `DISCORD_CLIENT_ID`

### Create Bot
1. Go to **Bot** section (left sidebar)
2. Click **"Add Bot"** → Confirm
3. Click **"Reset Token"** → Copy token → This is your `DISCORD_TOKEN`
4. **IMPORTANT:** Keep this token secret!

### Set Bot Permissions
Under **Bot** section:
- ✅ Public Bot (optional - allows others to invite)
- ❌ Requires OAuth2 Code Grant

Under **Privileged Gateway Intents**:
- ❌ Presence Intent (not needed)
- ❌ Server Members Intent (not needed)
- ❌ Message Content Intent (not needed for slash commands)

---

## Step 2: Get Server & Channel IDs

### Enable Developer Mode
1. Discord Settings → Advanced → **Developer Mode** → ON

### Get Server ID
1. Right-click your server icon
2. Click **"Copy Server ID"** → This is your `DISCORD_GUILD_ID`

### Get Channel IDs
Right-click each channel → **"Copy Channel ID"**:
- `#patch-notes` → `PATCH_NOTES_CHANNEL_ID`
- `#announcements` → `ANNOUNCEMENTS_CHANNEL_ID`
- `#atlas-commands` → `ATLAS_COMMANDS_CHANNEL_ID`

---

## Step 3: Create Webhooks

### For #patch-notes
1. Click ⚙️ next to `#patch-notes`
2. Go to **Integrations** → **Webhooks**
3. Click **"New Webhook"**
4. Name: **Atlas**
5. Avatar: Upload `AtlasBotAvatar.webp` from `/apps/web/public/`
6. Click **"Copy Webhook URL"** → This is your `DISCORD_PATCH_NOTES_WEBHOOK`

### For #announcements (optional)
Repeat the same process for major release announcements.

---

## Step 4: Configure Environment

```bash
cd apps/discord-bot
cp .env.example .env
```

Edit `.env` with your values:
```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here
DISCORD_GUILD_ID=your_server_id_here
DISCORD_PATCH_NOTES_WEBHOOK=https://discord.com/api/webhooks/...
API_URL=https://ks-atlas.com
```

---

## Step 5: Install Dependencies

```bash
cd apps/discord-bot
npm install
```

---

## Step 6: Invite Bot to Server

Generate invite URL (replace `YOUR_CLIENT_ID`):
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2147485696&scope=bot%20applications.commands
```

Or use the Developer Portal:
1. Go to **OAuth2** → **URL Generator**
2. Scopes: ✅ `bot`, ✅ `applications.commands`
3. Bot Permissions: ✅ `Send Messages`, ✅ `Embed Links`, ✅ `Use Slash Commands`
4. Copy and open the generated URL
5. Select your server → Authorize

---

## Step 7: Register Commands

```bash
npm run register
```

Expected output:
```
🔄 Registering slash commands...
📋 Commands: kingdom, compare, leaderboard, tier, top, upcoming, countdown, random, help
✅ Commands registered for guild [your_guild_id]
💡 Guild commands are available immediately!
```

---

## Step 8: Start the Bot

```bash
npm start
```

Expected output:
```
✅ Atlas is online as Atlas#1234
📊 Serving 1 server(s)
🔗 API: https://ks-atlas.com

"Know your enemy. Choose your allies. Dominate KvK."
```

---

## Step 9: Test Commands

In `#atlas-commands`, try:
- `/help` - Should show all commands
- `/kingdom 172` - Should show kingdom stats
- `/leaderboard` - Should show top 10

---

## Step 10: Test Webhook

```bash
npm run webhook:test
```

Check `#patch-notes` for the test message.

---

## Step 11: Pin Help Message

Pin this in `#atlas-commands`:

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

## Production Deployment

### Option A: PM2 (Recommended for VPS)
```bash
npm install -g pm2
pm2 start src/bot.js --name atlas-bot
pm2 save
pm2 startup
```

### Option B: Railway
1. Connect GitHub repo
2. Set environment variables in Railway dashboard
3. Deploy

### Option C: Render
1. Create new Web Service
2. Connect repo, set root to `apps/discord-bot`
3. Build: `npm install`
4. Start: `npm start`
5. Add environment variables

---

## Troubleshooting

### Commands not showing
- Wait up to 1 hour for global commands
- Or set `DISCORD_GUILD_ID` for instant guild commands
- Run `npm run register` again

### Bot offline
- Check `DISCORD_TOKEN` is correct
- Verify bot is invited to server

### API errors
- Verify `API_URL=https://ks-atlas.com`
- Check API is accessible

### Webhook not posting
- Verify webhook URL is correct
- Check bot has permissions in channel

---

## Quick Reference

| Variable | Where to Find |
|----------|---------------|
| `DISCORD_TOKEN` | Developer Portal → Bot → Token |
| `DISCORD_CLIENT_ID` | Developer Portal → General Information → Application ID |
| `DISCORD_GUILD_ID` | Right-click server → Copy Server ID |
| `DISCORD_PATCH_NOTES_WEBHOOK` | Channel Settings → Integrations → Webhooks |

---

*Setup guide for Atlas Discord Bot - Kingshot Atlas*
