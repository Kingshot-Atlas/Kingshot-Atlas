# Kingshot Atlas — Performance & Stability Audit Report

**Date:** June 2025  
**Scope:** Supabase database, Frontend (React), Backend API (FastAPI)  
**Project:** qdczmafwcvnwfvixxbwg (Supabase Nano, us-east-1)

---

## Executive Summary

The audit found **1 critical issue** (connection saturation at 68% idle), **several medium-severity RLS performance problems** (now fixed), and **2 security vulnerabilities** (now fixed). The system is generally well-architected with proper statement timeouts, 100% RLS coverage, and good caching strategies — but the Nano instance is running close to its limits.

---

## 🔴 CRITICAL — Connection Saturation

| Metric | Value |
|--------|-------|
| Active connections at idle | **41 / 60** (68%) |
| Available for user traffic | **~16** (after 3 superuser reserved) |
| PostgREST pool (idle) | 21 |
| Realtime infrastructure | 8 |
| Background workers | 8 |
| Monitoring/Cron | 4 |

### Risk
During a KvK Transfer Event, traffic spikes could easily consume the remaining 16 connections, causing **connection refused errors** for all users.

### Fixes Applied
- ✅ **Set `idle_in_transaction_session_timeout = 30s`** — was `0` (disabled). Idle transactions were holding connections indefinitely. *(Migration: `set_idle_in_transaction_timeout`)*

### Remaining Recommendations
- **Upgrade to Supabase Pro (Small)** — increases `max_connections` to 200+, which gives real headroom
- **Switch Auth connection strategy to percentage-based** — currently hardcoded at 10 connections absolute (Supabase advisor flag)
- **Monitor connection count** — set up an alert when connections exceed 50/60

---

## 🟡 MEDIUM — RLS Policy Performance (FIXED)

### Auth RLS InitPlan Issue
Multiple RLS policies were calling `auth.uid()` directly instead of `(select auth.uid())`. This caused the function to be **re-evaluated for every row** instead of once per query.

**Affected tables (all fixed via migrations):**
- `tool_access` — 2 policies fixed
- `battle_registry_entries` — 3 policies fixed
- `battle_registries` — 2 policies fixed  
- `battle_registry_managers` — 2 policies fixed

**Migrations applied:**
- `fix_rls_initplan_tool_access`
- `fix_rls_initplan_battle_registries`
- `fix_rls_initplan_battle_registry_entries`
- `fix_rls_initplan_battle_registry_managers`
- `fix_rls_initplan_battle_registry_managers_insert`

### Multiple Permissive Policies (Not Fixed — Low Priority)
These tables have overlapping permissive policies that both get evaluated on every query:
- `kvk_matchup_reports` — admin + user SELECT/INSERT overlap
- `kvk_schedule` — admin + public SELECT overlap
- `tool_access` — admin ALL + user SELECT overlap

**Recommendation:** Consolidate into single policies with `CASE` logic, or make the admin policy `RESTRICTIVE` + the user policy `PERMISSIVE`.

---

## 🟡 MEDIUM — Security Vulnerabilities (FIXED)

| Issue | Table/Function | Fix |
|-------|---------------|-----|
| SECURITY DEFINER view | `kingdom_review_summaries` | Changed to `security_invoker = true` |
| Mutable `search_path` | `is_registry_manager()` | Added `SET search_path = public` |

**Migrations applied:**
- `fix_kingdom_review_summaries_security_invoker`
- `fix_is_registry_manager_search_path`

---

## 🟡 MEDIUM — Missing Foreign Key Indexes (FIXED)

Added indexes on unindexed foreign keys flagged by Supabase performance advisor:

| Table | Column | Index Created |
|-------|--------|--------------|
| `battle_registry_entries` | `added_by` | `idx_battle_registry_entries_added_by` |
| `battle_registry_managers` | `assigned_by` | `idx_battle_registry_managers_assigned_by` |
| `tool_access` | `granted_by` | `idx_tool_access_granted_by` |

**Migration:** `add_missing_foreign_key_indexes`

---

## ✅ GOOD — What's Working Well

### Database
- **100% RLS coverage** — all 78 public tables have RLS enabled with policies
- **Statement timeouts configured** — `anon: 10s`, `authenticated: 15s`, `authenticator: 15s + lock_timeout: 8s`
- **Good index coverage** on transfer tables (`transfer_applications`, `transfer_profiles`, `application_messages`, `kingdoms`, `kvk_history`)
- **Unique constraints** enforce data integrity (`unique_active_editor`, `transfer_profile_views` dedup, `kvk_history` composites)

### Frontend
- **No global realtime subscriptions** — past resource exhaustion incident properly addressed (removed `useKingdomsRealtime`)
- **`refetchOnWindowFocus: false`** — prevents unnecessary refetches
- **React Query caching** with appropriate `staleTime` values
- **Lazy-loaded pages** in `App.tsx` with `React.lazy()`
- **Supabase as single source of truth** (ADR-011) with no stale JSON fallbacks

### Backend API
- **Rate limiting** on auth endpoints (`5/min register`, `10/min login`)
- **Rate limiting** on external API calls (`10/min verify`, `5/hour refresh`)
- **GZip compression** enabled
- **Sentry error monitoring** integrated
- **Timeout + retry** in frontend API service (`10s timeout`, `2 retries`)

### Caching
- **kingdomsSupabaseService** — 5s in-memory cache (short TTL for freshness)
- **React Query** — appropriate staleTime per hook
- **Batched Supabase fetches** — 1000-row batches for kingdoms data

---

## 📋 Remaining Recommendations (Not Applied)

### High Priority
1. **Upgrade Supabase plan** — Nano (60 connections) is too tight for production with 41 idle. Pro/Small gives 200+ connections.
2. **Replace in-memory rate limiter** — `rate_limiter.py` uses in-memory store explicitly marked "for development." Replace with Redis or a persistent store for production multi-instance deployments.

### Medium Priority
3. **Consolidate overlapping RLS policies** on `kvk_matchup_reports`, `kvk_schedule`, `tool_access` to reduce per-query evaluation overhead.
4. **Switch Auth DB connection strategy** from absolute (10) to percentage-based for better scaling when upgrading instance size.
5. **Add monitoring/alerting** for connection count approaching 60.

### Low Priority
6. **Audit unused indexes** — 15+ indexes flagged as never used (e.g., `idx_feedback_type`, `idx_data_corrections_kingdom`, `idx_discord_api_log_status`). Consider dropping to reduce write overhead and storage.
7. **Consider increasing `kingdomsSupabaseService` cache TTL** from 5s to 30s+ for pages that don't need real-time freshness (e.g., homepage kingdom listing).

---

## Migrations Applied (8 total)

| # | Migration Name | Purpose |
|---|---------------|---------|
| 1 | `set_idle_in_transaction_timeout` | Set 30s timeout for idle transactions |
| 2 | `add_missing_foreign_key_indexes` | 3 FK indexes on battle/tool tables |
| 3 | `fix_rls_initplan_tool_access` | Optimize 2 RLS policies |
| 4 | `fix_rls_initplan_battle_registries` | Optimize 2 RLS policies |
| 5 | `fix_rls_initplan_battle_registry_entries` | Optimize 3 RLS policies |
| 6 | `fix_rls_initplan_battle_registry_managers` | Optimize 1 RLS policy |
| 7 | `fix_is_registry_manager_search_path` | Security: set search_path |
| 8 | `fix_kingdom_review_summaries_security_invoker` | Security: INVOKER view |
| 9 | `fix_rls_initplan_battle_registry_managers_insert` | Optimize 1 RLS policy |
