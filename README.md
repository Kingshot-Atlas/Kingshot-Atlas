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
| Database | SQLite (PostgreSQL-ready) |
| Auth | JWT + bcrypt (placeholder) |
| Monitoring | Sentry (optional) |
| Deployment | Netlify (frontend), any ASGI host (backend) |

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
| `DATABASE_URL` | No | Database connection string (default: SQLite) |
| `SENTRY_DSN` | No | Sentry error tracking DSN |
| `ENVIRONMENT` | No | `development` or `production` |

### Frontend (`apps/web/.env.local`)
| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_API_URL` | No | Backend API URL (default: `http://127.0.0.1:8000`) |
| `REACT_APP_SENTRY_DSN` | No | Sentry error tracking DSN |
| `REACT_APP_ENVIRONMENT` | No | Environment name for Sentry |

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
- **Leaderboards** (`/leaderboards`) - Rankings by various metrics
- **User Profile** (`/profile`) - Local profile (auth placeholder)

---

## Kingdom Profile Fields (Current)

### Stats Displayed
- **Overall Score** - Weighted performance metric
- **Atlas Score Rank** - Position among all kingdoms
- **Power Tier** (S/A/B/C) - Based on Atlas Score thresholds
- **Total KvKs** - Battles participated
- **Prep Win Rate + Streak**
- **Battle Win Rate + Streak**
- **High Kings / Invader Kings** - Recent wins/losses

### Current Status
- Most Recent Kingdom Status: Currently shows "Unannounced" for all

### History
- Last 5 KvKs displayed:
  - KvK number
  - Opponent kingdom
  - Prep result (Win/Loss)
  - Battle result (Win/Loss)
  - Overall result

### Community (Planned)
- Reviews stored in localStorage (placeholder)
- Backend auth is placeholder - not production-ready

---

## Overall Score (weighted)
Overall Score is a weighted score that represents kingdom quality:
- Prep phase weight = 1
- Battle phase weight = 2
- Ratio: **Prep : Battle = 1 : 2**

Goal: Higher quality kingdoms should naturally rank higher.

---

## Accounts + Trust Roles (Planned)

⚠️ **WARNING:** Auth system is currently placeholder only. Do not use in production.

Planned trust hierarchy:
- **New** → submissions require approval
- **Contributor** → auto-approval
- **Trusted** → auto-approval + can flag content
- **Moderator** → approve/reject submissions + moderation tools
- **Admin** → all permissions + promote/demote users + system configuration

**Before production, must implement:**
- Real bcrypt password hashing
- JWT token authentication
- Rate limiting

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
- Sort by Overall Score / Overall Rank
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

### Frontend (Netlify)

The frontend is deployed on Netlify with custom domain `ks-atlas.com`.

Build settings:
- **Build command**: `npm run build`
- **Publish directory**: `build`
- **Base directory**: `apps/web`

Set environment variables in Netlify dashboard:
- `REACT_APP_API_URL` - Production API URL
- `REACT_APP_SENTRY_DSN` - Sentry DSN (optional)
- `REACT_APP_ENVIRONMENT` - `production`

### Backend (Railway)

The backend is configured for Railway deployment with `railway.json` and `Procfile`.

**Deploy steps:**
1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Create project: `railway init` (in `apps/api` directory)
4. Link repo: `railway link`
5. Deploy: `railway up`

**Required environment variables** (set in Railway dashboard):
| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | ✅ Yes | JWT signing key - generate with `openssl rand -hex 32` |
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string (Railway provides this) |
| `ALLOWED_ORIGINS` | ✅ Yes | `https://www.ks-atlas.com,https://ks-atlas.com` |
| `SUPABASE_JWT_SECRET` | ✅ Yes | Supabase JWT secret for auth validation |
| `SENTRY_DSN` | No | Sentry error tracking DSN |
| `ENVIRONMENT` | No | Set to `production` |

**Verify deployment:**
```bash
curl https://your-railway-url.up.railway.app/health
# Should return: {"status": "healthy"}
```

---

## Design principles
- Prioritize clarity and speed
- Keep it clean and modern
- Avoid clutter
- Make it feel like a premium tool
