import os
import logging
import secrets

logger = logging.getLogger("atlas.api")

try:
    import sentry_sdk
    SENTRY_AVAILABLE = True
except ImportError:
    SENTRY_AVAILABLE = False
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from api.routers import kingdoms, auth, leaderboard, compare, submissions, agent, discord, player_link, stripe, admin, bot, feedback
from database import engine, SessionLocal
from models import Base, Kingdom, KVKRecord, KVKSubmission, KingdomClaim, User

# Initialize Sentry for error monitoring (only if available and DSN is configured)
SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_AVAILABLE and SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        environment=os.getenv("ENVIRONMENT", "development"),
    )

Base.metadata.create_all(bind=engine)

def ensure_data_loaded():
    """Check if database has data, import if empty (handles Render's ephemeral storage)"""
    db = SessionLocal()
    try:
        count = db.query(Kingdom).count()
        if count == 0:
            logger.info("Database empty, importing data...")
            from import_data import import_kingdoms_data
            import_kingdoms_data()
            logger.info("Data import completed on startup")
        else:
            logger.info("Database has %d kingdoms", count)
    except Exception as e:
        logger.error("Error checking/importing data: %s", e)
    finally:
        db.close()

# Import data if database is empty (critical for Render's ephemeral storage)
ensure_data_loaded()

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)

# Allowed origins for CORS - tightened security
# Production: https://ks-atlas.com, https://www.ks-atlas.com, https://ks-atlas.pages.dev
# Development: localhost on any port
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "https://ks-atlas.com,https://www.ks-atlas.com,https://ks-atlas.pages.dev"
).split(",")

# Regex pattern to allow any localhost port for development
LOCALHOST_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

app = FastAPI(
    title="Kingshot Atlas API",
    description="Backend API for Kingshot Atlas kingdom data",
    version="2.0.0"
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# GZip compression for responses > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS - restricted to known origins + localhost regex for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=LOCALHOST_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-User-Id", "X-User-Email", "X-Admin-Key"],
)

app.include_router(kingdoms.router, prefix="/api/v1", tags=["kingdoms"])
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])
app.include_router(leaderboard.router, prefix="/api/v1", tags=["leaderboard"])
app.include_router(compare.router, prefix="/api/v1", tags=["compare"])
app.include_router(submissions.router, prefix="/api/v1", tags=["submissions"])
app.include_router(agent.router, prefix="/api/v1/agent", tags=["agent"])
app.include_router(discord.router, prefix="/api/v1/discord", tags=["discord"])
app.include_router(player_link.router, prefix="/api/v1/player-link", tags=["player-link"])
app.include_router(stripe.router, prefix="/api/v1/stripe", tags=["stripe"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(bot.router, prefix="/api/v1/bot", tags=["bot"])
app.include_router(feedback.router, tags=["feedback"])

@app.get("/")
def root():
    return {"message": "Kingshot Atlas API"}

@app.get("/health")
@app.head("/health")
def health_check():
    return {"status": "healthy"}

@app.middleware("http")
async def add_headers(request: Request, call_next):
    response = await call_next(request)
    
    # Generate nonce for CSP (for inline scripts/styles)
    nonce = secrets.token_urlsafe(16)
    
    # Security headers (2025 standards)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    
    # Content Security Policy with nonce-based inline script/style support
    csp_directives = [
        "default-src 'self'",
        f"script-src 'self' 'nonce-{nonce}' https://*.stripe.com https://plausible.io",
        f"style-src 'self' 'nonce-{nonce}' https://fonts.googleapis.com",
        "img-src 'self' data: https: blob: https://*.akamaized.net https://*.centurygame.com https://cdn.discordapp.com https://*.googleusercontent.com https://lh3.googleusercontent.com",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://*.supabase.co https://*.sentry.io https://api.stripe.com https://plausible.io wss://*.supabase.co https://*.onrender.com https://kingshot-giftcode.centurygame.com",
        "frame-src https://*.stripe.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
    ]
    response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
    
    # Pass nonce to client for development
    if os.getenv("ENVIRONMENT", "development") == "development":
        response.headers["X-CSP-Nonce"] = nonce
    
    # Cache-Control headers for API endpoints
    # Use 'private' to prevent CDN caching - only browser can cache
    # This ensures Discord bot and other API clients always get fresh data
    path = request.url.path
    if path.startswith("/api/"):
        if path.startswith("/api/v1/kingdoms") or path.startswith("/api/v1/leaderboard"):
            # Kingdom data - private cache only, no CDN caching
            response.headers["Cache-Control"] = "private, max-age=60, must-revalidate"
        elif path.startswith("/api/v1/compare"):
            # Comparison results - private cache only
            response.headers["Cache-Control"] = "private, max-age=60, must-revalidate"
        else:
            # Other endpoints - no caching for dynamic data
            response.headers["Cache-Control"] = "private, no-cache, must-revalidate"
    
    return response

@app.post("/api/csp-report")
async def csp_report(request: Request):
    """Receive CSP violation reports for security monitoring."""
    try:
        body = await request.json()
        # Log CSP violations for monitoring (don't store sensitive data)
        violation = body.get("csp-report", {})
        logger.warning("CSP Violation: %s on %s", violation.get('violated-directive'), violation.get('document-uri'))
    except Exception:
        pass  # Silently ignore malformed reports
    return {"status": "received"}

@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"detail": "Endpoint not found"}
    )

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
