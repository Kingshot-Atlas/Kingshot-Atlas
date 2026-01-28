import os
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
from api.routers import kingdoms, auth, leaderboard, compare, submissions
from database import engine
from models import Base

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

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)

# Allowed origins for CORS
# Production: https://www.ks-atlas.com and https://ks-atlas.com
# Development: localhost variants
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,https://www.ks-atlas.com,https://ks-atlas.com"
).split(",")

app = FastAPI(
    title="Kingshot Atlas API",
    description="Backend API for Kingsshot Atlas kingdom data",
    version="1.0.0"
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# GZip compression for responses > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS - restricted to known origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-User-Id", "X-User-Name"],
)

app.include_router(kingdoms.router, prefix="/api", tags=["kingdoms"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(leaderboard.router, prefix="/api", tags=["leaderboard"])
app.include_router(compare.router, prefix="/api", tags=["compare"])
app.include_router(submissions.router, prefix="/api", tags=["submissions"])

@app.get("/")
def root():
    return {"message": "Kingshot Atlas API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.middleware("http")
async def add_headers(request: Request, call_next):
    response = await call_next(request)
    
    # Security headers (2025 standards)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    
    # Content Security Policy - adjust as needed for your CDN/assets
    csp_directives = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",  # unsafe-inline needed for React
        "style-src 'self' 'unsafe-inline'",   # unsafe-inline needed for Tailwind
        "img-src 'self' data: https:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://*.supabase.co https://*.sentry.io",
        "frame-ancestors 'none'",
    ]
    response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
    
    # Cache-Control headers for API endpoints
    path = request.url.path
    if path.startswith("/api/"):
        if path.startswith("/api/kingdoms") or path.startswith("/api/leaderboard"):
            # Kingdom data changes infrequently - cache for 5 minutes
            response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60"
        elif path.startswith("/api/compare"):
            # Comparison results - cache for 2 minutes
            response.headers["Cache-Control"] = "public, max-age=120, stale-while-revalidate=30"
        else:
            # Other endpoints - short cache
            response.headers["Cache-Control"] = "public, max-age=60"
    
    return response

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
