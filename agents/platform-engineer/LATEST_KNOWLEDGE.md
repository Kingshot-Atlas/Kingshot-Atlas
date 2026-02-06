# Platform Engineer — Latest Knowledge

**Last Updated:** 2026-01-28  
**Purpose:** Current best practices for backend development, security, and performance

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
    "https://ks-atlas.netlify.app",
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
CORS_ORIGINS=https://ks-atlas.com,https://ks-atlas.netlify.app
```

### Deployment
- **API Host:** Railway/Render (or similar)
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

*Updated by Platform Engineer based on current backend best practices.*
*Last audit: 2026-02-06*
