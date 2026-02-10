# Transfer Hub — Comprehensive Analysis Report

**Date:** 2026-02-10
**Scope:** Full review of TransferBoard, TransferProfileForm, TransferApplications, RecruiterDashboard, KingdomListingCard, TransferHubGuide, EditorClaiming, KingdomFundContribute
**Build status:** Clean ✅

---

## 1. Bugs & Errors Found

### 1.1 ⚠️ Application expiry text mismatch
- **Location:** `TransferApplications.tsx:257` says "Applications expire after **14 days**"
- **Actual:** DB default `expires_at` is `now() + '72:00:00'` (3 days)
- **Impact:** Users expect 14 days but applications expire after 72 hours. Misleading.
- **Fix:** Change copy to "Applications expire after 72 hours" or update DB default to 14 days.

### 1.2 ⚠️ Access gate link is the same for both conditions
- **Location:** `TransferBoard.tsx:940` — `Link to={!user ? '/profile' : '/profile'}`
- **Impact:** The ternary is a no-op. Both signed-out and linked-but-not-linked users go to `/profile`. Signed-out users should probably go to an auth modal or `/profile` with a sign-in prompt.
- **Fix:** Minor — remove the ternary or route unauthenticated users to trigger the auth modal.

### 1.3 ⚠️ TransferProfileForm loads inactive profiles too
- **Location:** `TransferProfileForm.tsx:192-196` — `.select('*').eq('user_id', user.id).single()`
- **Impact:** If a user has a deactivated profile (from auto-deactivation), the form loads it and treats it as existing. The user would update it but `is_active` stays `false` because the update doesn't set `is_active: true`.
- **Fix:** Add `.eq('is_active', true)` to the query, OR set `is_active: true` on update to reactivate.

### 1.4 ⚠️ Recruiter application profile fetch missing `last_active_at`
- **Location:** `RecruiterDashboard.tsx:596` — The query that fetches profiles for incoming applications doesn't include `last_active_at`.
- **Impact:** TypeScript won't error because it's cast, but `last_active_at` will be `undefined` on application profile cards.
- **Fix:** Add `last_active_at` to the profile select in the applications fetch (line 596).

---

## 2. UX Confusion Points

### 2.1 "Transferring" vs "Recruiting" mode — no persistence explanation
- The mode toggle persists via localStorage, but users who switch devices lose their selection. The Entry Modal shows once per device — returning users on a new device see it again. Not a bug, but could be confusing.

### 2.2 Application slot limit (3) is never explained proactively
- Users only discover the 3-slot limit when they click Apply on a 4th kingdom. There's no proactive hint on the Transfer Hub page itself. Only the ApplyModal shows the slot count.
- **Suggestion:** Add a small "3 application slots" indicator near the profile CTA banner for users with 2+ active applications.

### 2.3 Anonymous mode hides too much from recruiters
- Anonymous profiles show "🔒 Anonymous" with no kingdom number, which gives recruiters almost nothing to evaluate. Many may skip these entirely.
- **Suggestion:** Consider showing anonymized kingdom range (e.g., "K200-299") or at least TC/Power stats for anonymous profiles.

### 2.4 Match Score requires recruiter to set requirements
- Match Score shows 0% for all kingdoms that haven't set up min requirements (min_tc, min_power, language, vibe). Most Standard-tier kingdoms haven't. This makes the "Sort by Match" option useless for most listings.
- **Suggestion:** Add a fallback heuristic (e.g., language match alone) when no explicit requirements are set. Or show "No requirements set" instead of "0%".

### 2.5 "Complete Profile" button opens the same form as "Edit Profile"
- The nudge banner says "Complete Profile" but opens the same TransferProfileForm. Users don't know which fields are missing. The preview helps, but the form doesn't highlight incomplete fields.
- **Suggestion:** Auto-scroll to the first empty required field, or add a mini-indicator per field section.

---

## 3. Performance Concerns

### 3.1 Top Matches section recalculates on every render
- The Recommended Kingdoms section calls `calculateMatchScore` for all `filteredKingdoms` in an IIFE inside JSX. This runs on every re-render.
- **Fix:** Wrap in `useMemo` keyed on `filteredKingdoms`, `fundMap`, and `transferProfile`.

### 3.2 TransferBoard.tsx is 1500+ lines
- The file includes EntryModal, ModeToggle, FilterPanel, and the main page component. This is a maintenance concern but not a user-facing issue.

### 3.3 `last_active_at` touch fires on every Transfer Hub visit
- The silent update runs every time the page loads. For active users visiting daily, this creates unnecessary DB writes.
- **Fix:** Add a debounce — only touch if last touch was >1 hour ago (check client-side).

---

## 4. Missing Features / Gaps

### 4.1 No duplicate application prevention
- A user can withdraw an application and immediately re-apply to the same kingdom. There's no cooldown per-kingdom.
- **Impact:** Could annoy recruiters with repeated applications from the same person.

### 4.2 No way for transferees to see which kingdoms viewed their profile
- Recruiters can browse transferees, but transferees have no visibility into who's looking at them. This is a missed engagement driver.

### 4.3 No application message/note field
- Applications are just "User X applied to Kingdom Y." There's no way for the applicant to add a personal message or note to the recruiter explaining why they're interested.
- **Impact:** Reduces quality of applications. Recruiters can't distinguish motivated applicants from mass-appliers.

### 4.4 Kingdom Fund tier display inconsistency
- `KingdomListingCard` shows fund tier badges, but the Transfer Hub stats banner counts "Recruiting" kingdoms based on `is_recruiting` flag, not fund tier. A kingdom could be "recruiting" at Standard tier (no fund) or funded but not recruiting.

### 4.5 No feedback after application is accepted/declined
- When a recruiter accepts/declines, the transferee gets a notification but there's no in-app next step. Accepted should show "Contact recruiter" or in-game coordinate info. Currently it just shows a green "Accepted" badge.

---

## 5. Recommended Changes (Priority Order)

### HIGH PRIORITY (fix before promoting Transfer Hub)

| # | Change | File(s) | Effort |
|---|--------|---------|--------|
| 1 | Fix application expiry text (72h not 14d) | `TransferApplications.tsx` | 1 min |
| 2 | Reactivate deactivated profiles on edit | `TransferProfileForm.tsx` | 2 min |
| 3 | Add `last_active_at` to application profile query | `RecruiterDashboard.tsx:596` | 1 min |
| 4 | Memoize Top Matches calculation | `TransferBoard.tsx` | 5 min |
| 5 | Debounce `last_active_at` touch (>1hr) | `TransferBoard.tsx` | 5 min |

### MEDIUM PRIORITY (improve conversion & quality)

| # | Change | File(s) | Effort |
|---|--------|---------|--------|
| 6 | Add application note/message field | `TransferApplications.tsx`, DB migration | 30 min |
| 7 | Show "Contact info" on accepted applications | `TransferApplications.tsx` | 15 min |
| 8 | Match Score fallback when no requirements set | `TransferBoard.tsx` | 15 min |
| 9 | Per-kingdom application cooldown (24h after withdraw) | `TransferApplications.tsx`, DB | 20 min |
| 10 | Slot count indicator on Transfer Hub CTA banner | `TransferBoard.tsx` | 5 min |

### LOW PRIORITY (nice-to-have polish)

| # | Change | File(s) | Effort |
|---|--------|---------|--------|
| 11 | Anonymous profile kingdom range display | `RecruiterDashboard.tsx` | 10 min |
| 12 | Auto-scroll to first incomplete field in form | `TransferProfileForm.tsx` | 15 min |
| 13 | "Who viewed your profile" for transferees | New component, DB | 2 hrs |
| 14 | Clean up access gate duplicate ternary | `TransferBoard.tsx:940` | 1 min |

---

## 6. Data Integrity Notes

- **Transfer profiles** have proper RLS enabled on the `transfer_profiles` table.
- **Applications** expire via `expire-transfer-applications` edge function (cron-callable).
- **Stale profiles** now deactivate via `deactivate-stale-profiles` edge function.
- **Content moderation** is applied to player bios via `moderateText()`.
- **Coordinate format** is enforced by DB CHECK constraint.
- **No cascade deletes** — if a user deletes their account, their transfer profile and applications remain. Consider adding cascade or cleanup logic.

---

*Report generated by Product Engineer + Design Lead analysis. Recommendations sorted by impact and effort.*
