# Launch Checklist for ks-atlas.gg

**Target Domain:** https://www.ks-atlas.com  
**Created:** 2026-01-27  
**Status:** Pre-Launch

---

## 💰 ZERO-COST HOSTING STACK (Recommended)

| Service | Cost | Free Tier Limits |
|---------|------|------------------|
| **Netlify** (Frontend) | $0 | 100GB bandwidth, 300 build mins/month |
| **Render** (Backend API) | $0 | Sleeps after 15min inactivity, wakes on request (~30s cold start) |
| **Supabase** (PostgreSQL) | $0 | 500MB database, 2GB bandwidth |
| **Domain** | ~$6.99/year (first year), $14.98/year after | Required purchase |
| **Sentry** | $0 | 5K errors/month |
| **UptimeRobot** | $0 | 50 monitors |

**Total: ~$6.99/year (first year), $14.98/year after (domain only)**

### Trade-offs of Free Tier
- **Render free tier**: API sleeps after 15 min of inactivity. First request after sleep takes ~30 seconds. Subsequent requests are fast.
- **Supabase free tier**: 500MB storage limit. Sufficient for thousands of kingdoms.
- **Solution for sleep**: UptimeRobot pings API every 14 minutes to keep it awake (free workaround)

---

## 🚀 QUICK DEPLOY (5 Steps)

### Step 1: Register Domain (~5 min)
1. Go to [Namecheap](https://namecheap.com) or [Cloudflare](https://cloudflare.com)
2. Search for `ks-atlas.com`
3. Purchase (~$6.99/year)
4. Enable WHOIS privacy (usually free)

### Step 2: Deploy Backend to Render (~10 min)
1. Go to [render.com](https://render.com) → Sign up with GitHub
2. Click **New** → **Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Name**: `kingshot-atlas-api`
   - **Root Directory**: `apps/api`
   - **Runtime**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free
5. Add Environment Variables:
   - `SECRET_KEY`: Click "Generate" or run `openssl rand -hex 32`
   - `ALLOWED_ORIGINS`: `https://www.ks-atlas.com,https://ks-atlas.com`
   - `ENVIRONMENT`: `production`
6. Click **Create Web Service**
7. Wait for deploy → Copy your URL (e.g., `https://kingshot-atlas-api.onrender.com`)

### Step 3: Set Up Supabase Database (~10 min)
1. Go to [supabase.com](https://supabase.com) → Create account
2. Create new project → Choose a region close to your users
3. Go to **Settings** → **Database** → Copy **Connection string (URI)**
4. In Render dashboard, add environment variable:
   - `DATABASE_URL`: Paste the Supabase connection string
5. Redeploy on Render

### Step 4: Deploy Frontend to Netlify (~10 min)
1. Go to [netlify.com](https://netlify.com) → Sign up with GitHub
2. Click **Add new site** → **Import an existing project**
3. Connect your GitHub repo
4. Configure:
   - **Base directory**: `apps/web`
   - **Build command**: `npm run build`
   - **Publish directory**: `apps/web/build`
5. Add Environment Variables:
   - `REACT_APP_API_URL`: Your Render URL (e.g., `https://kingshot-atlas-api.onrender.com`)
   - `REACT_APP_ENVIRONMENT`: `production`
6. Click **Deploy**

### Step 5: Connect Domain (~15 min)
1. In Netlify → **Site settings** → **Domain management**
2. Click **Add custom domain** → Enter `ks-atlas.com`
3. Click **Add custom domain** → Enter `www.ks-atlas.com`
4. Netlify will show DNS records to add
5. In your domain registrar (Namecheap/Cloudflare):
   - Add CNAME: `www` → `[your-site].netlify.app`
   - Add A record: `@` → Netlify's IP (shown in dashboard)
6. Wait for DNS propagation (5 min to 48 hours)
7. Netlify auto-provisions SSL certificate

---

## ✅ Code Already Updated

All URLs have been updated to `www.ks-atlas.com`:
- [x] `apps/web/public/index.html` - OG tags, canonical, Schema.org (updated to ks-atlas.com)
- [x] `apps/web/public/robots.txt` - Sitemap URL (updated to ks-atlas.com)
- [x] `apps/web/public/sitemap.xml` - All page URLs (updated to ks-atlas.com)
- [x] `apps/api/render.yaml` - ALLOWED_ORIGINS (updated to ks-atlas.com)
- [x] `apps/web/netlify.toml` - Build config, security headers, caching

---

## 📋 Post-Deploy Checklist

### Verify Deployment
- [ ] Frontend loads at `https://www.ks-atlas.com`
- [ ] API responds at `https://your-api.onrender.com/health`
- [ ] Kingdom data loads on homepage
- [ ] All pages work (Directory, Profile, Compare, Leaderboards)

### Keep API Awake (Free Workaround)
1. Go to [UptimeRobot.com](https://uptimerobot.com) → Create free account
2. Add monitor:
   - **Type**: HTTP(s)
   - **URL**: `https://your-api.onrender.com/health`
   - **Interval**: 5 minutes
3. This prevents the API from sleeping!

### SEO Setup
- [ ] Go to [Google Search Console](https://search.google.com/search-console)
- [ ] Add property: `https://www.ks-atlas.com`
- [ ] Verify with DNS TXT record
- [ ] Submit sitemap: `https://www.ks-atlas.com/sitemap.xml`

### Social Preview Test
- [ ] Test at [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [ ] Test at [Facebook Debugger](https://developers.facebook.com/tools/debug/)
- [ ] Test at [LinkedIn Inspector](https://www.linkedin.com/post-inspector/)

---

## 🔧 Database Import (One-time)

After Supabase is connected, import your kingdom data:

```bash
# SSH into Render (or run locally with DATABASE_URL set)
cd apps/api
python import_data.py
```

Or use Supabase's SQL editor to run migrations manually.

---

## 📊 Optional Upgrades (When Ready)

| Upgrade | Cost | Benefit |
|---------|------|---------|
| Render Starter | $7/month | No sleep, faster response |
| Supabase Pro | $25/month | 8GB database, daily backups |
| Plausible Analytics | $9/month | Privacy-friendly analytics |
| Custom email | ~$6/month | hello@ks-atlas.com |

---

## ⚡ Launch Day Checklist

- [ ] Domain DNS propagated (check with `dig ks-atlas.com`)
- [ ] HTTPS working on both `ks-atlas.com` and `www.ks-atlas.com`
- [ ] API connected and responding
- [ ] All pages loading correctly
- [ ] UptimeRobot monitoring active
- [ ] Social sharing previews working
- [ ] Sitemap submitted to Google

---

*Document maintained by Business & Maintenance Specialist*
