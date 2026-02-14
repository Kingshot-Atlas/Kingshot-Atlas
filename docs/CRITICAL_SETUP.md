# Kingshot Atlas - Critical Setup Documentation

## 🚨 Critical Setup Requirements

### 1. Database Setup (MANDATORY)
**File:** `/docs/migrations/recreate_profiles.sql`

When setting up a new Supabase instance or fixing database issues:

```sql
-- ALWAYS run this script first
-- It creates the complete database schema with all required columns
-- Including linked Kingshot player fields
```

**Why this is critical:**
- The profiles table MUST include linked player columns for Kingshot Player Linking
- PostgREST schema cache needs to be refreshed after table changes
- RLS policies must be in place for security

### 2. Service Worker Configuration (MANDATORY)
**File:** `/public/service-worker.js`

**Critical Rule:** NEVER cache external resources
```javascript
// Skip external resources (avatars, fonts, etc.) - let browser handle them
if (url.origin !== self.location.origin) {
  return;
}
```

**Why this is critical:**
- Prevents CSP violations
- Avoids caching external API calls
- Stops service worker from blocking external images

### 3. CORS Configuration for Avatars (MANDATORY)
**Files:** 
- `/apps/web/src/components/LinkKingshotAccount.tsx`
- `/apps/web/src/pages/Profile.tsx`

**Critical Rule:** Use `referrerPolicy="no-referrer"` for Akamai CDN
```jsx
<img
  src={avatarUrl}
  referrerPolicy="no-referrer"
  // NEVER use crossOrigin="anonymous" with Akamai
/>
```

**Why this is critical:**
- Akamai CDN doesn't send proper CORS headers
- `crossOrigin="anonymous"` blocks images
- `referrerPolicy="no-referrer"` allows images to load

## 🔧 Troubleshooting Guide

### Issue: Kingshot Player Linking Not Persisting
**Symptoms:** Data lost after refresh
**Cause:** Missing database columns or schema cache issues
**Fix:** Run `/docs/migrations/recreate_profiles.sql`

### Issue: Avatar Images Not Loading
**Symptoms:** Dark circles instead of images
**Cause:** CORS issue with Akamai CDN
**Fix:** Ensure `referrerPolicy="no-referrer"` is used

### Issue: CSP Violations in Console
**Symptoms:** Massive CSP error spam
**Cause:** Service worker caching external resources
**Fix:** Update service worker to skip external origins

### Issue: Supabase 406/400 Errors
**Symptoms:** "Could not find column" errors
**Cause:** PostgREST schema cache outdated
**Fix:** Run `NOTIFY pgrst, 'reload schema'`

## 📋 Setup Checklist for New Deployments

### Database Setup
- [ ] Run `/docs/migrations/recreate_profiles.sql`
- [ ] Verify all columns exist in profiles table
- [ ] Check RLS policies are active
- [ ] Test PostgREST schema refresh

### Frontend Setup
- [ ] Verify service worker skips external resources
- [ ] Check avatar components use `referrerPolicy="no-referrer"`
- [ ] Clear service worker cache after deployment
- [ ] Test CSP compliance

### Testing Checklist
- [ ] Link Kingshot account
- [ ] Verify avatar displays
- [ ] Refresh page
- [ ] Confirm data persists
- [ ] Check console for errors

## 🚨 Common Mistakes to Avoid

### 1. Never Use `crossOrigin="anonymous"` with Akamai
```jsx
// ❌ WRONG - blocks images
<img crossOrigin="anonymous" src={url} />

// ✅ CORRECT - allows images
<img referrerPolicy="no-referrer" src={url} />
```

### 2. Never Cache External Resources in Service Worker
```javascript
// ❌ WRONG - causes CSP violations
if (isImageRequest(url)) {
  cache.put(request, response.clone());
}

// ✅ CORRECT - skip external resources
if (url.origin !== self.location.origin) {
  return;
}
```

### 3. Always Refresh PostgREST Schema After Table Changes
```sql
-- Always run this after table modifications
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
```

## 📚 Reference Files

### Critical Files to Check
- `/docs/migrations/recreate_profiles.sql` - Database setup
- `/public/service-worker.js` - Service worker config
- `/apps/web/src/components/LinkKingshotAccount.tsx` - Avatar component
- `/apps/web/public/_headers` - CSP configuration
- `/docs/PLAYER_LINKING_FIX.md` - Complete fix documentation

### Environment Variables Required
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 🔄 Deployment Process

1. **Database Setup**
   - Run recreate_profiles.sql
   - Verify table structure

2. **Frontend Deployment**
   - Push to main (auto-deploys via Cloudflare Pages)
   - Clear service worker cache

3. **Testing**
   - Test complete Kingshot Player Linking flow
   - Verify avatar display
   - Check data persistence

## 🆘 Emergency Fixes

### If Kingshot Player Linking Stops Working:
1. Run `/docs/migrations/recreate_profiles.sql`
2. Clear browser service worker cache
3. Test again

### If Avatars Stop Displaying:
1. Check for `referrerPolicy="no-referrer"` in avatar components
2. Verify CSP includes `https://*.akamaized.net`
3. Clear browser cache

### If CSP Errors Appear:
1. Update service worker to skip external resources
2. Deploy updated service worker
3. Clear all caches

---

**Last Updated:** 2026-02-14  
**Purpose:** Prevent common Kingshot Atlas setup issues  
**Audience:** All agents working on Kingshot Atlas
