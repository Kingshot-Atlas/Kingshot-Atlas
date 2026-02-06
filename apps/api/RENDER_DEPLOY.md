# Deploy API to Render

## Quick Deploy Steps

### 1. Create Render Account
Go to [render.com](https://render.com) and sign up (free).

### 2. Connect GitHub Repository
1. Dashboard → **New** → **Web Service**
2. Connect your GitHub account
3. Select the `Kingshot-Atlas/Kingshot-Atlas` repository

### 3. Configure Service
| Setting | Value |
|---------|-------|
| **Name** | `kingshot-atlas` |
| **Root Directory** | `apps/api` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt && python import_data.py` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| **Plan** | Free |

### 4. Set Environment Variables
In Render dashboard → Environment:

| Key | Value |
|-----|-------|
| `SECRET_KEY` | (click Generate) |
| `ENVIRONMENT` | `production` |
| `ALLOWED_ORIGINS` | `https://ks-atlas.com,https://www.ks-atlas.com,https://ks-atlas.pages.dev` |
| `DATABASE_URL` | Supabase PostgreSQL connection string (set in dashboard) |

### 5. Deploy
Click **Create Web Service** and wait for deployment (~3-5 minutes).

> **Note:** The build command imports kingdom data from CSV files into the database.

### 6. Get Your API URL
After deployment, Render provides a URL like:
```
https://kingshot-atlas.onrender.com
```

### 7. Update Discord Bot
Edit `/apps/discord-bot/.env`:
```env
API_URL=https://kingshot-atlas.onrender.com
```

Restart the bot:
```bash
cd apps/discord-bot
npm start
```

---

## Important Notes

### Free Tier Limitations
- **Spins down after 15 minutes of inactivity**
- First request after sleep takes ~30 seconds
- 750 hours/month free (enough for 24/7 if active)

### Database Persistence
Production uses **Supabase PostgreSQL** for persistent data.
Set `DATABASE_URL` in Render dashboard with your Supabase connection string.

### Keep Alive (Optional)
To prevent sleep, set up a cron job to ping the health endpoint:
```bash
# Every 14 minutes
*/14 * * * * curl -s https://kingshot-atlas.onrender.com/health
```

Or use [UptimeRobot](https://uptimerobot.com) (free) to ping every 5 minutes.

---

## Verify Deployment

Test the API:
```bash
curl https://kingshot-atlas.onrender.com/health
# Should return: {"status":"healthy"}

curl "https://kingshot-atlas.onrender.com/api/leaderboard?limit=1"
# Should return kingdom data
```

---

## Production URL

```
https://kingshot-atlas.onrender.com
```

*Created: 2026-01-29*
*Last deployed: 2026-01-29*
