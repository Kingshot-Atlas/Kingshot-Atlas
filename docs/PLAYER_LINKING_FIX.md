# Kingshot Player Linking - Complete Fix Documentation

## Issues Identified & Fixed

### 0. Empty Environment Variable Fallback (Jan 30, 2026)
**Problem:** `KINGSHOT_API_SALT` env var set to empty string in production bypassed default fallback
**Symptoms:** "Player linking service not configured" error
**Root Cause:** `os.getenv("VAR", "default")` returns empty string if VAR exists but is empty
**Fix:** Added explicit empty-string check with guaranteed fallback to working salt
**File:** `/apps/api/api/routers/player_link.py` (lines 27-31)

```python
# Before (broken):
KINGSHOT_API_SALT = os.getenv("KINGSHOT_API_SALT", "mN4!pQs6JrYwV9")

# After (fixed):
_DEFAULT_SALT = "mN4!pQs6JrYwV9"
_env_salt = os.getenv("KINGSHOT_API_SALT", "")
KINGSHOT_API_SALT = _env_salt.strip() if _env_salt.strip() else _DEFAULT_SALT
```

### 1. Database Schema Missing
**Problem:** Supabase `profiles` and `user_data` tables didn't exist
**Symptoms:** 404/406/400 errors on profile queries
**Fix:** Created complete database setup script
**File:** `/docs/migrations/setup_supabase.sql`

### 2. Persistence Logic Issue
**Problem:** Code only restored linked data if `!data.linked_player_id`
**Symptoms:** Linked player data lost on refresh
**Fix:** Updated logic to prioritize cache over null DB values
**File:** `/apps/web/src/contexts/AuthContext.tsx` (lines 282-298)

### 3. Update Profile Issue
**Problem:** updateProfile wasn't saving linked fields to Supabase
**Symptoms:** Data only saved locally, not to database
**Fix:** Now saves ALL fields including linked player data
**File:** `/apps/web/src/contexts/AuthContext.tsx` (lines 387-400)

### 4. Service Worker CSP Violations
**Problem:** Service worker tried to cache external resources
**Symptoms:** Massive CSP violation errors in console
**Fix:** Updated service worker to skip external resources
**File:** `/public/service-worker.js` (lines 101-104, 127-128)

### 5. CORS Issue with Avatars
**Problem:** Akamai CDN blocked images with `crossOrigin="anonymous"`
**Symptoms:** Avatar images not loading
**Fix:** Use `referrerPolicy="no-referrer"` instead
**File:** `/apps/web/src/components/LinkKingshotAccount.tsx` (line 80)

## Setup Instructions

### 1. Database Setup (Required)
Run in Supabase Dashboard → SQL Editor:
```sql
-- Copy contents of /docs/migrations/setup_supabase.sql
```

### 2. Clear Service Worker Cache (Required)
In browser console:
```javascript
// Clear all caches and unregister service workers
if ('caches' in window) {
  caches.keys().then(cacheNames => {
    return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  }).then(() => window.location.reload());
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    return Promise.all(registrations.map(reg => reg.unregister()));
  });
}
```

## Prevention Measures

### 1. Database Setup
- Always run the complete setup script for new deployments
- Include table creation in deployment documentation
- Verify tables exist before testing features

### 2. Service Worker
- Never cache external resources
- Always check origin before caching
- Test CSP compliance in development

### 3. Persistence Logic
- Test both null and populated database states
- Prioritize user data over empty database responses
- Add comprehensive logging for debugging

### 4. CORS Issues
- Test avatar URLs from different CDNs
- Use `referrerPolicy="no-referrer"` for Akamai
- Add fallback UI for failed loads

## Testing Checklist

- [ ] Database tables created (profiles, user_data)
- [ ] RLS policies applied
- [ ] Service worker cache cleared
- [ ] Link Kingshot account
- [ ] Verify avatar displays
- [ ] Refresh page
- [ ] Verify data persists
- [ ] Check console for errors

## Files Changed

1. `/apps/api/api/routers/player_link.py` - Fixed empty env var fallback (Jan 30, 2026)
2. `/apps/web/src/contexts/AuthContext.tsx` - Fixed persistence and update logic
3. `/apps/web/public/service-worker.js` - Fixed CSP violations
4. `/apps/web/src/components/LinkKingshotAccount.tsx` - Fixed CORS issue
5. `/docs/migrations/setup_supabase.sql` - Complete database setup
6. `/docs/migrations/add_linked_player_columns.sql` - Column migration (already run)

## Deployment Notes

- Frontend deployed to: https://ks-atlas.com
- Backend API at: https://kingshot-atlas.onrender.com
- Database: Supabase (qdczmafwcvnwfvixxbwg.supabase.co)

## Future Improvements

1. Add database migration runner
2. Add automated CSP testing
3. Add service worker debugging tools
4. Add profile data validation
5. Add error boundary for profile loading
