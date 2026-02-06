# Kingshot Atlas

🌐 **Live:** [https://ks-atlas.com](https://ks-atlas.com)

[![CI](https://github.com/Kingshot-Atlas/Kingshot-Atlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Kingshot-Atlas/Kingshot-Atlas/actions/workflows/ci.yml)

Kingshot Atlas is an all-in-one kingdom database for the game Kingshot.

It helps:
- **Players** find a kingdom that fits their needs (performance, status, experience).
- **Kingdom managers** attract recruits with transparent kingdom profiles and history.
- The community collaborate through submissions, reviews, and verified insights.

## Game Context
- **KvK (Kingdom vs Kingdom)** events are held **monthly**
- **Transfer Events** are held **every 2 months**

## Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, TailwindCSS |
| Backend | FastAPI, SQLAlchemy, Pydantic |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Google, Discord) |
| Monitoring | Sentry |
| Deployment | Cloudflare Pages (frontend), Render (backend) |

---

## Prerequisites

- **Python 3.11+** (tested with 3.13)
- **Node.js 18+** and npm
- Git

---

## Quick Start

### 1. Clone and Setup

```bash
git clone <repo-url>
cd "Kingshot Atlas"

# Create Python virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Backend Setup

```bash
cd apps/api

# Install dependencies
pip install -r requirements.txt

# Configure environment (copy example and edit)
cp .env.example .env
# Edit .env and set SECRET_KEY (required)

# Import kingdom data
python import_data.py

# Start development server
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Backend runs at: **http://127.0.0.1:8000**  
API docs at: **http://127.0.0.1:8000/docs**

### 3. Frontend Setup

```bash
cd apps/web

# Install dependencies
npm install

# Configure environment (optional)
cp .env.example .env.local
# Edit .env.local if needed

# Start development server
npm start
```

Frontend runs at: **http://localhost:3000**

### 4. Verify Setup

```bash
# Test backend API
curl http://127.0.0.1:8000/api/kingdoms?search=1001

# Frontend should load and display kingdom data
open http://localhost:3000
```

---

## Environment Variables

### Backend (`apps/api/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | ✅ Yes | JWT signing key (generate with `openssl rand -hex 32`) |
| `DATABASE_URL` | No | Database connection string (default: Supabase PostgreSQL) |
| `SENTRY_DSN` | No | Sentry error tracking DSN |
| `ENVIRONMENT` | No | `development` or `production` |

### Frontend (`apps/web/.env.local`)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Backend API URL (default: `http://127.0.0.1:8000`) |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `VITE_SENTRY_DSN` | No | Sentry error tracking DSN |

---

## Project Structure

```
Kingshot Atlas/
├── apps/
│   ├── api/                 # FastAPI backend
│   │   ├── api/routers/     # API route handlers
│   │   ├── main.py          # App entry point
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── database.py      # DB connection
│   │   └── import_data.py   # Data import script
│   └── web/                 # React frontend
│       ├── src/
│       │   ├── components/  # Reusable UI components
│       │   ├── pages/       # Route pages
│       │   ├── contexts/    # React contexts
│       │   ├── services/    # API client
│       │   ├── constants/   # Shared constants
│       │   └── types/       # TypeScript types
│       └── public/
├── data/
│   ├── raw/                 # Source data files
│   └── processed/           # Processed CSVs for import
└── docs/                    # Documentation
```

---

## Core Pages
- **Kingdom Directory** (`/`) - Main page with search, filters, grid/table view
- **Kingdom Profile** (`/kingdom/:id`) - Detailed stats + recent KVKs
- **Compare Kingdoms** (`/compare`) - Side-by-side comparison
- **Rankings** (`/rankings`) - Rankings by various metrics
- **User Profile** (`/profile`) - User settings, linked accounts, review activity

---

## Kingdom Profile Fields (Current)

### Stats Displayed
- **Atlas Score** - Bayesian-adjusted performance metric
- **Atlas Score Rank** - Position among all kingdoms  
- **Power Tier** (S/A/B/C) - Based on Atlas Score thresholds
- **Total KvKs** - Battles participated
- **Prep Win Rate + Streak**
- **Battle Win Rate + Streak**
- **Dominations / Invasions** - Recent double wins/losses

### Current Status
- Most Recent Kingdom Status: Currently shows "Unannounced" for all

### History
- Last 5 KvKs displayed:
  - KvK number
  - Opponent kingdom
  - Prep result (Win/Loss)
  - Battle result (Win/Loss)
  - Overall result

### Community
- Reviews stored in Supabase with full CRUD, helpful voting, reply system
- Auth via Supabase (Google, Discord, Email)

---

## Atlas Score Formula

**Stop guessing. Start winning.** The Atlas Score uses Bayesian statistics to rank kingdoms by true skill, not luck.

### How It Works

We use **Bayesian averaging** with strong priors to penalize small sample sizes. This prevents lucky new kingdoms from outranking proven performers.

#### Bayesian Win Rate Formula
```
Adjusted Win Rate = (wins + 50) / (wins + losses + 100)
```

**Examples:**
- 2-0 record (100%) → 51.0% adjusted rate
- 8-1 record (89%) → 53.2% adjusted rate  
- 80-10 record (89%) → 68.4% adjusted rate

#### Experience Scaling
Experience matters. New kingdoms get scaled down:
- 1 KvK: 40% of base score
- 2 KvKs: 60% of base score
- 3 KvKs: 75% of base score
- 6+ KvKs: 100% of base score

#### Score Components
1. **Bayesian Win Rate** (70% weight) - Battle phase more important
2. **Domination Bonus** - Extra credit for winning both phases
3. **Recent Form** - Last 3 KvK performance
4. **Experience Factor** - Scales based on total KvKs

**Why Bayesian?** Used by top gaming communities (Hearthstone, LoR) to solve exactly this problem: separating skill from luck in small samples.

**Real data. Real results. No spin.**

---

## Accounts + Trust Roles

Auth is handled by **Supabase Auth** (Google, Discord, Email).

Current roles:
- **User** → submissions require admin approval
- **Admin** → all permissions (verified via `profiles.is_admin` in Supabase)

Planned trust hierarchy (not yet implemented):
- **Contributor** → auto-approval
- **Trusted** → auto-approval + can flag content
- **Moderator** → approve/reject submissions + moderation tools

---

## Data sources
Kingshot Atlas supports multiple data input methods:
- Manual admin entry
- Community/user submissions
- Discord bot submissions (future)
- Combination of all

---

## Freemium model (Premium unlocks)
Premium features (Day 1 targets):
- Kingdom watchlist + alerts
- Recruiter tools
- Full KvK history (not only last 5)
- Customization of kingdom profiles and user profiles
- Advanced filters + comparisons

---

## MVP search + filters
Directory must support:
- Search by kingdom number
- Sort by Atlas Score / Atlas Score Rank
- Filter by:
  - Win rates (prep/battle)
  - Most recent status
  - Total KvKs

---

## Deployment

### Production URLs

| Component | URL |
|-----------|-----|
| **Frontend** | https://ks-atlas.com |

### Frontend (Cloudflare Pages)

The frontend is deployed on Cloudflare Pages with custom domain `ks-atlas.com`.
Auto-deploys from `main` branch.

Build settings:
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Base directory**: `apps/web`
- **Framework preset**: Vite

Set environment variables in Cloudflare Dashboard:
- `VITE_API_URL` - Production API URL
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

### Backend (Render)

The backend auto-deploys from `main` branch on Render.

**Production URL:** https://kingshot-atlas.onrender.com

**Required environment variables** (set in Render dashboard):
| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | ✅ Yes | JWT signing key - generate with `openssl rand -hex 32` |
| `ALLOWED_ORIGINS` | ✅ Yes | `https://ks-atlas.com,https://www.ks-atlas.com,https://ks-atlas.pages.dev` |
| `SUPABASE_URL` | ✅ Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Supabase service role key (admin operations) |
| `STRIPE_SECRET_KEY` | ✅ Yes | Stripe live secret key |
| `STRIPE_WEBHOOK_SECRET` | ✅ Yes | Stripe webhook signing secret |
| `SENTRY_DSN` | No | Sentry error tracking DSN |
| `ENVIRONMENT` | No | Set to `production` |

**Verify deployment:**
```bash
curl https://kingshot-atlas.onrender.com/health
# Should return: {"status": "healthy"}
```

---

## Design principles
- Prioritize clarity and speed
- Keep it clean and modern
- Avoid clutter
- Make it feel like a premium tool
