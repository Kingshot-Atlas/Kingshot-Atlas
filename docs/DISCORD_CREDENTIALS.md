# Discord Bot Credentials Reference

**⚠️ SENSITIVE - Do not share publicly**

## Bot Information
- **Bot Name:** Atlas
- **Bot Tag:** Atlas#6732
- **Application ID:** 1465531618965061672

## Server Information
- **Server Name:** Kingshot Atlas
- **Server ID:** 1128775375477018775

## Channel IDs
| Channel | ID | Purpose |
|---------|-----|---------|
| #announcements | 1465719633238556703 | Major releases |
| #patch-notes | 1465931103482155073 | Automated patch notes |
| #general | 1465021959065698386 | General discussion |
| #suggestions | 1465741454700707982 | Member ideas |
| #bugs | 1466084333470351523 | Bug reports |
| #atlas-commands | 1466406083428876410 | Bot commands |

## Webhooks
| Channel | Webhook ID |
|---------|------------|
| #patch-notes | 1466413173052670106 |

## Configuration Files
- **Bot .env:** `/apps/discord-bot/.env`
- **API .env:** `/apps/api/.env` (add `DISCORD_PATCH_NOTES_WEBHOOK`)

## Quick Commands
```bash
# Start bot
cd apps/discord-bot && npm start

# Register commands (if changed)
npm run register

# Test webhook
npm run webhook:test
```

## Invite URL
```
https://discord.com/api/oauth2/authorize?client_id=1465531618965061672&permissions=2147485696&scope=bot%20applications.commands
```

---
*Created: 2026-01-29*
