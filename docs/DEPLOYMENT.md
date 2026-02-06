# Deployment Guide

## Production URLs

| Component | URL |
|-----------|-----|
| **Frontend** | https://ks-atlas.com |
| **Backend API** | https://kingshot-atlas.onrender.com |

## Overview

| Component | Service | Cost |
|-----------|---------|------|
| Frontend | Cloudflare Pages | $0 (free tier) |
| Backend API | Render | $0 (free tier) |
| Database | Supabase PostgreSQL | $0 (free tier) |
| Domain | ks-atlas.com | ~$12/yr |

**Total: ~$1/month + domain** (all free tiers)

---

## 1. Supabase Setup (Database + Auth)

You already have Supabase configured. Make sure these tables exist:

```sql
-- Profiles table (for user data)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  email TEXT,
  avatar_url TEXT,
  home_kingdom INTEGER,
  alliance_tag VARCHAR(3),
  language TEXT,
  region TEXT,
  bio TEXT,
  theme_color TEXT DEFAULT '#22d3ee',
  badge_style TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Linked Kingshot account fields
  linked_player_id TEXT,
  linked_username TEXT,
  linked_avatar_url TEXT,
  linked_kingdom INTEGER,
  linked_tc_level INTEGER
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
```

**Get your connection string:**
1. Go to Supabase Dashboard → Settings → Database
2. Copy the "Connection string" (URI format)
3. It looks like: `postgres://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres`

---

## 2. Deploy Backend to Render

**Current production:** https://kingshot-atlas.onrender.com

1. **Create Render account** at [render.com](https://render.com)

2. **New Web Service**
   - Connect GitHub repo
   - Root directory: `apps/api`
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

3. **Set environment variables**
   ```
   SECRET_KEY=<generate with: openssl rand -hex 32>
   ENVIRONMENT=production
   ALLOWED_ORIGINS=https://ks-atlas.com,https://www.ks-atlas.com,https://ks-atlas.pages.dev
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   STRIPE_SECRET_KEY=your-stripe-key
   STRIPE_WEBHOOK_SECRET=your-webhook-secret
   ```

4. **Deploy**
   - Render auto-deploys from `main` branch
   - Your API will be at: `https://your-app.onrender.com`

> **Note:** Render free tier sleeps after 15 min of inactivity. Use UptimeRobot to keep it awake.

---

## 3. Deploy Frontend to Cloudflare Pages

The frontend auto-deploys from `main` branch via Cloudflare Pages.

### Project Configuration

| Property | Value |
|----------|-------|
| **Project Name** | `ks-atlas` |
| **Production URL** | `https://ks-atlas.com` |
| **Pages URL** | `https://ks-atlas.pages.dev` |
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Build Output** | `dist` |
| **Root Directory** | `apps/web` |

### Deploy Process

```bash
# Push to main triggers auto-deploy
git push origin main

# Or build locally first to verify
cd apps/web
npm run build
```

### Environment Variables (Cloudflare Dashboard)
   ```
   NODE_VERSION=20
   VITE_API_URL=https://kingshot-atlas.onrender.com
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

---

## 4. Custom Domain Setup

### For Cloudflare Pages (Frontend) - CONFIGURED

**Production domain:** `ks-atlas.com`

1. Domain managed via Cloudflare DNS
2. Custom domain `ks-atlas.com` configured in Cloudflare Pages
3. HTTPS enabled automatically

### For Render (API)

1. Go to Settings → Domains
2. Add custom domain (e.g., `api.ks-atlas.com`)
3. Update DNS with provided CNAME
4. Set environment variable:
   ```
   ALLOWED_ORIGINS=https://www.ks-atlas.com,https://ks-atlas.com
   ```

---

## 5. Post-Deployment Checklist

- [ ] Backend health check works: `https://api.yourdomain.com/health`
- [ ] Frontend loads and connects to API
- [ ] Supabase auth works (Google/Discord/Email)
- [ ] Data submissions work
- [ ] Kingdom claims work
- [ ] Admin panel accessible at `/admin`

---

## Environment Variables Reference

### Backend (Render)

| Variable | Required | Example |
|----------|----------|---------|
| `DATABASE_URL` | Yes | `postgresql://...` |
| `SECRET_KEY` | Yes | `openssl rand -hex 32` |
| `ENVIRONMENT` | No | `production` |
| `ALLOWED_ORIGINS` | Yes | `https://yourdomain.com` |
| `SENTRY_DSN` | No | Sentry DSN |

### Frontend (Cloudflare Pages)

| Variable | Required | Example |
|----------|----------|---------|
| `VITE_API_URL` | Yes | `https://kingshot-atlas.onrender.com` |
| `VITE_SUPABASE_URL` | Yes | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `VITE_SENTRY_DSN` | No | Sentry DSN |

---

## Troubleshooting

### CORS Errors
- Ensure `ALLOWED_ORIGINS` includes your frontend domain (with https://)
- Include both `www` and non-www versions

### Database Connection Failed
- Check `DATABASE_URL` format (must start with `postgresql://`)
- Verify Supabase allows connections from Railway/Render IPs

### Auth Not Working
- Check Supabase redirect URLs include your production domain
- Verify anon key is correct in frontend env

---

## Scaling Notes

**Current capacity (free tiers):**
- ~1,000 daily users
- ~50 requests/second
- 500MB database

**When to upgrade:**
- Traffic > 1,000 daily users → Upgrade Render to Pro ($7/mo)
- Database > 500MB → Upgrade Supabase to Pro ($25/mo)
