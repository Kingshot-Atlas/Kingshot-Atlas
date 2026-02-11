# Platform Engineer — Latest Knowledge

**Last Updated:** 2026-02-08  
**Purpose:** Current best practices for backend development, security, and performance

---

## Bot Persistent Telemetry (2026-02-11)

**Module:** `apps/discord-bot/src/telemetry.js`
**Table:** `bot_telemetry` in Supabase (RLS enabled, service_role only)

**Pattern:** Fire-and-forget writes to Supabase REST API (no SDK). All telemetry calls are non-blocking — if Supabase is unreachable, bot continues unaffected.

**Event types logged:** startup, ready, disconnect, reconnect, crash, shutdown, login_failed, login_retry, memory_warning, shard_error, session_invalidated, health_check

**Memory monitoring:** Checks every 5min, warns at 200MB heap, critical at 400MB. Cooldown prevents spam (30min between alerts).

**Env vars required on Render (Atlas-Discord-bot service):**
- `SUPABASE_URL` = `https://qdczmafwcvnwfvixxbwg.supabase.co`
- `SUPABASE_SERVICE_KEY` = service_role key (same one used by email worker)

**Querying telemetry:**
```sql
-- Recent events
SELECT event_type, severity, message, memory_mb, created_at 
FROM bot_telemetry ORDER BY created_at DESC LIMIT 20;

-- Crashes only
SELECT * FROM bot_telemetry WHERE severity IN ('error', 'critical') ORDER BY created_at DESC;
```

**Gotcha:** The `bot_telemetry` table has NO public RLS policies — only `service_role` can read/write. Admin dashboard queries must go through the backend API (which uses service_role).

**Observability Dashboard:** `BotTelemetryTab` in Admin Dashboard (System > Bot Telemetry). Fetches from `GET /api/v1/bot/telemetry?limit=100&hours=168&severity=...&event_type=...`. Summary cards show crashes_24h, memory_warnings, disconnects, restarts. Auto-refreshes every 60s.

**Auto-Cleanup:** pg_cron job `bot-telemetry-cleanup` runs weekly Sunday 03:00 UTC. Deletes rows older than 30 days. To check: `SELECT * FROM cron.job WHERE jobname = 'bot-telemetry-cleanup';`

**Discord Alert Trigger:** `notify_critical_bot_event()` fires on INSERT of error/critical events. Uses `pg_net.http_post` to send Discord webhook embed. Webhook URL stored in vault: `INSERT INTO vault.secrets (name, secret) VALUES ('bot_alerts_discord_webhook', 'https://discord.com/api/webhooks/...');` — user needs to create a Discord webhook in their alerts channel and store the URL.

---

## Referral System RLS & URL Encoding Gotchas (2026-02-11)

**Critical:** The `referrals` table needs both SELECT and INSERT RLS policies. The original implementation only had SELECT, causing all referral inserts to be silently rejected.

**URL encoding:** Referral links use `?ref=<linked_username>`. Usernames with spaces (e.g., "Overseer Billy") break URLs on Discord/social platforms — the URL gets truncated at the space. Always use `encodeURIComponent()` when building referral URLs. `URLSearchParams.get('ref')` auto-decodes on the receiving end, so no decode step needed.

**Referral flow recap:**
1. Visitor lands with `?ref=X` → stored in localStorage (`kingshot_referral_code`)
2. On new profile creation (PGRST116 branch in AuthContext), code reads localStorage
3. Looks up referrer by `profiles.linked_username` = ref code
4. Inserts into `referrals` table (requires INSERT RLS policy!)
5. Updates new profile's `referred_by` field
6. When referred user links TC20+ account → `verify_pending_referral` trigger fires → updates referrer's `referral_count` and `referral_tier`

**Anti-gaming triggers on `referrals`:** `check_referral_rate_limit` (max 10 pending/referrer), `check_referral_ip_abuse` (auto-invalidate 3+ same IP+referrer)

## Multi-Source Referral Attribution (2026-02-11, expanded)

**`referrals.source` column** tracks how a user was brought to Atlas (4 channels):
- `'referral_link'` — via `?ref=` URL parameter (default, no `?src=` param)
- `'endorsement'` — user signed up to endorse an editor nominee (server-side in `submit_endorsement`)
- `'review_invite'` — user clicked a shared review link (`?ref=X&src=review`)
- `'transfer_listing'` — user clicked a shared transfer listing link (`?ref=X&src=transfer`)

**Frontend tracking flow:**
1. URLs carry `?ref=<username>&src=<type>` — `src` is optional, defaults to `referral_link`
2. `AuthContext.tsx` captures both params in `useEffect`, stores in localStorage: `REFERRAL_KEY` + `REFERRAL_SOURCE_KEY`
3. On new profile creation, reads both from localStorage, includes `source` in `referrals` INSERT
4. Both keys cleaned from localStorage after processing

**Where `&src=` is appended:**
- `KingdomListingCard.tsx` → `&src=transfer` (copy listing link + Discord copy)
- `RecruiterDashboard.tsx` → `&src=transfer` (copy listing link)
- `KingdomReviews.tsx` → `&src=review` (share review button on each review card)
- `ShareButton.tsx` → no `src` = default `referral_link`
- `submit_endorsement` → server-side `source='endorsement'`

**Endorsement → referral logic** (in `submit_endorsement` SECURITY DEFINER function):
- After successful endorsement, checks if endorser's `profiles.created_at > kingdom_editors.created_at` (joined after nomination)
- If endorser has no existing referral record (`referred_user_id` UNIQUE), creates a `'verified'` referral with `source='endorsement'`
- Auto-updates nominee's `referral_count` and `referral_tier` via `compute_referral_tier()`
- Endorsement referrals skip the `verify_pending_referral` trigger since endorsers already have TC20+ linked accounts

**Adding new sources:** Add value to `referrals.source` CHECK constraint, add `src` mapping in `AuthContext.tsx` `sourceMap`, then add `&src=<key>` to the relevant link generation code. The `referral_count` counts ALL verified referrals regardless of source.

**Admin component:** `ReferralIntelligence.tsx` replaced `ReferralFunnel.tsx` in admin dashboard. 4-section tabbed analytics: Overview, How People Found Atlas, Top Referrers, Recent Activity.

---

## Bot Admin Auth Pattern (2026-02-08)

Bot admin endpoints in `bot.py` now use the **same dual-auth pattern** as `admin.py`:
```python
def require_bot_admin(
    x_api_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    request: Request = None,
):
```
- Accepts `X-API-Key` (for server-side bot calls) OR `Authorization: Bearer <JWT>` (for frontend admin dashboard)
- JWT verified via Supabase `get_user()` → checks `profiles.is_admin` → falls back to `ADMIN_EMAILS`
- In-memory rate limiting: 30 req/60s per IP (stricter than admin.py's 60/60)
- In production, `DISCORD_API_KEY` env var MUST be set or API-key auth fails
- Frontend uses `getAuthHeaders()` from `authHeaders.ts` — **NO API keys in frontend bundle**

### Discord.py also upgraded
`discord.py`'s `verify_api_key` now accepts both `X-API-Key` and `Authorization: Bearer <JWT>` — same dual-auth pattern.

### Auth Levels — Two Dependencies
| Dependency | Who Can Call | Endpoints |
|------------|-------------|-----------|
| `require_bot_admin` | Admin JWT or API key | status, servers, channels, send-message, stats, analytics, linked-users, backfill, leave-server, diagnostic |
| `require_bot_or_user` | Any authenticated user JWT or API key | sync-settler-role, log-command |

### Key Gotcha: discordService.ts
`discordService.ts` calls `/bot/sync-settler-role` during user account linking. Uses `require_bot_or_user` (not admin-only) so any authenticated user's JWT works. The bot also calls `log-command` server-side with API key — same `require_bot_or_user` dependency.

---

## Admin Auth Pattern (2026-02-06)

All admin endpoints in `admin.py` now accept **both** `X-Admin-Key` and `Authorization: Bearer <JWT>`:
```python
def require_admin(
    x_admin_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None)
):
```
- `_verify_admin_jwt()` checks JWT via Supabase `get_user()`, then verifies email against `ADMIN_EMAILS`
- Internal function calls (e.g., `get_admin_overview` → `get_subscription_stats`) must forward both `x_admin_key` and `authorization`
- Frontend uses `getAuthHeaders()` from `authHeaders.ts` — never exposes `ADMIN_API_KEY`

### Frontend Retry Utility
`apps/web/src/utils/fetchWithRetry.ts` — exponential backoff, skips retries on 401/403 (auth errors won't resolve with retries), retries on 5xx and 429.

### Admin Audit Logging (2026-02-06)
- `admin_audit_log` table in Supabase with RLS (admins read, service role writes)
- `audit_log()` helper in `admin.py` — call after any mutating admin action
- Currently logs: `sync_subscriptions`, `recalculate_scores`, `set_current_kvk`
- GET `/admin/audit-log` returns recent entries for the dashboard feed

### Rate Limiting (2026-02-06)
- In-memory rate limiter in `admin.py`: 60 requests per 60-second window per IP
- Integrated into `require_admin()` — applies to ALL admin endpoints automatically
- Returns 429 when exceeded; `fetchWithRetry` handles 429 with backoff

### Plausible Analytics API (2026-02-06)
- Requires `PLAUSIBLE_API_KEY` env var (get from Plausible settings)
- `PLAUSIBLE_SITE_ID` defaults to `ks-atlas.com`
- GET `/admin/stats/plausible` — aggregate stats (visitors, pageviews, bounce rate, visit duration)
- GET `/admin/stats/plausible/breakdown?property=visit:source` — breakdown by source, country, page, etc.
- Frontend falls back gracefully when API key is not configured

### Batch Endpoints (2026-02-06)
- GET `/submissions/counts` — returns `{pending, approved, rejected}` counts in one call
- Replaces 3 sequential fetches from the admin dashboard

---

## Discord Bot Cloudflare Worker Proxy (2026-02-07)

### Problem
Render's shared IP (74.220.49.253) gets Cloudflare Error 1015 (IP ban) when the bot makes too many Discord REST API calls — especially during rapid restart cycles. The ban blocks ALL REST calls including interaction responses and gateway URL lookup.

### Solution: Cloudflare Worker Proxy
- Worker: `atlas-discord-proxy.gatreno-investing.workers.dev`
- Code: `apps/discord-bot/cloudflare-worker/discord-proxy.js`
- Routes REST calls through Cloudflare's own IP space (never banned by Cloudflare WAF)

### Bot-side Implementation
```javascript
// discordFetch() is a drop-in replacement for fetch('https://discord.com/...')
const DISCORD_API_PROXY = process.env.DISCORD_API_PROXY || '';
const DISCORD_PROXY_KEY = process.env.DISCORD_PROXY_KEY || '';
const DISCORD_API_BASE = DISCORD_API_PROXY || 'https://discord.com';

function discordFetch(path, options = {}) {
  const url = `${DISCORD_API_BASE}${path}`;
  const headers = { ...options.headers };
  if (DISCORD_API_PROXY && DISCORD_PROXY_KEY) {
    headers['X-Proxy-Key'] = DISCORD_PROXY_KEY;
  }
  return fetch(url, { ...options, headers });
}
```

### Environment Variables
| Var | Where | Value |
|-----|-------|-------|
| `DISCORD_API_PROXY` | Render (bot) | `https://atlas-discord-proxy.gatreno-investing.workers.dev` |
| `DISCORD_PROXY_KEY` | Render (bot) | Same as PROXY_SECRET on Worker |
| `PROXY_SECRET` | Cloudflare Worker | Random hex string |

### Critical: discord.js Client REST
The `client.login()` call internally uses discord.js's REST client to fetch `GET /gateway/bot`. This MUST also route through the proxy:
```javascript
const clientRestOptions = { timeout: 15_000, retries: 1 };
if (DISCORD_API_PROXY) {
  clientRestOptions.api = `${DISCORD_API_PROXY}/api`;
  clientRestOptions.headers = { 'X-Proxy-Key': DISCORD_PROXY_KEY };
}
```

### What's NOT proxied
- Gateway WebSocket (`wss://gateway.discord.gg`) — connects directly (not HTTP)
- Webhook POSTs for patch notes/announcements — use Discord webhook URLs directly
- OAuth token exchange in `discord.py` — uses user Bearer tokens, not bot tokens

### API-side Resilience (2026-02-08)
The backend API (`bot.py`) now has full proxy support + resilience:

**`discord_fetch()` helper** — ALL Discord REST calls go through this:
- Retry on 429 (respects `Retry-After`), 5xx (exponential backoff 0.5s, 1s)
- Skips retry on 4xx (except 429) — auth/permission errors won't resolve
- Logs every call to `discord_api_log` Supabase table
- `max_retries=2` default, `timeout=15s` default

**`_TTLCache`** — In-memory cache (5 min default):
- `bot_status` — cached `/users/@me` response
- `servers_list` — cached guild list
- Invalidated on `/leave-server`

**`/bot/health`** — Lightweight endpoint, NO Discord API calls:
- Returns proxy config status, cached bot status, cached server count
- Frontend can poll cheaply without burning Discord quota

**Startup warning** — Prints to Render logs if `DISCORD_API_PROXY` not set

**`discord_api_log` table** — Tracks all Discord REST calls:
- Columns: `method`, `path`, `status_code`, `proxy_used`, `error`, `created_at`
- RLS: service_role insert, admin read
- Retention: 30 days (manual cleanup)

### Environment Variables (BOTH Render services need these)
| Var | Where | Value |
|-----|-------|-------|
| `DISCORD_API_PROXY` | Render (bot) + Render (API) | `https://atlas-discord-proxy.gatreno-investing.workers.dev` |
| `DISCORD_PROXY_KEY` | Render (bot) + Render (API) | Same as PROXY_SECRET on Worker |
| `PROXY_SECRET` | Cloudflare Worker | Random hex string |

⚠️ **CRITICAL:** Both `Kingshot-Atlas` (API) and `Atlas-Discord-bot` need these env vars. The API was missing them, causing Error 1015.

---

## Settler Role Auto-Assignment (2026-02-07)

### Architecture
Two sync paths ensure the Settler role stays current:
1. **Web app (real-time):** `discordService.syncSettlerRole()` called on link/unlink in Profile.tsx → API `POST /api/v1/bot/sync-settler-role` → `discord_role_sync.assign_settler_role()`
2. **Bot (periodic):** `syncSettlerRoles()` every 30min → `GET /api/v1/bot/linked-users` → assigns/removes roles via discord.js `member.roles.add/remove`

### Eligibility
User must have BOTH in `profiles` table:
- `discord_id` IS NOT NULL (linked Discord via OAuth)
- `linked_player_id` IS NOT NULL (linked Kingshot account)

### Role ID
- Default: `1466442878585934102`
- Configurable: `DISCORD_SETTLER_ROLE_ID` env var

### Bot Prerequisites
- `GuildMembers` privileged intent enabled in Discord Developer Portal
- Bot role must be HIGHER than Settler role in guild role hierarchy
- `Manage Roles` permission

---

## FastAPI Best Practices (2026)

### Project Structure
```
/apps/api/
├── main.py              # App entry point, CORS, middleware
├── routers/             # Route definitions by domain
│   ├── players.py
│   ├── events.py
│   └── auth.py
├── models/              # Pydantic models
│   ├── player.py
│   └── event.py
├── services/            # Business logic
│   ├── player_service.py
│   └── event_service.py
├── database/            # DB connection, queries
│   ├── connection.py
│   └── queries/
└── utils/               # Shared utilities
```

### Dependency Injection
```python
# Define dependencies
async def get_db() -> AsyncGenerator[Database, None]:
    db = Database()
    try:
        yield db
    finally:
        await db.close()

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Database = Depends(get_db),
) -> User:
    # Validate token, return user
    ...

# Use in routes
@router.get("/me")
async def get_profile(user: User = Depends(get_current_user)):
    return user
```

### Error Handling
```python
# Consistent error responses
class APIError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message

@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )

# Usage
raise APIError(404, "PLAYER_NOT_FOUND", f"Player {id} not found")
```

---

## Security Practices

### CORS Configuration
```python
# Kingshot Atlas CORS settings
ALLOWED_ORIGINS = [
    "https://ks-atlas.com",
    "https://www.ks-atlas.com",
    "https://ks-atlas.pages.dev",
]

if os.getenv("ENVIRONMENT") == "development":
    ALLOWED_ORIGINS.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

### Input Validation
```python
# Always validate with Pydantic
class PlayerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    kingdom: Optional[int] = Field(None, ge=1, le=9999)
    power: Optional[int] = Field(None, ge=0)
    
    @validator('name')
    def name_must_not_be_empty(cls, v):
        if v is not None and not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip() if v else v
```

### Security Headers
```python
# Add security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response
```

### JWT Best Practices
```python
# Short-lived access tokens, longer refresh tokens
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Include minimal claims
def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": datetime.utcnow(),
        "type": "access",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")
```

---

## Performance Patterns

### Database Query Optimization
```python
# ❌ N+1 Query Problem
players = await db.fetch_all("SELECT * FROM players")
for player in players:
    alliance = await db.fetch_one(
        "SELECT * FROM alliances WHERE id = :id",
        {"id": player.alliance_id}
    )  # This runs N times!

# ✅ Join or batch fetch
players = await db.fetch_all("""
    SELECT p.*, a.name as alliance_name
    FROM players p
    LEFT JOIN alliances a ON p.alliance_id = a.id
""")
```

### Caching Strategies
```python
# In-memory cache for frequently accessed data
from functools import lru_cache
from datetime import datetime, timedelta

@lru_cache(maxsize=100)
def get_cached_config(key: str) -> dict:
    # Cache config values
    ...

# Redis for distributed caching
async def get_player_cached(player_id: str) -> Player:
    cached = await redis.get(f"player:{player_id}")
    if cached:
        return Player.parse_raw(cached)
    
    player = await db.get_player(player_id)
    await redis.setex(f"player:{player_id}", 300, player.json())  # 5 min TTL
    return player
```

### Async Patterns
```python
# Concurrent API calls
async def get_dashboard_data(user_id: str):
    # Run independent queries concurrently
    players, events, stats = await asyncio.gather(
        get_players(user_id),
        get_events(user_id),
        get_stats(user_id),
    )
    return {"players": players, "events": events, "stats": stats}
```

---

## Build & Bundle Optimization

### Vite Configuration
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
});
```

### Tree Shaking
```typescript
// ✅ Good: Named imports allow tree shaking
import { format, parseISO } from 'date-fns';

// ❌ Bad: Imports entire library
import * as dateFns from 'date-fns';
```

### Code Splitting
```typescript
// Split heavy components
const HeavyChart = lazy(() => import('./HeavyChart'));
const AdminPanel = lazy(() => import('./AdminPanel'));
```

---

## Kingshot Atlas Specifics

### API Structure
```
/apps/api/
├── main.py              # Entry point, CORS config
├── routers/
│   ├── health.py        # Health check endpoint
│   └── ...
└── ...
```

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://...
SECRET_KEY=your-secret-key

# Optional
ENVIRONMENT=production|development
LOG_LEVEL=INFO|DEBUG
CORS_ORIGINS=https://ks-atlas.com,https://ks-atlas.pages.dev
```

### Deployment
- **API Host:** Render
- **Database:** PostgreSQL (if applicable)
- **CORS:** Must include all production domains

---

## Testing Patterns

### Unit Tests
```python
# Test business logic in isolation
def test_calculate_player_rank():
    players = [
        Player(id="1", power=1000000),
        Player(id="2", power=500000),
        Player(id="3", power=750000),
    ]
    ranked = calculate_ranks(players)
    assert ranked[0].id == "1"
    assert ranked[0].rank == 1
```

### Integration Tests
```python
# Test API endpoints with test client
from fastapi.testclient import TestClient

def test_get_players(client: TestClient):
    response = client.get("/api/players")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_player_validation(client: TestClient):
    response = client.post("/api/players", json={"name": ""})
    assert response.status_code == 422  # Validation error
```

---

## Monitoring & Logging

### Structured Logging
```python
import logging
import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
        })

# Usage
logger.info("Player created", extra={"player_id": player.id})
```

### Health Check Endpoint
```python
@router.get("/health")
async def health_check(db: Database = Depends(get_db)):
    try:
        await db.execute("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": str(e)},
        )
```

---

## Recent Audit Findings (2026-01-29)

### Python 3.12+ Compatibility
**Critical:** `datetime.utcnow()` is deprecated. Use timezone-aware datetimes:

```python
from datetime import datetime, timezone

# ❌ Deprecated (Python 3.12+)
datetime.utcnow()

# ✅ Correct
datetime.now(timezone.utc)

# For SQLAlchemy model defaults, create a helper:
def utc_now():
    return datetime.now(timezone.utc)

class MyModel(Base):
    created_at = Column(DateTime, default=utc_now)
```

### CI/CD Best Practices
- Always include both frontend AND backend tests in CI
- Use proper environment variable quoting in YAML
- Cache pip dependencies for faster builds

### Logging Best Practices
- Import logging at module level, not inline
- Create module-level logger: `logger = logging.getLogger(__name__)`
- Avoid `import logging` inside functions

---

## Century Games API Integration (2026-01-29)

### Overview
Century Games (Kingshot, Whiteout Survival) exposes a public API through their gift code websites that can be used to verify player IDs and retrieve basic profile data.

### Kingshot API Configuration
```python
KINGSHOT_API_BASE = "https://kingshot-giftcode.centurygame.com/api"
KINGSHOT_API_SALT = "mN4!pQs6JrYwV9"
```

### Signature Generation
```python
import hashlib

def generate_signature(params: dict, salt: str) -> str:
    sorted_keys = sorted(params.keys())
    param_string = "&".join(f"{k}={params[k]}" for k in sorted_keys)
    return hashlib.md5((param_string + salt).encode()).hexdigest()
```

### Available Endpoints
| Endpoint | Method | Purpose | Rate Limit |
|----------|--------|---------|------------|
| `/player` | POST | Verify player ID, get profile | ~1 req/sec |
| `/gift_code` | POST | Redeem gift codes | ~1 req/sec |
| `/captcha` | POST | Get CAPTCHA for redemption | ~1 req/sec |

### Player Data Response
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "fid": "123456789",
    "nickname": "PlayerName",
    "avatar_image": "https://cdn.centurygame.com/...",
    "kid": 172,
    "stove_lv": 30
  }
}
```

### Implementation Location
- Backend proxy: `/apps/api/api/routers/player_link.py`
- Frontend component: `/apps/web/src/components/LinkKingshotAccount.tsx`
- Full documentation: `/docs/CENTURY_GAMES_API_RESEARCH.md`

### Security Notes
- **Never expose the API salt in frontend code** - use backend proxy
- Rate limit API calls to prevent abuse (10/min verify, 5/hour refresh)
- The API does NOT provide ranking data (power, alliance rankings, etc.)

---

## Auth Headers Pattern (2026-02-06)

### CRITICAL: Never use `session.access_token` from React state for backend API calls

Supabase JWTs expire after 1 hour. React state (`useAuth().session`) can hold stale/expired tokens. The backend's `get_verified_user_id()` rejects expired JWTs and also rejects raw `X-User-Id` headers in production.

### Correct Pattern: Use `getAuthHeaders()`
```typescript
import { getAuthHeaders } from '../services/authHeaders';

// For required auth (throws if no session):
const authHeaders = await getAuthHeaders();

// For optional auth (returns empty object if no session):
const authHeaders = await getAuthHeaders({ requireAuth: false });

// Use in fetch:
const response = await fetch(`${API_URL}/api/v1/endpoint`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...authHeaders
  },
  body: JSON.stringify(data)
});
```

### What `getAuthHeaders()` returns
- `Authorization: Bearer <fresh_jwt>` — Always fresh from `supabase.auth.getSession()`
- `X-User-Id` — User ID from session
- `X-User-Email` — User email from session

### Files using this pattern
- `apps/web/src/components/PostKvKSubmission.tsx`
- `apps/web/src/pages/Admin.tsx`
- `apps/web/src/pages/AdminDashboard.tsx`

### DO NOT
- ❌ Use `session?.access_token` from `useAuth()` for backend API calls
- ❌ Send only `X-User-Id` header without `Authorization` (rejected in production)
- ❌ Call `supabase.auth.getSession()` inline — use the shared utility instead

## Backend JWT Validation (2026-02-06)

### 3-Strategy Token Validation in `verify_supabase_jwt()`

The backend validates tokens using a cascading strategy:

1. **Local JWT decode** (fast) — Uses `SUPABASE_JWT_SECRET` to verify signature locally
2. **Supabase Auth API** (reliable fallback) — Calls `client.auth.get_user(token)` via the admin client (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
3. **Unverified decode** (dev only) — Only when `SUPABASE_JWT_SECRET` is not set AND not on Render

### Why the fallback matters
- `SUPABASE_JWT_SECRET` may be misconfigured on Render
- The Supabase admin client is ALWAYS available (proven by notifications, profile updates, etc.)
- Strategy 2 adds ~100ms latency but is 100% reliable

### Backend file
- `apps/api/api/routers/submissions.py` — `verify_supabase_jwt()`, `_validate_token_via_supabase_api()`

---

## Score History Rank Recalculation (2026-02-06)

### Architecture: `score_history` is the SINGLE SOURCE OF TRUTH for ranks
- `rank_at_time` ranks within `score_history` entries at the same KvK using `ROW_NUMBER() OVER (ORDER BY score DESC, kingdom_number ASC)`
- `percentile_rank` = `(total - rank) / (total - 1) * 100`
- `kingdoms.current_rank` auto-syncs from score_history via `sync_kingdom_current_rank()` trigger
- **Frontend profile header** reads rank from `scoreHistoryService.getLatestRank()` — NOT client-side sorting
- **Chart** reads `rank_at_time` from score_history records

### Key gotchas:
1. ❌ Do NOT rank against `kingdoms.atlas_score` — that compares historical scores against current scores (meaningless)
2. ✅ Rank within `score_history` entries at the same KvK — this gives the correct historical cohort rank
3. After UPSERT, recalculate ALL entries at that KvK (not just the new one)
4. Admin can run `SELECT * FROM verify_and_fix_rank_consistency()` to audit all ranks

### Migrations (in order):
1. `fix_rank_recalculation_on_score_history` — initial fix for stale ranks
2. `fix_rank_at_time_use_all_kingdoms` — incorrect fix (ranked vs kingdoms table)
3. `fix_rank_at_time_within_score_history` — correct fix (ranks within score_history)
4. `add_percentile_rank_to_score_history` — added column + backfill
5. `update_trigger_with_percentile_rank` — trigger calculates both
6. `add_current_rank_to_kingdoms` — auto-sync column + trigger
7. `add_verify_rank_consistency_function` — admin audit function

---

## Security Hardening — Transfer Hub Launch (2026-02-10)

### RLS Policy Fixes Applied

**`applications_update_own`** on `transfer_applications`:
- Previously: `USING (auth.uid() = applicant_user_id)` with NO `WITH CHECK`
- Users could update ANY column (status, kingdom_number, expires_at) via crafted Supabase client
- **Fixed:** Added `WITH CHECK (auth.uid() = applicant_user_id AND status = 'withdrawn')`
- Now users can ONLY set their own applications to 'withdrawn'

**`Authenticated users can send notifications`** on `notifications`:
- Previously: `WITH CHECK (true)` — any authenticated user could insert notifications to ANY user
- Abuse vector: notification spam to arbitrary users
- **Fixed:** `WITH CHECK (type IN ('new_application', 'application_status', 'transfer_invite'))`
- Only transfer-related notification types allowed from frontend; all other types must come from service_role/triggers

### Function search_path (ALL 44 fixed)
- Applied `ALTER FUNCTION ... SET search_path = public` to all 44 public functions
- Prevents search_path injection attacks where attacker creates shadow functions in other schemas
- Migration: `set_search_path_on_all_functions`

### Remaining Acceptable Warnings
- `admin_audit_log`, `discord_link_attempts`, `review_notifications` — service_role INSERT (backend-only, intentional)
- `multirally_analytics/usage` — service_role ALL (bot backend only)
- `auth_leaked_password_protection` — We use OAuth (Google/Discord), not passwords

### Security Score: 82 → 93/100

---

## Transfer Hub Editor Pipeline — RLS Audit (2026-02-10)

### Full pipeline: Nomination → Endorsement → Activation → Co-Editor → Notifications

**5 silent RLS failures found and fixed** across the entire editor flow:

#### 1. kingdom_funds INSERT during nomination (user-reported bug)
- Frontend tried to INSERT into `kingdom_funds` — only `service_role` can write
- **Fix:** Removed premature INSERT from `EditorClaiming.tsx`
- **Fix:** Added `trg_auto_create_kingdom_fund` trigger (SECURITY DEFINER) on `kingdom_editors` — auto-creates fund row when editor status becomes 'active'

#### 2. kingdom_editors self-nomination INSERT
- No INSERT policy existed for nominating yourself (only `editors_insert_coeditor`)
- **Fix:** Added `editors_nominate_self` policy — allows INSERT where `auth.uid() = user_id AND role = 'editor' AND status = 'pending'`

#### 3. increment_endorsement_count RPC missing
- Frontend called `supabase.rpc('increment_endorsement_count')` — function didn't exist
- Manual fallback tried UPDATE on `kingdom_editors` — also blocked by RLS (endorser isn't an editor)
- **Fix:** Created `increment_endorsement_count(claim_id uuid)` as SECURITY DEFINER function
- Atomically increments count and activates editor when threshold reached

#### 4. Co-editor accept/decline blocked
- `editors_update_coeditor` requires user to be active editor — but pending co-editors aren't active yet
- Accept/decline buttons in RecruiterDashboard silently failed
- **Fix:** Added `editors_respond_own_invite` policy — pending co-editors can set their own status to 'active' or 'inactive'

#### 5. Co-editor invite notifications silently blocked
- Notification INSERT policy only allowed 3 types: `new_application`, `application_status`, `transfer_invite`
- RecruiterDashboard sends `co_editor_invite` type — was silently dropped
- **Fix:** Expanded allowed types to include `co_editor_invite` and `endorsement_received`

### Key Pattern: SECURITY DEFINER for Cross-Role Operations
When user A's action needs to modify user B's data (e.g., endorser incrementing editor's count), use a SECURITY DEFINER function. Never add permissive RLS policies that allow any authenticated user to UPDATE arbitrary rows.

---

*Updated by Platform Engineer based on current backend best practices.*
*Last audit: 2026-02-10*
