# Authentication Troubleshooting Guide

## Current Status
- Environment variables are configured in `.env`
- Supabase client is being created
- Debug logging has been added to track the issue

## Test URLs
- Auth Test: http://localhost:3000/auth-test
- Auth Debug: http://localhost:3000/auth-debug
- Environment Test: http://localhost:3000/env-test.html

## Common Issues & Solutions

### 1. Redirect URLs Not Configured
**Location**: Supabase Dashboard → Authentication → URL Configuration

**Required URLs**:
- Development: `http://localhost:3000`
- Production: `https://ks-atlas.com`
- Netlify: `https://ks-atlas.netlify.app`

**Add to both**:
- Site URL (single URL)
- Redirect URLs (comma-separated list)

### 2. OAuth Providers Not Enabled
**Location**: Supabase Dashboard → Authentication → Providers

**Check**:
- Google provider is enabled
- Discord provider is enabled
- Client ID and Secret are correctly configured

### 3. Popup Blockers
**Symptoms**: No popup appears, no error in console
**Solution**: Allow popups for localhost in browser settings

### 4. Environment Variables Not Loading
**Check**:
- `.env` file exists in `apps/web/` directory
- Variables are prefixed with `REACT_APP_`
- Restart dev server after changing `.env`

### 5. CORS Issues
**Location**: Supabase Dashboard → Settings → API
**Ensure**: `http://localhost:3000` is in allowed origins

## Debug Steps

1. **Check Environment Variables**
   ```bash
   # In browser console
   console.log(process.env.REACT_APP_SUPABASE_URL)
   ```

2. **Test Supabase Connection**
   - Visit http://localhost:3000/auth-debug
   - Check if Supabase client is created
   - Test OAuth buttons

3. **Check Browser Console**
   - Look for "AuthModal:" logs
   - Look for "AuthContext:" logs
   - Check for any error messages

4. **Verify Redirect Flow**
   - Click sign-in button
   - Check if popup appears
   - Check if redirect happens after authentication

## Expected Flow
1. User clicks "Continue with Google/Discord"
2. OAuth popup opens
3. User authenticates with provider
4. Popup closes
5. User is redirected to `/profile`
6. Session is established

## If Still Not Working
1. Check Supabase dashboard for any error messages
2. Verify OAuth app credentials are correct
3. Check network tab for failed requests
4. Try incognito/private browsing mode
