# Kingshot Atlas API

Backend API for the Kingshot Atlas kingdom intelligence platform. Hosted on **Render** at `https://kingshot-atlas.onrender.com`.

## Architecture

**Dual-database design:**
- **SQLite** (`kingshot_atlas.db`) — Kingdom stats, KvK records, submissions (local to API, ephemeral on Render)
- **Supabase** (PostgreSQL) — User profiles, auth, transfers, reviews, notifications, scores, Discord data, 30+ tables with RLS

On each Render deploy, SQLite is recreated via `Base.metadata.create_all()` and populated from CSV via `ensure_data_loaded()`.

## Quick Start (Local Development)

```bash
cd apps/api
pip install -r requirements.txt
cp .env.example .env  # Configure environment variables
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

**Interactive docs:** [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger) or [http://localhost:8000/redoc](http://localhost:8000/redoc) (ReDoc)

## API Routers (12 mounted)

All endpoints are prefixed with `/api/v1/` unless noted.

| Router | Prefix | Description |
|--------|--------|-------------|
| `kingdoms.py` | `/api/v1/kingdoms` | List, search, filter, get kingdom profiles |
| `auth.py` | `/api/v1/auth` | Supabase JWT verification |
| `leaderboard.py` | `/api/v1/leaderboard` | Multi-category rankings |
| `compare.py` | `/api/v1/compare` | Side-by-side kingdom comparisons |
| `submissions.py` | `/api/v1/submissions` | Post-KvK and status submissions with moderation |
| `agent.py` | `/api/v1/agent` | Agent system endpoints |
| `discord.py` | `/api/v1/discord` | Discord OAuth, role sync, webhooks |
| `player_link.py` | `/api/v1/player-link` | Kingshot account linking via Century Games API |
| `stripe.py` | `/api/v1/stripe` | Checkout, webhooks, portal, subscription management |
| `admin.py` | `/api/v1/admin` | Admin dashboard, analytics, email, audit log |
| `bot.py` | `/api/v1/bot` | Discord bot status, commands, telemetry, role sync |
| `feedback.py` | `/api/feedback` | User feedback submission |

## Authentication

- **User auth:** Supabase JWT tokens verified via `Authorization: Bearer <token>` header
- **Admin auth:** Dual-auth — JWT (verified against `ADMIN_EMAILS` + `profiles.is_admin`) OR `X-Admin-Key` / `X-API-Key`
- **Bot auth:** Dual-auth — JWT (admin) OR `X-API-Key` (server-to-server)
- **Frontend pattern:** All API calls use shared `getAuthHeaders()` utility for fresh JWTs

## Security

- **Rate limiting:** `slowapi` (global) + in-memory per-IP limits on admin/bot endpoints
- **CORS:** Restricted to `ks-atlas.com`, `ks-atlas.pages.dev`, localhost (regex)
- **Headers:** CSP, HSTS, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy
- **GZip:** Responses > 1KB auto-compressed
- **Sentry:** Optional error monitoring (gracefully skipped if not installed)

## Project Structure

```
apps/api/
├── main.py                 # FastAPI app, CORS, middleware, security headers
├── database.py             # SQLAlchemy engine (SQLite default, PostgreSQL support)
├── models.py               # SQLAlchemy models (Kingdom, KVKRecord, KVKSubmission, etc.)
├── schemas.py              # Pydantic request/response schemas
├── import_data.py          # CSV → SQLite data import
├── rate_limiter.py         # Rate limiting utilities
├── render.yaml             # Render service configuration
├── Procfile                # Render process command
├── requirements.txt        # Python dependencies
├── api/
│   └── routers/
│       ├── kingdoms.py     # Kingdom CRUD, search, filters
│       ├── auth.py         # JWT verification
│       ├── leaderboard.py  # Rankings
│       ├── compare.py      # Kingdom comparison
│       ├── submissions.py  # KvK/status submissions + moderation
│       ├── agent.py        # Agent system
│       ├── discord.py      # Discord integration
│       ├── player_link.py  # Kingshot account linking
│       ├── stripe.py       # Payments, webhooks
│       ├── admin.py        # Admin dashboard APIs
│       ├── bot.py          # Discord bot APIs
│       └── feedback.py     # User feedback
├── scripts/                # Utility scripts
├── tests/                  # pytest test suite
└── data/                   # CSV data files for import
```

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | No | SQLite default; set for PostgreSQL |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `SUPABASE_JWT_SECRET` | Yes | For local JWT verification |
| `ADMIN_EMAILS` | Yes | Comma-separated admin email list |
| `STRIPE_SECRET_KEY` | Yes | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `DISCORD_API_PROXY` | Yes | Cloudflare Worker proxy URL |
| `DISCORD_PROXY_KEY` | Yes | Proxy authentication key |
| `SENTRY_DSN` | No | Sentry error monitoring |
| `ENVIRONMENT` | No | `production` or `development` |

## Testing

```bash
cd apps/api
pytest                     # Run all tests
pytest --cov=api           # With coverage
pytest tests/test_api.py   # Specific test file
```

## Deployment

Hosted on **Render** (`https://kingshot-atlas.onrender.com`). Auto-deploys from `main` branch.

- **Runtime:** Python 3.12 (see `runtime.txt`)
- **Start command:** See `Procfile`
- **Config:** See `render.yaml`

Render uses ephemeral storage — the SQLite database is recreated on each deploy via `create_all()` + CSV import. No migration tool is needed for SQLite schema changes; updating `models.py` is sufficient. Persistent data lives in Supabase (schema managed via Supabase migrations).
