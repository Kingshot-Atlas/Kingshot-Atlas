"""
Discord Role Sync Service

Syncs subscription tier roles in Discord when users subscribe/unsubscribe.
Uses Discord Bot API to add/remove roles from guild members.

Flow:
1. Stripe webhook triggers subscription change
2. Get user's discord_id from Supabase profile
3. Call Discord API to add/remove appropriate role

Requirements:
- Discord Bot Token with "Manage Roles" permission
- Bot must be in the same guild as the user
- Bot's role must be higher than the roles it manages
- Guild Members privileged intent must be enabled
"""
import os
import logging
import httpx
from typing import Optional, Literal
from api.config import DISCORD_BOT_TOKEN, DISCORD_API_PROXY, DISCORD_PROXY_KEY

logger = logging.getLogger("atlas.discord_sync")

# Discord guild & role configuration (module-specific, not shared)
DISCORD_GUILD_ID = os.getenv("DISCORD_GUILD_ID")
DISCORD_SUPPORTER_ROLE_ID = os.getenv("DISCORD_SUPPORTER_ROLE_ID")
DISCORD_RECRUITER_ROLE_ID = os.getenv("DISCORD_RECRUITER_ROLE_ID")
DISCORD_SETTLER_ROLE_ID = os.getenv("DISCORD_SETTLER_ROLE_ID", "1466442878585934102")
DISCORD_GILDED_ROLE_ID = os.getenv("DISCORD_GILDED_ROLE_ID", "1472230516823556260")

DISCORD_API_BASE = f"{DISCORD_API_PROXY}/api/v10" if DISCORD_API_PROXY else "https://discord.com/api/v10"


def is_discord_sync_configured() -> bool:
    """Check if Discord role sync is properly configured."""
    return all([
        DISCORD_BOT_TOKEN,
        DISCORD_GUILD_ID,
        DISCORD_SUPPORTER_ROLE_ID or DISCORD_RECRUITER_ROLE_ID,
    ])


async def add_role_to_member(discord_user_id: str, role_id: str) -> bool:
    """
    Add a role to a Discord guild member.
    
    Args:
        discord_user_id: Discord user ID
        role_id: Discord role ID to add
        
    Returns:
        True if successful, False otherwise
    """
    if not DISCORD_BOT_TOKEN or not DISCORD_GUILD_ID:
        logger.warning("Discord role sync not configured")
        return False
    
    url = f"{DISCORD_API_BASE}/guilds/{DISCORD_GUILD_ID}/members/{discord_user_id}/roles/{role_id}"
    headers = {
        "Authorization": f"Bot {DISCORD_BOT_TOKEN}",
        "Content-Type": "application/json",
    }
    if DISCORD_API_PROXY and DISCORD_PROXY_KEY:
        headers["X-Proxy-Key"] = DISCORD_PROXY_KEY
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.put(url, headers=headers)
            
        if response.status_code == 204:
            logger.info("Added role %s to Discord user %s", role_id, discord_user_id)
            return True
        elif response.status_code == 404:
            logger.warning("Discord user %s not found in guild %s", discord_user_id, DISCORD_GUILD_ID)
            return False
        elif response.status_code == 403:
            logger.error("Bot lacks permission to manage roles. Status: 403 - %s (Guild: %s, User: %s, Role: %s)",
                         response.text, DISCORD_GUILD_ID, discord_user_id, role_id)
            return False
        else:
            logger.error("Failed to add role: %s - %s (URL: %s)", response.status_code, response.text, url)
            return False
            
    except Exception as e:
        logger.error("Discord API error adding role: %s", e)
        return False


async def remove_role_from_member(discord_user_id: str, role_id: str) -> bool:
    """
    Remove a role from a Discord guild member.
    
    Args:
        discord_user_id: Discord user ID
        role_id: Discord role ID to remove
        
    Returns:
        True if successful, False otherwise
    """
    if not DISCORD_BOT_TOKEN or not DISCORD_GUILD_ID:
        logger.warning("Discord role sync not configured")
        return False
    
    url = f"{DISCORD_API_BASE}/guilds/{DISCORD_GUILD_ID}/members/{discord_user_id}/roles/{role_id}"
    headers = {
        "Authorization": f"Bot {DISCORD_BOT_TOKEN}",
    }
    if DISCORD_API_PROXY and DISCORD_PROXY_KEY:
        headers["X-Proxy-Key"] = DISCORD_PROXY_KEY
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(url, headers=headers)
            
        if response.status_code == 204:
            logger.info("Removed role %s from Discord user %s", role_id, discord_user_id)
            return True
        elif response.status_code == 404:
            # User not in guild or doesn't have role - that's fine
            logger.info("Discord user %s not in guild or doesn't have role", discord_user_id)
            return True
        else:
            logger.error("Failed to remove role: %s - %s", response.status_code, response.text)
            return False
            
    except Exception as e:
        logger.error("Discord API error removing role: %s", e)
        return False


async def sync_subscription_role(
    discord_user_id: str,
    new_tier: Literal["free", "pro", "supporter", "recruiter"],
    old_tier: Optional[Literal["free", "pro", "supporter", "recruiter"]] = None,
) -> dict:
    """
    Sync Discord roles based on subscription tier change.
    
    This handles:
    - Adding the appropriate role for the new tier
    - Removing the old tier's role if applicable
    - Upgrading from Supporter to Recruiter (adds Recruiter, keeps Supporter as bonus)
    
    Args:
        discord_user_id: Discord user ID
        new_tier: New subscription tier
        old_tier: Previous subscription tier (optional)
        
    Returns:
        Dict with success status and details
    """
    if not is_discord_sync_configured():
        return {
            "success": False,
            "error": "Discord role sync not configured",
            "configured": False,
        }
    
    if not discord_user_id:
        return {
            "success": False,
            "error": "No Discord account linked",
            "configured": True,
        }
    
    results = {
        "success": True,
        "configured": True,
        "discord_user_id": discord_user_id,
        "new_tier": new_tier,
        "actions": [],
    }
    
    # Determine which roles to add/remove based on tier
    # Role hierarchy: Recruiter > Supporter > Free
    # Recruiters keep Supporter role as well (they get both perks)
    
    if new_tier == "recruiter":
        # Add Recruiter role
        if DISCORD_RECRUITER_ROLE_ID:
            success = await add_role_to_member(discord_user_id, DISCORD_RECRUITER_ROLE_ID)
            results["actions"].append({
                "action": "add",
                "role": "Recruiter",
                "success": success,
            })
        # Also add Supporter role (Recruiters get Supporter perks too)
        if DISCORD_SUPPORTER_ROLE_ID:
            success = await add_role_to_member(discord_user_id, DISCORD_SUPPORTER_ROLE_ID)
            results["actions"].append({
                "action": "add",
                "role": "Supporter",
                "success": success,
            })
            
    elif new_tier in ("pro", "supporter"):
        # Add Supporter role
        if DISCORD_SUPPORTER_ROLE_ID:
            success = await add_role_to_member(discord_user_id, DISCORD_SUPPORTER_ROLE_ID)
            results["actions"].append({
                "action": "add",
                "role": "Supporter",
                "success": success,
            })
        # Remove Recruiter role if downgrading
        if old_tier == "recruiter" and DISCORD_RECRUITER_ROLE_ID:
            success = await remove_role_from_member(discord_user_id, DISCORD_RECRUITER_ROLE_ID)
            results["actions"].append({
                "action": "remove",
                "role": "Recruiter",
                "success": success,
            })
            
    elif new_tier == "free":
        # Remove all subscription roles
        if DISCORD_SUPPORTER_ROLE_ID:
            success = await remove_role_from_member(discord_user_id, DISCORD_SUPPORTER_ROLE_ID)
            results["actions"].append({
                "action": "remove",
                "role": "Supporter",
                "success": success,
            })
        if DISCORD_RECRUITER_ROLE_ID:
            success = await remove_role_from_member(discord_user_id, DISCORD_RECRUITER_ROLE_ID)
            results["actions"].append({
                "action": "remove",
                "role": "Recruiter",
                "success": success,
            })
    
    # Check if any actions failed
    failed_actions = [a for a in results["actions"] if not a["success"]]
    if failed_actions:
        results["success"] = False
        results["error"] = f"Some role actions failed: {failed_actions}"
    
    return results


async def assign_settler_role(discord_user_id: str) -> dict:
    """
    Assign the Settler role to a Discord user when they link their Kingshot account.
    
    Args:
        discord_user_id: Discord user ID
        
    Returns:
        Dict with success status and details
    """
    if not DISCORD_BOT_TOKEN or not DISCORD_GUILD_ID:
        return {
            "success": False,
            "error": "Discord role sync not configured",
            "configured": False,
        }
    
    if not discord_user_id:
        return {
            "success": False,
            "error": "No Discord account linked",
            "configured": True,
        }
    
    if not DISCORD_SETTLER_ROLE_ID:
        return {
            "success": False,
            "error": "Settler role ID not configured",
            "configured": True,
        }
    
    success = await add_role_to_member(discord_user_id, DISCORD_SETTLER_ROLE_ID)
    
    result = {
        "success": success,
        "configured": True,
        "discord_user_id": discord_user_id,
        "role": "Settler",
        "role_id": DISCORD_SETTLER_ROLE_ID,
    }
    
    if not success:
        result["error"] = "Discord API call failed - user may not be in server or bot lacks permissions"
    
    return result


async def remove_settler_role(discord_user_id: str) -> dict:
    """
    Remove the Settler role from a Discord user when they unlink their Kingshot account.
    
    Args:
        discord_user_id: Discord user ID
        
    Returns:
        Dict with success status and details
    """
    if not DISCORD_BOT_TOKEN or not DISCORD_GUILD_ID:
        return {
            "success": False,
            "error": "Discord role sync not configured",
            "configured": False,
        }
    
    if not discord_user_id:
        return {
            "success": False,
            "error": "No Discord account linked",
            "configured": True,
        }
    
    if not DISCORD_SETTLER_ROLE_ID:
        return {
            "success": False,
            "error": "Settler role ID not configured",
            "configured": True,
        }
    
    success = await remove_role_from_member(discord_user_id, DISCORD_SETTLER_ROLE_ID)
    
    return {
        "success": success,
        "configured": True,
        "discord_user_id": discord_user_id,
        "role": "Settler",
        "role_id": DISCORD_SETTLER_ROLE_ID,
    }


async def sync_settler_role_for_user(user_id: str, is_linking: bool = True) -> dict:
    """
    Sync Settler role for a Supabase user when they link/unlink their Kingshot account.
    
    Args:
        user_id: Supabase user ID
        is_linking: True if linking account, False if unlinking
        
    Returns:
        Dict with sync result
    """
    from api.supabase_client import get_user_profile
    
    # Get user's Discord ID from profile
    profile = get_user_profile(user_id)
    if not profile:
        return {
            "success": False,
            "error": f"User profile not found: {user_id}",
        }
    
    discord_id = profile.get("discord_id")
    if not discord_id:
        return {
            "success": True,
            "skipped": True,
            "reason": "No Discord account linked to this user",
        }
    
    # Assign or remove the Settler role
    if is_linking:
        result = await assign_settler_role(discord_id)
    else:
        result = await remove_settler_role(discord_id)
    
    # Log the sync attempt
    action = "link" if is_linking else "unlink"
    logger.info("Settler role sync (%s) for user %s: %s", action, user_id, result)
    
    return result


async def sync_user_discord_role(user_id: str, new_tier: str, old_tier: Optional[str] = None) -> dict:
    """
    High-level function to sync Discord role for a Supabase user.
    
    Fetches the user's discord_id from their profile and syncs roles.
    
    Args:
        user_id: Supabase user ID
        new_tier: New subscription tier
        old_tier: Previous subscription tier (optional)
        
    Returns:
        Dict with sync result
    """
    from api.supabase_client import get_user_profile
    
    # Get user's Discord ID from profile
    profile = get_user_profile(user_id)
    if not profile:
        return {
            "success": False,
            "error": f"User profile not found: {user_id}",
        }
    
    discord_id = profile.get("discord_id")
    if not discord_id:
        return {
            "success": True,
            "skipped": True,
            "reason": "No Discord account linked to this user",
        }
    
    # Sync the role
    result = await sync_subscription_role(
        discord_user_id=discord_id,
        new_tier=new_tier,
        old_tier=old_tier,
    )
    
    # Log the sync attempt
    logger.info("Discord role sync for user %s: %s", user_id, result)
    
    return result
