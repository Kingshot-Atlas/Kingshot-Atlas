"""
Admin API package.

Combines all admin sub-routers into a single router for backward compatibility.
Previously a single 1941-line file, now split into logical sub-modules:

- _shared.py: Authentication, rate limiting, audit logging
- analytics.py: Subscription stats, revenue, MRR, churn, forecast, cohort, KPIs, Plausible
- exports.py: CSV exports (subscribers, revenue)
- webhooks.py: Webhook events, audit log, webhook health
- subscriptions.py: Sync-all, manual grant, grant-by-email
- scores.py: Score recalculation, distribution, movers
- config_routes.py: KvK configuration management
- email_routes.py: Support email system, templates, churn alerts, weekly digest
"""
from fastapi import APIRouter

from .analytics import router as analytics_router
from .exports import router as exports_router
from .webhooks import router as webhooks_router
from .subscriptions import router as subscriptions_router
from .scores import router as scores_router
from .config_routes import router as config_router
from .email_routes import router as email_router

# Re-export shared utilities for any external consumers
from ._shared import require_admin, audit_log, verify_admin, check_rate_limit, DEFAULT_CURRENT_KVK

router = APIRouter()

# Include all sub-routers (no prefix — they already define their full paths)
router.include_router(analytics_router)
router.include_router(exports_router)
router.include_router(webhooks_router)
router.include_router(subscriptions_router)
router.include_router(scores_router)
router.include_router(config_router)
router.include_router(email_router)
