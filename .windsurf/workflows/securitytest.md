---
description: Comprehensive security testing workflow for Kingshot Atlas system
---

# Security Audit Workflow — Kingshot Atlas

**Purpose:** Regularly audit the Supabase database and frontend for security vulnerabilities. Catches new tables without RLS, overly permissive policies, exposed functions, and leaked sensitive data.

**Frequency:** Run after every database migration, new table creation, or monthly.

**Project ID:** `qdczmafwcvnwfvixxbwg`

---

## Phase 1: Supabase Security Advisors

Run the built-in Supabase security and performance advisors.

```
Use mcp3_get_advisors with project_id: qdczmafwcvnwfvixxbwg, type: security
Use mcp3_get_advisors with project_id: qdczmafwcvnwfvixxbwg, type: performance
```

**Expected:** 0 lints. If any appear, fix immediately.

---

## Phase 2: RLS Audit — All Tables

Check every public table has RLS enabled:

```sql
-- Run via mcp3_execute_sql
SELECT tablename,
       rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Expected:** ALL tables show `rls_enabled: true`. Fix any `false` immediately:
```sql
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
```

---

## Phase 3: RLS Policy Deep Inspection

Check for overly permissive policies (especially anon access):

```sql
-- Run via mcp3_execute_sql
SELECT schemaname, tablename, policyname,
       permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Red flags to check:**
- Any policy with `roles: {public}` or `roles: {anon}` that has `qual: true` (unrestricted)
- Any policy granting anon INSERT/UPDATE/DELETE access
- Policies named for one role but applied to another (e.g., "Service role..." applied to {public})
- Duplicate policies on the same table with same cmd

---

## Phase 4: Column-Level Privilege Audit (profiles table)

Verify sensitive columns are restricted from anon and authenticated:

```sql
-- Run via mcp3_execute_sql
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges
WHERE table_name = 'profiles' AND table_schema = 'public'
AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, column_name;
```

**Sensitive columns that MUST NOT appear for anon:**
`email`, `stripe_customer_id`, `stripe_subscription_id`, `discord_id`, `is_admin`, `alt_accounts`, `coordinates`, `referred_by`, `subscription_source`, `subscription_started_at`, `linked_last_synced`

**Sensitive columns that MUST NOT appear for authenticated:**
`email`, `stripe_customer_id`, `stripe_subscription_id`, `alt_accounts`, `referred_by`, `subscription_source`, `subscription_started_at`

---

## Phase 5: Function EXECUTE Privilege Audit

Check that admin/cron functions are NOT callable by anon:

```sql
-- Run via mcp3_execute_sql
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_call,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_can_call
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prorettype != 'trigger'::regtype
AND p.proname NOT LIKE 'is_%'
AND p.proname NOT LIKE 'fn_%'
AND p.proname NOT LIKE 'kingdom_has_%'
ORDER BY p.proname;
```

**Red flags:**
- Admin/cron functions with `anon_can_call: true` (e.g., `deplete_kingdom_funds`, `backfill_*`, `disable_kvk_triggers`)
- User-callable functions with `anon_can_call: true` (e.g., `submit_kvk_partial`, `submit_endorsement`)

**Fix pattern:**
```sql
REVOKE EXECUTE ON FUNCTION public.<func_name>(<args>) FROM PUBLIC, anon, authenticated;
-- For user-callable functions, grant back to authenticated:
GRANT EXECUTE ON FUNCTION public.<func_name>(<args>) TO authenticated;
```

---

## Phase 6: Anonymous Access Smoke Tests

Test that anon cannot access sensitive data:

```sql
-- Run via mcp3_execute_sql
-- Test 1: Anon cannot read emails
SET ROLE anon;
SELECT id, email FROM profiles LIMIT 1;
-- EXPECTED: permission denied

-- Test 2: Anon cannot read discord_link_attempts
SET ROLE anon;
SELECT * FROM discord_link_attempts LIMIT 1;
-- EXPECTED: empty result or permission denied

-- Test 3: Anon CAN read safe profile columns
SET ROLE anon;
SELECT id, username, linked_username FROM profiles LIMIT 1;
-- EXPECTED: returns data
```

---

## Phase 7: Statement & Lock Timeout Audit

Verify timeouts are set to prevent DoS:

```sql
-- Run via mcp3_execute_sql
SELECT rolname,
       (SELECT setting FROM pg_catalog.pg_db_role_setting drs
        CROSS JOIN unnest(drs.setconfig) AS setting
        WHERE drs.setrole = r.oid AND setting LIKE 'statement_timeout%') as statement_timeout,
       (SELECT setting FROM pg_catalog.pg_db_role_setting drs
        CROSS JOIN unnest(drs.setconfig) AS setting
        WHERE drs.setrole = r.oid AND setting LIKE 'lock_timeout%') as lock_timeout
FROM pg_roles r
WHERE rolname IN ('anon', 'authenticated', 'authenticator');
```

**Expected:**
- `anon`: statement_timeout=8s, lock_timeout=4s
- `authenticated`: statement_timeout=15s, lock_timeout=8s
- `authenticator`: statement_timeout=15s

---

## Phase 8: Frontend Query Audit

Check that no frontend code selects restricted columns from profiles:

```bash
# Search for select('*') on profiles — should NOT exist (use get_my_profile RPC instead)
grep -rn "from('profiles').*select('\*')" apps/web/src/

# Search for restricted columns in profile queries
grep -rn "from('profiles')" apps/web/src/ | grep -E "email|stripe_customer_id|stripe_subscription_id|alt_accounts"
```

**Expected:** No matches. Any `select('*')` on profiles should use the `get_my_profile()` RPC instead.

---

## Phase 9: View Security Check

Verify views use security_invoker:

```sql
-- Run via mcp3_execute_sql
SELECT viewname,
       (SELECT option_value FROM pg_options_to_table(v.reloptions)
        WHERE option_name = 'security_invoker') as security_invoker
FROM pg_views pv
JOIN pg_class v ON v.relname = pv.viewname
WHERE schemaname = 'public';
```

**Expected:** All views should have `security_invoker = true` (or be confirmed safe).

---

## Phase 10: Dependency Vulnerability Scan

// turbo
```bash
cd /Users/giovanni/projects/ai/Kingshot\ Atlas/apps/web && npm audit --production 2>&1 | head -30
```

**Expected:** 0 critical or high vulnerabilities. Fix with `npm audit fix` if safe.

---

## Reporting Template

After completing all phases, provide a summary:

```
# Security Audit Report — [DATE]

## Results
| Phase | Status | Issues Found |
|-------|--------|-------------|
| 1. Supabase Advisors | ✅/⚠️ | ... |
| 2. RLS Enabled | ✅/⚠️ | ... |
| 3. Policy Inspection | ✅/⚠️ | ... |
| 4. Column Privileges | ✅/⚠️ | ... |
| 5. Function Privileges | ✅/⚠️ | ... |
| 6. Anon Smoke Tests | ✅/⚠️ | ... |
| 7. Timeouts | ✅/⚠️ | ... |
| 8. Frontend Queries | ✅/⚠️ | ... |
| 9. View Security | ✅/⚠️ | ... |
| 10. Dependencies | ✅/⚠️ | ... |

## Actions Taken
- ...

## Recommended Next Steps
- ...
```
