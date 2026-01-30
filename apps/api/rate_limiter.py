from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, HTTPException
import os
from functools import wraps
import time

# Enhanced rate limiting with endpoint-specific limits
limiter = Limiter(key_func=get_remote_address)

# Rate limit configurations
RATE_LIMITS = {
    "default": "100/minute",
    "auth": "10/minute",      # Stricter for auth endpoints
    "search": "30/minute",     # For search-heavy endpoints
    "submit": "5/minute",      # For data submissions
    "compare": "20/minute",    # For comparison endpoints
}

def endpoint_rate_limit(limit_key: str):
    """Custom rate limit decorator for specific endpoints"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request from kwargs if it exists
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request and 'request' in kwargs:
                request = kwargs['request']
            
            if request:
                limit = RATE_LIMITS.get(limit_key, RATE_LIMITS["default"])
                # Apply rate limiting logic here
                # This is a simplified version - in production, you'd use Redis or similar
                client_ip = get_remote_address(request)
                current_time = time.time()
                
                # Simple in-memory rate limiting (for development)
                # In production, use Redis or a proper rate limiting store
                if not hasattr(app.state, 'rate_limit_store'):
                    app.state.rate_limit_store = {}
                
                key = f"{client_ip}:{limit_key}"
                if key not in app.state.rate_limit_store:
                    app.state.rate_limit_store[key] = []
                
                # Clean old entries (older than 1 minute)
                app.state.rate_limit_store[key] = [
                    timestamp for timestamp in app.state.rate_limit_store[key]
                    if current_time - timestamp < 60
                ]
                
                # Parse limit (e.g., "100/minute" -> 100)
                max_requests = int(limit.split('/')[0])
                
                if len(app.state.rate_limit_store[key]) >= max_requests:
                    raise HTTPException(
                        status_code=429,
                        detail="Rate limit exceeded",
                        headers={"Retry-After": "60"}
                    )
                
                app.state.rate_limit_store[key].append(current_time)
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Import app for the rate limiting store
from main import app
