"""
Centralized configuration module for the Kingshot Atlas API.

All environment variables that are shared across multiple modules are
read here once at startup.  Individual modules import from this file
instead of calling os.getenv() directly, eliminating duplication and
ensuring a single source of truth for every config value.

Non-shared / module-specific env vars (e.g. PLAUSIBLE_API_KEY, which
is only used in admin.py) are intentionally left in their respective
modules.
"""
import os

# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------
_default_admin_emails = "gatreno@gmail.com,gatreno.investing@gmail.com"
ADMIN_EMAILS = [
    e.strip()
    for e in os.getenv("ADMIN_EMAILS", _default_admin_emails).split(",")
    if e.strip()
]

# ---------------------------------------------------------------------------
# Stripe
# ---------------------------------------------------------------------------
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")

# ---------------------------------------------------------------------------
# Discord — shared across bot.py, discord.py, discord_role_sync.py
# ---------------------------------------------------------------------------
DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")
DISCORD_API_KEY = os.getenv("DISCORD_API_KEY")
DISCORD_API_PROXY = os.getenv("DISCORD_API_PROXY", "")
DISCORD_PROXY_KEY = os.getenv("DISCORD_PROXY_KEY", "")
DISCORD_GUILD_ID = os.getenv("DISCORD_GUILD_ID", "")

# ---------------------------------------------------------------------------
# Email / Frontend
# ---------------------------------------------------------------------------
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://ks-atlas.com")
