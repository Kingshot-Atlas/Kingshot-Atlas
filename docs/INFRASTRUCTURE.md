# Infrastructure Reference

**Last Updated:** 2026-01-30  
**Owner:** Ops Lead

---

## Production Services

### Overview

| Component | Platform | Service Name | URL |
|-----------|----------|--------------|-----|
| **Frontend** | Netlify | `ks-atlas` | https://ks-atlas.com |
| **Backend API** | Render | `Kingshot-Atlas` | https://kingshot-atlas.onrender.com |
| **Discord Bot** | Render | `Atlas-Discord-bot` | N/A (background service) |
| **Database** | Supabase | `qdczmafwcvnwfvixxbwg` | https://qdczmafwcvnwfvixxbwg.supabase.co |
| **Payments** | Stripe | `Kingshot Atlas` | Dashboard at stripe.com |

### Supabase Schema

**profiles table** (subscription columns added 2026-01-30):
- `subscription_tier` TEXT DEFAULT 'free' — User's subscription tier (free/pro/recruiter)
- `stripe_customer_id` TEXT — Stripe customer ID for billing
- `stripe_subscription_id` TEXT — Active Stripe subscription ID

---

## Render Services (2 Active)

### 1. Kingshot-Atlas (API)

| Property | Value |
|----------|-------|
| **Name** | `Kingshot-Atlas` |
| **URL** | `https://kingshot-atlas.onrender.com` |
| **Runtime** | Python 3 |
| **Region** | Virginia |
| **Plan** | Free |
| **Root Directory** | `apps/api` |
| **Build Command** | `pip install -r requirements.txt && python import_data.py` |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

**Required Environment Variables:**
- `SECRET_KEY` - Generated secret
- `ENVIRONMENT` - `production`
- `ALLOWED_ORIGINS` - `https://ks-atlas.com,https://www.ks-atlas.com`
- `STRIPE_SECRET_KEY` - Stripe live/test secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin ops)

### 2. Atlas-Discord-bot

| Property | Value |
|----------|-------|
| **Name** | `Atlas-Discord-bot` |
| **Runtime** | Node |
| **Region** | Virginia |
| **Plan** | Free |
| **Root Directory** | `apps/discord-bot` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

**Required Environment Variables:**
- `DISCORD_TOKEN` - Bot token from Discord Developer Portal
- `DISCORD_CLIENT_ID` - Application ID
- `DISCORD_GUILD_ID` - Server ID
- `API_URL` - `https://kingshot-atlas.onrender.com`

---

## Netlify Site

### ks-atlas (Frontend)

| Property | Value |
|----------|-------|
| **Site Name** | `ks-atlas` |
| **Site ID** | `716ed1c2-eb00-4842-8781-c37fb2823eb8` |
| **URL** | `https://ks-atlas.netlify.app` |
| **Custom Domain** | `https://ks-atlas.com` |
| **Build Directory** | `apps/web` |
| **Publish Directory** | `build` |

⚠️ **WARNING:** There is an OLD duplicate site `kingshot-atlas` (ID: `48267beb-2840-44b1-bedb-39d6b2defcd4`) - **DO NOT deploy to this one!**

**Build Environment Variables (in netlify.toml):**
- `VITE_API_URL` - `https://kingshot-atlas.onrender.com`

---

## URL Quick Reference

```bash
# Frontend
https://ks-atlas.com                    # Primary (custom domain)
https://www.ks-atlas.com                # Redirects to primary
https://ks-atlas.netlify.app            # Netlify subdomain

# API
https://kingshot-atlas.onrender.com     # Production API

# Health Checks
curl https://ks-atlas.com               # Frontend
curl https://kingshot-atlas.onrender.com/health  # API

# Test Stripe
curl -X POST https://kingshot-atlas.onrender.com/api/v1/stripe/checkout \
  -H "Content-Type: application/json" \
  -d '{"tier":"pro","billing_cycle":"monthly","user_id":"test"}'
```

---

## Common Issues

### "Wrong API URL" Confusion

The Render service is named `Kingshot-Atlas` which generates URL `kingshot-atlas.onrender.com`.

**There is NO `kingshot-atlas-api.onrender.com` service.**

If you see `-api` in any URL reference, it's wrong and should be fixed.

### Free Tier Sleep

Render free tier sleeps after 15 minutes of inactivity. First request after sleep takes ~30 seconds.

**Solution:** Use UptimeRobot to ping `/health` every 5-14 minutes.

---

## Files That Reference Infrastructure

Update these files when infrastructure changes:

| File | Contains |
|------|----------|
| `apps/web/netlify.toml` | `VITE_API_URL` |
| `apps/discord-bot/.env` | `API_URL` |
| `apps/discord-bot/.env.example` | `API_URL` |
| `apps/api/render.yaml` | Service name |
| `apps/discord-bot/render.yaml` | `API_URL` |
| `docs/DEPLOYMENT.md` | URLs table |
| `docs/LAUNCH_CHECKLIST.md` | Setup instructions |
| `docs/DISCORD_BOT.md` | API URL |
| `apps/api/RENDER_DEPLOY.md` | Deploy instructions |

---

*Maintained by Ops Lead*
