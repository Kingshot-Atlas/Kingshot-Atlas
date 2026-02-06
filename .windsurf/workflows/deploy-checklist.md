# Deploy Checklist Workflow

When completing any task that modifies code, ALWAYS run this checklist before ending the session.

## Pre-Session End Checklist

### 1. Check for Uncommitted Changes
// turbo
```bash
git status
```

If there are uncommitted changes:
- Stage all relevant changes: `git add -A`
- Commit with descriptive message
- Push to main: `git push origin main`

### 2. Verify Deployment Pipeline
After pushing:
- Cloudflare Pages (frontend): Auto-deploys from main branch
- Render (backend): Auto-deploys from main branch

### 3. Test Production
After ~3 minutes, verify:
- https://ks-atlas.com loads correctly
- Key feature changes are visible
- No console errors on critical paths

## Common Gotchas

### Frontend Changes Not Appearing
1. Check Cloudflare Pages build output is `dist`
2. Verify env vars are set in Cloudflare Dashboard
3. Hard refresh browser (Cmd+Shift+R)

### API Changes Not Working
1. Backend auto-deploys on Render - check Render dashboard
2. CORS errors often mean backend crashed before adding headers
3. Check Render logs for Python errors

### Database Changes
1. Supabase migrations must be applied via MCP or dashboard
2. RLS policies must allow the operation
3. Check Supabase logs for errors

## Emergency Rollback
```bash
git revert HEAD
git push origin main
```
