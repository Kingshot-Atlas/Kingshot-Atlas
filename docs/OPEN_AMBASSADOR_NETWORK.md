# Open Ambassador Network — Full Spec

**Created:** 2026-02-09  
**Status:** 🟡 Pending Approval  
**Owner:** Business Lead  
**Supersedes:** KINGDOM_AMBASSADOR_PROGRAM.md (which required admin review, $4.99/mo cost per ambassador, and 1-per-kingdom cap)

---

## Executive Summary

Any eligible player can generate a referral link and earn tiered rewards for bringing new users to Atlas. No application, no admin approval, no cap, no cost. Rewards are profile badges, Discord roles, and visibility perks — all free and infinitely scalable. The system turns every power user into a growth engine.

**Key Difference from Old Ambassador Program:** Zero gates, zero cost, unlimited participants.

---

## 1. Eligibility

### To Get a Referral Link
| Requirement | Details |
|------------|---------|
| **Logged in** | Must have an Atlas account |
| **Kingshot account linked** | Must have linked their in-game account |
| **TC Level 25+** | Demonstrates commitment and game knowledge |

### When a Referral Counts (Verified Referral)
A referred user counts toward the referrer's total when ALL of these are met:
| Requirement | Details |
|------------|---------|
| **Created an Atlas account** | Signed up via the referral link |
| **Linked Kingshot account** | Must link their in-game account |
| **TC Level 20+** | Prevents throwaway/alt accounts |

---

## 2. Referral Link Format

Each eligible user gets a personalized referral link tied to their username:

```
ks-atlas.com/kingdom/{number}?ref={username}
```

- The link points to the **existing kingdom profile page** — the referred user sees real, valuable data immediately
- A subtle banner appears: "{username} invited you to scout Kingdom {number}. Create an account to track matchups and compare kingdoms."
- The `ref` param is stored in the referred user's profile upon signup
- Each user can only be referred once (first referral link wins)

### Share Distribution
The referral link is distributed via the existing `ShareButton` component:
- Copy Link (appends `?ref=` automatically for eligible users)
- Copy for Discord
- Share Image (PNG card with URL baked in)
- QR Code
- Native Share

---

## 3. Referral Tier System

### Tier Overview

| Tier | Referrals | Title | Badge Color | Border Color |
|------|-----------|-------|-------------|--------------|
| 0 | 0 (eligible) | — | — | — |
| 1 | 2 | Scout | White | — |
| 2 | 5 | Recruiter | Green (`#22c55e`) | Green (`#22c55e`) |
| 3 | 10 | Consul | Light Purple (`#c084fc`) | Light Purple (`#c084fc`) |
| 4 | 20 | Ambassador | Purple (`#a855f7`) | Purple (`#a855f7`) + glow |

---

### Tier 0 — Eligible (0 referrals)
**Perks:**
- Referral link generated
- Personal referral counter visible on own profile (private, only you see it)

---

### Tier 1 — Scout (2 verified referrals)
**Perks:**
- **"Scout" badge** on website profile — simple white badge
- Personal referral counter on profile

**Badge Style:**
- Color: White (`#ffffff`)
- Icon: Simple scout/binoculars icon or text badge
- Position: Profile header, next to username

---

### Tier 2 — Recruiter (5 verified referrals)
**Perks:**
- **"Recruiter" badge** on website profile — simple green badge (replaces Scout badge)
- **Referral counter visible on public profile** — other users can see how many people you've brought in
- **Green border** on profile card in User Directory

**Badge Style:**
- Color: Green (`#22c55e`)
- Border: `1px solid #22c55e` on User Directory card

---

### Tier 3 — Consul (10 verified referrals)
**Perks:**
- **"Consul" badge** on website profile — light purple badge (replaces Recruiter badge)
- **Referral counter visible on public profile**
- **Light purple border** on profile card in User Directory
- **Light purple Discord role** — visible in member list, auto-assigned by bot
- **Listed on Kingdom Profile** — appears in the "Atlas Users from this Kingdom" section, positioned at the top (below Ambassadors)

**Badge Style:**
- Color: Light Purple (`#b890dd`)
- Border: `1px solid #b890dd` on User Directory card
- Discord role color: `#b890dd`
- Discord role ID: `1470500049141235926`

---

### Tier 4 — Ambassador (20 verified referrals)
**Perks:**
- **"🏛️ Ambassador" badge** on website profile — fancy purple badge with glow effect (replaces Consul badge)
- **Referral counter visible on public profile**
- **Purple border + glow** on profile card in User Directory
- **Purple Discord role** — sits above Consul/Supporter in hierarchy
- **Private #ambassador Discord channel** — priority support, direct access to dev team, new feature discussions, early previews
- **Ambassador tag on all reviews/submissions** — "Kingdom Ambassador" label next to username
- **Listed on Kingdom Profile** — appears at the very top of "Atlas Users from this Kingdom" section
- **Featured on public Ambassadors directory** — `/ambassadors` page listing all Ambassadors with username, kingdom, and referral count

**Badge Style:**
- Color: Purple (`#a24cf3`)
- Effect: Neon glow (`box-shadow: 0 0 12px #a24cf380`)
- Border: `2px solid #a24cf3` + `box-shadow: 0 0 8px #a24cf340` on User Directory card
- Discord role color: `#a24cf3`
- Discord role ID: `1466442919304237207`

---

## 4. Badge Upgrade Rules

- **Badges upgrade, not stack.** Each tier replaces the previous tier's badge (Scout → Recruiter → Consul → Ambassador).
- **Badges are permanent** once earned. If a referred user deletes their account, the referral still counts.
- **Discord roles stack** for Consul + Ambassador (Consul keeps their role when they reach Ambassador, or can be configured to replace).

---

## 5. Kingdom Profile Integration

### "Atlas Users from this Kingdom" Section
On each kingdom's profile page, a section shows Atlas users linked to that kingdom, ordered by referral tier:

```
🏛️ Ambassador
  giovanni (20 referrals)

💜 Consul  
  player123 (12 referrals)
  
💚 Recruiter
  player456 (7 referrals)

Other Atlas Users
  player789, player012, ...
```

- Only Recruiter+ tiers are shown with names/counts
- Other Atlas users shown as a count or compact list
- Kingdoms with more Atlas users (especially Ambassadors) appear more active/trustworthy

---

## 6. Discord Bot Integration

### Auto-Role Assignment
The Discord bot checks referral counts and auto-assigns roles:
- **Consul role** — auto-assigned when user reaches 10 verified referrals AND has Discord linked
- **Ambassador role** — auto-assigned when user reaches 20 verified referrals AND has Discord linked

### Ambassador Channel
- **Channel:** `#ambassadors` (private, visible only to Ambassador role + Admin)
- **Purpose:** Priority feedback, early feature previews, direct communication with dev team
- **Tone:** Casual, collaborative, "inner circle" energy

### Role Hierarchy (top to bottom)
```
Admin
Moderator
Atlas (bot)
Ambassador (purple, #a24cf3) — ID: 1466442919304237207
Consul (light purple, #b890dd) — ID: 1470500049141235926
Recruiter (not a Discord role — website only)
Supporter (pink)
Settler (green)
Explorer (green, default)
```

### Ambassador Lounge
- **Channel:** `#vip-lounge` (already created)
- Visible only to Ambassador role + Admin

---

## 7. Database Schema

### New Table: `referrals`

```sql
CREATE TABLE referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID REFERENCES auth.users(id) NOT NULL,
  referred_user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  referral_code TEXT NOT NULL, -- username of referrer
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'invalid')),
  created_at TIMESTAMPTZ DEFAULT now(),
  verified_at TIMESTAMPTZ -- when referred user met all requirements
);

-- Indexes
CREATE INDEX idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_status ON referrals(status);
```

### Profile Extension

```sql
ALTER TABLE profiles ADD COLUMN referred_by TEXT; -- referral code (username) that brought them
ALTER TABLE profiles ADD COLUMN referral_count INTEGER DEFAULT 0; -- cached verified referral count
ALTER TABLE profiles ADD COLUMN referral_tier TEXT DEFAULT NULL CHECK (referral_tier IN ('scout', 'recruiter', 'consul', 'ambassador'));
```

### Trigger: Auto-Verify Referrals

```sql
-- When a user links their Kingshot account with TC20+, check if they have a pending referral
-- If so, mark it as verified and increment the referrer's referral_count
CREATE OR REPLACE FUNCTION verify_pending_referral()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if the user just linked their account (linked_player_id changed from NULL)
  IF OLD.linked_player_id IS NULL AND NEW.linked_player_id IS NOT NULL 
     AND NEW.linked_tc_level >= 20 THEN
    
    -- Check for pending referral
    UPDATE referrals
    SET status = 'verified', verified_at = now()
    WHERE referred_user_id = NEW.id
      AND status = 'pending'
    RETURNING referrer_user_id INTO _referrer_id;
    
    -- If a referral was verified, update the referrer's count and tier
    IF _referrer_id IS NOT NULL THEN
      UPDATE profiles
      SET referral_count = (
        SELECT COUNT(*) FROM referrals 
        WHERE referrer_user_id = _referrer_id AND status = 'verified'
      ),
      referral_tier = CASE
        WHEN referral_count >= 20 THEN 'ambassador'
        WHEN referral_count >= 10 THEN 'consul'
        WHEN referral_count >= 5 THEN 'recruiter'
        WHEN referral_count >= 2 THEN 'scout'
        ELSE NULL
      END
      WHERE id = _referrer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_link_verify_referral
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION verify_pending_referral();
```

### RLS Policies

```sql
-- Anyone can read verified referral counts (public profiles)
CREATE POLICY "Public can view referral counts" ON referrals
  FOR SELECT USING (status = 'verified');

-- Users can see their own referrals (including pending)
CREATE POLICY "Users can view own referrals" ON referrals
  FOR SELECT USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());

-- System inserts referrals on signup (via service role)
-- No direct user insert/update/delete
```

---

## 8. Frontend Components

### New Components
| Component | Purpose |
|-----------|---------|
| `ReferralBanner.tsx` | Banner on kingdom profile when `?ref=` param is present: "{user} invited you to scout Kingdom {N}" |
| `ReferralBadge.tsx` | Tiered badge component (Scout/Recruiter/Consul/Ambassador) for profile display |
| `ReferralStats.tsx` | Referral counter + tier progress bar for user's own profile |
| `AmbassadorDirectory.tsx` | `/ambassadors` page listing all Ambassador-tier users |

### Modified Components
| Component | Change |
|-----------|--------|
| `ShareButton.tsx` | Auto-append `?ref={username}` to share links for eligible users |
| `Profile.tsx` | Show referral badge, counter, and "Get Your Referral Link" CTA |
| `UserDirectory.tsx` | Apply tier-colored borders to user cards |
| `KingdomProfile.tsx` | Add "Atlas Users from this Kingdom" section with tiered display |
| `AuthContext.tsx` | Capture `?ref=` param on signup and store in `profiles.referred_by` |

---

## 9. Implementation Phases

### Phase 1: Core Referral System (Day 1-2)
- [ ] Add `referred_by`, `referral_count`, `referral_tier` to `profiles` table
- [ ] Create `referrals` table with RLS
- [ ] Capture `?ref=` param in `AuthContext.tsx` on signup
- [ ] Auto-verify referrals trigger (on account linking with TC20+)
- [ ] "Get Your Referral Link" button on Profile page
- [ ] Auto-append `?ref=` in `ShareButton` for eligible users
- [ ] `ReferralBanner.tsx` on kingdom profile when `?ref=` present

### Phase 2: Badges & Visual Integration (Day 2-3)
- [ ] `ReferralBadge.tsx` component (Scout/Recruiter/Consul/Ambassador)
- [ ] `ReferralStats.tsx` (counter + progress to next tier) on Profile page
- [ ] Tier-colored borders on User Directory cards
- [ ] "Atlas Users from this Kingdom" section on Kingdom Profile

### Phase 3: Discord Integration (Day 3-4)
- [ ] Create Consul and Ambassador Discord roles
- [ ] Create private #ambassadors channel
- [ ] Bot auto-assigns Consul/Ambassador roles based on referral_count
- [ ] Bot syncs roles on a schedule (like existing Settler role sync)

### Phase 4: Ambassador Perks (Day 4-5)
- [ ] Ambassador tag on reviews/submissions
- [ ] `/ambassadors` directory page

---

## 10. Cost Analysis

| Item | Cost |
|------|------|
| Badges | $0 (digital) |
| Discord roles | $0 (free to create) |
| Discord channel | $0 (free) |
| Profile borders | $0 (CSS) |
| **Total per ambassador** | **$0/month** |

**Comparison to Old Ambassador Program:** $4.99/mo per ambassador eliminated.

---

## 11. Success Metrics

| Metric | Target (Month 1) | Target (Month 3) |
|--------|-------------------|-------------------|
| Users with referral links | 50+ | 200+ |
| Total verified referrals | 100+ | 500+ |
| Scout tier (2+) | 20+ | 80+ |
| Recruiter tier (5+) | 10+ | 40+ |
| Consul tier (10+) | 5+ | 20+ |
| Ambassador tier (20+) | 2+ | 10+ |

---

## 12. Vision Alignment

- ✅ **Helps players make better decisions** — more players access Atlas data
- ✅ **Maintains data integrity** — referral verification requires real linked accounts with TC20+
- ✅ **Competitive-but-fair** — equal opportunity, merit-based progression
- ✅ **Community-driven** — players growing Atlas for players
- ✅ **Zero cost** — sustainable at any scale

---

*This document supersedes KINGDOM_AMBASSADOR_PROGRAM.md. Ready for implementation upon owner approval.*
