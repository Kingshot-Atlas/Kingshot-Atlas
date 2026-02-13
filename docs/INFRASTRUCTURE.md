# Infrastructure Reference

**Last Updated:** 2026-02-12  
**Owner:** Ops Lead

---

## Production Services

### Overview

| Component | Platform | Service Name | URL |
|-----------|----------|--------------|-----|
| **Frontend** | Cloudflare Pages | `ks-atlas` | https://ks-atlas.com |
| **Backend API** | Render | `Kingshot-Atlas` | https://kingshot-atlas.onrender.com |
| **Discord Bot** | Render | `Atlas-Discord-bot` | N/A (background service) |
| **Database** | Supabase | `qdczmafwcvnwfvixxbwg` | https://qdczmafwcvnwfvixxbwg.supabase.co |
| **Payments** | Stripe | `Kingshot Atlas` | Dashboard at stripe.com |

### Supabase Schema

**profiles table** (subscription columns added 2026-01-30):
- `subscription_tier` TEXT DEFAULT 'free' — User's subscription tier (free/supporter/recruiter)
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
- `ALLOWED_ORIGINS` - `https://ks-atlas.com,https://www.ks-atlas.com,https://ks-atlas.pages.dev`
- `STRIPE_SECRET_KEY` - Stripe live/test secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin ops)

### 2. Atlas-Discord-bot

| Property | Value |
|----------|-------|
| **Name** | `Atlas-Discord-bot` |
| **Service ID** | `srv-d5too04r85hc73ej2b00` |
| **URL** | `https://atlas-discord-bot-trnf.onrender.com` |
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

## Cloudflare Pages (Frontend)

### ks-atlas Project

| Property | Value |
|----------|-------|
| **Project Name** | `ks-atlas` |
| **Production URL** | `https://ks-atlas.pages.dev` |
| **Custom Domain** | `https://ks-atlas.com` |
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Build Output Directory** | `dist` |
| **Root Directory** | `apps/web` |

### Environment Variables (set in Cloudflare Dashboard)

| Variable | Value |
|----------|-------|
| `NODE_VERSION` | `20` |
| `VITE_API_URL` | `https://kingshot-atlas.onrender.com` |
| `VITE_SUPABASE_URL` | `https://qdczmafwcvnwfvixxbwg.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *(copy from current .env)* |

### Configuration Files

- `apps/web/public/_headers` — Security headers (CSP, HSTS, etc.)
- `apps/web/public/_redirects` — SPA routing fallback

### Why Cloudflare Pages?

Migrated from Netlify on 2026-02-01 for:
- **Unlimited free deploys** (Netlify charges 15 credits/$0.15 per deploy)
- **Unlimited bandwidth** (Netlify caps at 100GB)
- **Faster global CDN** (300+ edge locations vs ~25)
- **Enterprise-grade DDoS protection**

---

## URL Quick Reference

```bash
# Frontend
https://ks-atlas.com                    # Primary (custom domain)
https://www.ks-atlas.com                # Redirects to primary
https://ks-atlas.pages.dev              # Cloudflare Pages subdomain

# API
https://kingshot-atlas.onrender.com     # Production API

# Health Checks
curl https://ks-atlas.com               # Frontend
curl https://kingshot-atlas.onrender.com/health  # API

# Test Stripe
curl -X POST https://kingshot-atlas.onrender.com/api/v1/stripe/checkout \
  -H "Content-Type: application/json" \
  -d '{"tier":"supporter","billing_cycle":"monthly","user_id":"test"}'
```

---

## Common Issues

### "Wrong API URL" Confusion

The Render service is named `Kingshot-Atlas` which generates URL `kingshot-atlas.onrender.com`.

**There is NO `kingshot-atlas-api.onrender.com` service.**

If you see `-api` in any URL reference, it's wrong and should be fixed.

### Free Tier Sleep

Render free tier sleeps after 15 minutes of inactivity. First request after sleep takes ~30 seconds.

**Solution:** Use UptimeRobot to ping health endpoints every 5-10 minutes:

| Service | Health Endpoint | Monitor |
|---------|-----------------|---------|
| API | `https://kingshot-atlas.onrender.com/health` | Required |
| Discord Bot | `https://atlas-discord-bot-trnf.onrender.com/health` | **CRITICAL** - Bot goes offline without this |

### Setting Up UptimeRobot (Free)

1. Go to https://uptimerobot.com and create free account
2. Add New Monitor → HTTP(s)
3. For Discord Bot:
   - URL: `https://atlas-discord-bot-trnf.onrender.com/health`
   - Interval: 5 minutes
   - Alert contacts: Your email
4. For API (optional but recommended):
   - URL: `https://kingshot-atlas.onrender.com/health`
   - Interval: 10 minutes

---

## Files That Reference Infrastructure

Update these files when infrastructure changes:

| File | Contains |
|------|----------|
| `apps/web/public/_headers` | Security headers (CSP, caching) |
| `apps/web/public/_redirects` | SPA routing rules |
| `apps/discord-bot/.env` | `API_URL` |
| `apps/discord-bot/.env.example` | `API_URL` |
| `apps/api/render.yaml` | Service name |
| `docs/DEPLOYMENT.md` | URLs table |
| `docs/LAUNCH_CHECKLIST.md` | Setup instructions |
| `docs/DISCORD_BOT.md` | API URL |
| `apps/api/README.md` | Deploy instructions, architecture, routers |

---

## Email & DNS Authentication

### Email Flow
- **Outbound:** Resend API (Amazon SES) → `support@ks-atlas.com`
- **Inbound:** Cloudflare Email Routing → `atlas-email-worker` → Supabase `support_emails` table

### DNS Records (Cloudflare)

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:gatreno.investing@gmail.com; pct=100; adkim=s; aspf=r` | DMARC policy |
| TXT | `ks-atlas.com` | `v=spf1 include:_spf.mx.cloudflare.net ~all` | SPF for inbound (Cloudflare Email Routing) |
| TXT | `send.ks-atlas.com` | `v=spf1 include:amazonses.com ~all` | SPF for outbound (Resend/SES) |
| CNAME | `resend._domainkey` | *(Resend-provided value)* | DKIM signing for outbound emails |
| MX | `ks-atlas.com` | `route1/2/3.mx.cloudflare.net` | Inbound email routing |

### DMARC Alignment Notes
- **DKIM alignment:** strict (`adkim=s`) — DKIM domain must exactly match From header
- **SPF alignment:** relaxed (`aspf=r`) — SPF domain can be a subdomain of From header
- **Why relaxed SPF:** Resend uses `send.ks-atlas.com` as envelope-from, but From header is `ks-atlas.com`. Strict SPF alignment would fail because `send.ks-atlas.com ≠ ks-atlas.com`. Relaxed allows subdomain matching.
- **DMARC reports:** Sent to `gatreno.investing@gmail.com` (via `rua` tag)

### Troubleshooting Email Auth
```bash
# Check DMARC record
dig TXT _dmarc.ks-atlas.com +short

# Check SPF records
dig TXT ks-atlas.com +short
dig TXT send.ks-atlas.com +short

# Check DKIM
dig CNAME resend._domainkey.ks-atlas.com +short
```

---

*Maintained by Ops Lead*
