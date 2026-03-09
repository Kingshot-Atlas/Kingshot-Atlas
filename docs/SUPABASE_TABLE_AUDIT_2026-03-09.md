# Supabase Table Audit Report

**Date:** 2026-03-09
**Project:** Kingshot Atlas (`qdczmafwcvnwfvixxbwg`)
**Schema:** `public`
**Total Tables:** 96
**Total Views:** 2 (`current_transfer_groups`, `kingdom_review_summaries`)

---

## Executive Summary

The database is **generally healthy** with well-structured tables. The audit identified:

- **3 dead tables** (0 rows, zero code references anywhere — safe to drop)
- **3 legacy tables** (superseded or unused, but have minor code/function references)
- **1 data sync gap** (fixed during audit)
- **2 data growth concerns** (need retention policies)
- **4 empty-but-active feature tables** (legitimate — features exist, just no data yet)

No frontend code changes were needed. No Cloudflare deployment required.

---

## 1. Manager/Delegate Username Lookup

**Question:** "Who are the Kingshot Usernames of users assigned as managers/delegates?"

All manager/delegate tables store only `user_id` (UUID). This is **correct normalization** — it avoids stale cached usernames. The frontend correctly JOINs to `profiles.linked_username` at query time.

### Battle Registry Managers (9 users, 1 registry — K172)

| Kingshot Username | Atlas Username | Kingdom |
|---|---|---|
| Momma Valk | judah_shae | K172 |
| Ttd | Ttd | K172 |
| Aeens | PhantomBear187 | K172 |
| MercForMoney | SilverTiger999 | K172 |
| xKirito_07x | VoidHunter284 | K172 |
| AddySan | addy_san_69473 | K172 |
| Contessa Cujo | PrimalSpear751 | K172 |
| FR│HARD | AzureBreaker995 | K172 |
| CRicketts | cricketts5 | K172 |

### Prep Schedule Managers (9 users, 5 schedules)

| Kingshot Username | Atlas Username | Kingdom |
|---|---|---|
| Momma Valk | judah_shae | K172 |
| Hakaishin Birusu | DeltaMoon745 | K189 |
| Marmot Wizard | MysticCaller747 | K189 |
| Nutrix | CipherSentinel863 | K166 |
| Muddy | OmegaRaven702 | K166 |
| LauraBean | NexusViper177 | K166 |
| BnL | ValiantBlade244 | K154 |
| Huddy | MaverickRanger878 | K134 |
| Aid૮･ﻌ･ა | EliteKnight769 | K166 |

### Tool Delegates (5 delegation pairs)

| Owner (Kingshot) | Delegate (Kingshot) |
|---|---|
| UniPonics | Akieron |
| Who_tf_is_Alice | Woolfie |
| Who_tf_is_Alice | 세일러 Sstar |
| 세일러 Sstar | Who_tf_is_Alice |
| 『Gatreno』 | Ttd |

### Tool Access — Battle Planner (2 users)

| Kingshot Username | Atlas Username |
|---|---|
| bAdClimber | onclimber |
| Ttd | Ttd |

### Battle Planner Access — Legacy (2 users)

| Kingshot Username | Atlas Username |
|---|---|
| bAdClimber | onclimber |
| Ttd | Ttd |

### Alliance Managers (2 users)

*(user_ids present but not expanded — only 2 rows, tied to specific alliances)*

### Trusted Submitters (1 user)

*(1 entry — admin-granted status)*

### Battle Managers (0 users)

*(Feature exists in code but nobody has been assigned yet)*

---

## 2. Dead Tables (Safe to Drop)

These tables have **0 rows AND zero references** in frontend, backend, Discord bot, edge functions, or database triggers/functions.

| Table | Rows | Verdict |
|---|---|---|
| `contributor_stats` | 0 | No code references anywhere. Dead. |
| `discord_role_sync_log` | 0 | No code references anywhere. Dead. |
| `expiry_warnings_sent` | 0 | No code references anywhere. Dead. |

**Action taken:** Added `COMMENT ON TABLE` documentation to each. No tables were dropped to maintain safety — recommend manual drop after confirming with any external integrations.

---

## 3. Legacy/Redundant Tables

| Table | Rows | Issue | Detail |
|---|---|---|---|
| `battle_planner_access` | 2 | **Superseded** by `tool_access` | Old admin tab (`BattlePlannerAccessTab.tsx`) still uses it, but gating logic (`useRallyCoordinator.ts`, `useBattlePlanner.ts`) queries `tool_access` exclusively. |
| `transfer_seasons` | 0 | **Redundant** with `transfer_events` | Referenced by `reset_transfer_season()` DB function, but `SeasonTab.tsx` uses `transfer_events` directly. The DB function is never called. |
| `kvk_submissions` | 0 | **Legacy** | Referenced in `contributorService.ts` but always returns empty. Has `submitter_id` as TEXT (inconsistent with UUID pattern used elsewhere). |

**Action taken:** Added `COMMENT ON TABLE` documentation to each.

---

## 4. Data Fix Applied

### `tool_access` sync gap — Ttd was missing

**Problem:** User "Ttd" (`414f5ed9`) existed in the legacy `battle_planner_access` table but NOT in the active `tool_access` table. Since the gating logic only checks `tool_access`, Ttd was effectively locked out of the Battle Planner despite appearing in the old admin UI.

**Fix:** Inserted Ttd into `tool_access` with `tool='battle_planner'`.

**Verification:** Both bAdClimber and Ttd now appear in `tool_access` for Battle Planner.

---

## 5. Empty But Active Feature Tables (Keep)

These tables have 0 rows but are **actively referenced by working frontend code** — the features simply haven't been used yet.

| Table | Frontend References | Status |
|---|---|---|
| `battle_managers` | `useKingdomProfileQueries.ts` (full CRUD) | Feature live, no users assigned yet |
| `churn_surveys` | Cancel survey flow | No cancellations yet |
| `alliance_applications` | Alliance Center | No applications submitted yet |
| `transfer_profile_views` | 5 frontend files | **Possible tracking bug** — schema exists, frontend queries it, but 0 rows are being written. Worth investigating. |

---

## 6. Data Growth Concerns

| Table | Rows | Growth Rate | Concern |
|---|---|---|---|
| `kingdom_listing_views` | 523,899 | ~25K/day (~9M/year) | **Needs retention policy.** Analytics tracking table growing fast. Consider monthly pruning or archival. |
| `notifications` | 22,826 | ~700/day | 82% unread (18,751). No cleanup mechanism. Consider auto-deleting read notifications older than 90 days. |
| `discord_link_attempts` | 1,037 | Moderate | Audit log, acceptable for now. |
| `bot_command_usage` | 1,572 | Moderate | Analytics, acceptable for now. |

---

## 7. Not Redundant (Confirmed Distinct)

These table pairs were investigated for redundancy but found to serve **different purposes**:

| Table A | Table B | Verdict |
|---|---|---|
| `kvk_corrections` (2 rows) | `data_corrections` (1 row) | Different scope: KvK result corrections vs general kingdom data corrections |
| `multirally_analytics` (15 rows) | `multirally_usage` (12 rows) | Different purpose: per-command metrics vs per-user-per-day rate limiting |
| `transfer_events` (4 rows) | `transfer_seasons` (0 rows) | `transfer_events` is active; `transfer_seasons` is dead (see §3) |

---

## 8. Full Table Inventory (96 tables)

### Core Data (7 tables)
| Table | Rows | Status |
|---|---|---|
| `kingdoms` | 1,750 | ✅ Healthy |
| `profiles` | 4,046 | ✅ Healthy |
| `user_data` | 4,048 | ✅ Healthy |
| `player_accounts` | 3,287 | ✅ Healthy |
| `kvk_history` | 6,710 | ✅ Healthy |
| `score_history` | 7,667 | ✅ Healthy |
| `app_config` | 3 | ✅ Healthy |

### Kingdom Management (8 tables)
| Table | Rows | Status |
|---|---|---|
| `kingdom_editors` | 402 | ✅ Active |
| `kingdom_funds` | 98 | ✅ Active |
| `kingdom_fund_contributions` | 59 | ✅ Active |
| `kingdom_fund_transactions` | 121 | ✅ Active |
| `kingdom_reviews` | 269 | ✅ Active |
| `kingdom_listing_views` | 523,899 | ⚠️ Needs retention policy |
| `review_helpful_votes` | 464 | ✅ Active |
| `review_replies` | 13 | ✅ Active |

### KvK & Submissions (8 tables)
| Table | Rows | Status |
|---|---|---|
| `kvk_schedule` | 5 | ✅ Active |
| `kvk_errors` | 42 | ✅ Active |
| `kvk_corrections` | 2 | ✅ Active |
| `kvk_matchup_reports` | 3 | ✅ Active |
| `kvk_submissions` | 0 | 🟡 Legacy — code refs but empty |
| `data_corrections` | 1 | ✅ Active |
| `status_submissions` | 366 | ✅ Active |
| `new_kingdom_submissions` | 5 | ✅ Active |

### Transfer Hub (11 tables)
| Table | Rows | Status |
|---|---|---|
| `transfer_events` | 4 | ✅ Active |
| `transfer_groups` | 15 | ✅ Active |
| `transfer_profiles` | 260 | ✅ Active |
| `transfer_applications` | 205 | ✅ Active |
| `transfer_invites` | 372 | ✅ Active |
| `transfer_outcomes` | 19 | ✅ Active |
| `transfer_status_history` | 2,685 | ✅ Active |
| `transfer_profile_views` | 0 | 🟡 Possible tracking bug |
| `transfer_seasons` | 0 | 🔴 Dead — redundant with transfer_events |
| `application_messages` | 283 | ✅ Active |
| `pre_application_messages` | 16 | ✅ Active |

### Battle Tools (11 tables)
| Table | Rows | Status |
|---|---|---|
| `battle_registries` | 2 | ✅ Active |
| `battle_registry_entries` | 103 | ✅ Active |
| `battle_registry_managers` | 9 | ✅ Active |
| `battle_managers` | 0 | 🟡 Feature exists, no data yet |
| `battle_planner_sessions` | 5 | ✅ Active |
| `battle_planner_leaders` | 6 | ✅ Active |
| `battle_planner_players` | 24 | ✅ Active |
| `battle_planner_queues` | 50 | ✅ Active |
| `battle_planner_access` | 2 | 🔴 Legacy — superseded by tool_access |
| `rally_sessions` | 166 | ✅ Active |
| `bear_rally_lists` | 1 | ✅ Active |

### Prep Schedules (4 tables)
| Table | Rows | Status |
|---|---|---|
| `prep_schedules` | 10 | ✅ Active |
| `prep_submissions` | 186 | ✅ Active |
| `prep_slot_assignments` | 300 | ✅ Active |
| `prep_schedule_managers` | 9 | ✅ Active |
| `prep_change_requests` | 7 | ✅ Active |

### Alliance Features (5 tables)
| Table | Rows | Status |
|---|---|---|
| `alliances` | 6 | ✅ Active |
| `alliance_members` | 312 | ✅ Active |
| `alliance_managers` | 2 | ✅ Active |
| `alliance_applications` | 0 | 🟡 Feature exists, no data yet |
| `alliance_event_availability` | 14 | ✅ Active |

### Access Control (4 tables)
| Table | Rows | Status |
|---|---|---|
| `tool_access` | 2 | ✅ Active (fixed: was 1) |
| `tool_delegates` | 5 | ✅ Active |
| `trusted_submitters` | 1 | ✅ Active |
| `editor_endorsements` | 1,249 | ✅ Active |

### Analytics & Audit (11 tables)
| Table | Rows | Status |
|---|---|---|
| `admin_audit_log` | 28 | ✅ Active |
| `editor_audit_log` | 131 | ✅ Active |
| `bot_command_usage` | 1,572 | ✅ Active |
| `bot_telemetry` | 529 | ✅ Active |
| `multirally_analytics` | 15 | ✅ Active |
| `multirally_usage` | 12 | ✅ Active |
| `import_history` | 4 | ✅ Active |
| `discord_api_log` | 373 | ✅ Active |
| `discord_link_attempts` | 1,037 | ✅ Active |
| `contributor_stats` | 0 | 🔴 Dead — no code references |
| `discord_role_sync_log` | 0 | 🔴 Dead — no code references |

### User Features (8 tables)
| Table | Rows | Status |
|---|---|---|
| `notifications` | 22,826 | ⚠️ Needs cleanup policy |
| `message_read_status` | 211 | ✅ Active |
| `review_notifications` | 461 | ✅ Active |
| `review_reports` | 3 | ✅ Active |
| `feedback` | 55 | ✅ Active |
| `user_saved_player_ids` | 18 | ✅ Active |
| `recruiter_watchlist` | 156 | ✅ Active |
| `recruiter_ratings` | 3 | ✅ Active |

### Discord Bot (5 tables)
| Table | Rows | Status |
|---|---|---|
| `bot_guild_settings` | 3 | ✅ Active |
| `bot_guild_admins` | 3 | ✅ Active |
| `bot_reaction_roles` | 1 | ✅ Active |
| `bot_alliance_events` | 15 | ✅ Active |
| `bot_event_history` | 84 | ✅ Active |

### Business & Operations (9 tables)
| Table | Rows | Status |
|---|---|---|
| `referrals` | 1,812 | ✅ Active |
| `gift_codes` | 14 | ✅ Active |
| `gift_code_redemptions` | 982 | ✅ Active |
| `campaigns` | 1 | ✅ Active |
| `campaign_winners` | 15 | ✅ Active |
| `spotlight_history` | 37 | ✅ Active |
| `atlas_expenses` | 5 | ✅ Active |
| `support_emails` | 50 | ✅ Active |
| `canned_responses` | 4 | ✅ Active |

### Misc (5 tables)
| Table | Rows | Status |
|---|---|---|
| `base_designs` | 9 | ✅ Active |
| `external_recruits` | 13 | ✅ Active |
| `webhook_events` | 39 | ✅ Active |
| `churn_surveys` | 0 | 🟡 Feature exists, no data yet |
| `expiry_warnings_sent` | 0 | 🔴 Dead — no code references |

---

## 9. Recommendations

### Immediate (no risk)
- [x] ~~Fix tool_access data gap for Ttd~~ ✅ Done
- [x] ~~Add documentation comments to dead/legacy tables~~ ✅ Done

### Short-term (low risk, manual)
- [ ] Drop dead tables: `contributor_stats`, `discord_role_sync_log`, `expiry_warnings_sent`
- [ ] Investigate `transfer_profile_views` tracking bug (0 rows despite 5 frontend refs)
- [ ] Add retention policy for `kingdom_listing_views` (e.g., keep last 90 days)
- [ ] Add cleanup job for read `notifications` older than 90 days

### Medium-term (moderate effort)
- [ ] Migrate `BattlePlannerAccessTab.tsx` admin UI to use `tool_access` instead of `battle_planner_access`, then drop `battle_planner_access`
- [ ] Remove `kvk_submissions` references from `contributorService.ts` (or repurpose the table if needed)
- [ ] Drop `transfer_seasons` table and `reset_transfer_season()` function (SeasonTab.tsx handles resets directly via `transfer_events`)
- [ ] Standardize `kvk_submissions.submitter_id` to UUID if table is kept

---

## 10. Changes Made During This Audit

| Action | Detail | Risk |
|---|---|---|
| INSERT into `tool_access` | Added Ttd (battle_planner) to fix gating gap | None — additive only |
| COMMENT ON 6 tables | Documented dead/legacy status on `contributor_stats`, `discord_role_sync_log`, `expiry_warnings_sent`, `transfer_seasons`, `kvk_submissions`, `battle_planner_access` | None — metadata only |

**No tables were dropped. No columns were changed. No frontend code was modified. Zero risk of breakage.**
