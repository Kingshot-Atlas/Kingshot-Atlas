# Deployment Guide

## Production URLs

| Component | URL |
|-----------|-----|
| **Frontend** | https://ks-atlas.com |
| **Backend API** | https://kingshot-atlas-api.onrender.com |

## Overview

| Component | Service | Cost |
|-----------|---------|------|
| Frontend | Netlify | $0 (free tier) |
| Backend API | Railway or Render | $5-7/mo |
| Database | Supabase PostgreSQL | $0 (free tier) |
| Domain | ks-atlas.com | ~$12/yr |

**Total: ~$5-7/month + domain**

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
  created_at TIMESTAMPTZ DEFAULT NOW()
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

## 2. Deploy Backend to Railway

### Option A: Railway (Recommended)

1. **Create Railway account** at [railway.app](https://railway.app)

2. **Connect GitHub repo**
   - New Project → Deploy from GitHub
   - Select your repo
   - Set root directory to `apps/api`

3. **Set environment variables**
   ```
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres
   SECRET_KEY=<generate with: openssl rand -hex 32>
   ENVIRONMENT=production
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

4. **Deploy**
   - Railway auto-detects Python and uses the Procfile
   - Your API will be at: `https://your-app.railway.app`

### Option B: Render

1. **Create Render account** at [render.com](https://render.com)

2. **New Web Service**
   - Connect GitHub repo
   - Root directory: `apps/api`
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

3. **Set environment variables** (same as Railway)

4. **Deploy**
   - Your API will be at: `https://your-app.onrender.com`

---

## 3. Deploy Frontend to Netlify

### ⚠️ CRITICAL: Correct Netlify Site Configuration

There are TWO Netlify sites - only deploy to the correct one:

| Site Name | Site ID | Custom Domain | Status |
|-----------|---------|---------------|--------|
| **ks-atlas** | `716ed1c2-eb00-4842-8781-c37fb2823eb8` | ks-atlas.com | ✅ USE THIS ONE |
| kingshot-atlas | `48267beb-2840-44b1-bedb-39d6b2defcd4` | (none) | ❌ DO NOT USE |

### Verify Correct Site Before Deploying

```bash
cd apps/web
npx netlify-cli status
# Should show: Current project: ks-atlas
```

If linked to wrong site, fix with:
```bash
npx netlify-cli unlink
npx netlify-cli link --id 716ed1c2-eb00-4842-8781-c37fb2823eb8
```

### Deploy Commands

```bash
cd apps/web
npm run build
npx netlify-cli deploy --prod --dir=build
```

### Environment Variables (Netlify Dashboard)
   ```
   REACT_APP_API_URL=https://your-api.railway.app
   REACT_APP_SUPABASE_URL=https://xxx.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-anon-key
   REACT_APP_ENVIRONMENT=production
   ```

---

## 4. Custom Domain Setup

### For Netlify (Frontend) - CONFIGURED

**Production domain:** `www.ks-atlas.com`

1. Go to Netlify Dashboard → Domain settings
2. Custom domain `ks-atlas.com` is configured
3. DNS configured:
   - CNAME: `www` → `kingshot-atlas.netlify.app`
   - A record: `@` → Netlify IP
4. HTTPS enabled (Let's Encrypt)

### For Railway/Render (API)

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

### Backend (Railway/Render)

| Variable | Required | Example |
|----------|----------|---------|
| `DATABASE_URL` | Yes | `postgresql://...` |
| `SECRET_KEY` | Yes | `openssl rand -hex 32` |
| `ENVIRONMENT` | No | `production` |
| `ALLOWED_ORIGINS` | Yes | `https://yourdomain.com` |
| `SENTRY_DSN` | No | Sentry DSN |

### Frontend (Netlify)

| Variable | Required | Example |
|----------|----------|---------|
| `REACT_APP_API_URL` | Yes | `https://api.yourdomain.com` |
| `REACT_APP_SUPABASE_URL` | Yes | `https://xxx.supabase.co` |
| `REACT_APP_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `REACT_APP_SENTRY_DSN` | No | Sentry DSN |
| `REACT_APP_ENVIRONMENT` | No | `production` |

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
- Traffic > 1,000 daily users → Upgrade Railway to Pro ($20/mo)
- Database > 500MB → Upgrade Supabase to Pro ($25/mo)
