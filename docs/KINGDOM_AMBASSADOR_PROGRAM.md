# Kingdom Ambassador Program — Full Spec

**Created:** 2026-02-05  
**Status:** 🟡 Pending Approval  
**Owner:** Business Lead  
**Related:** PARKING_LOT.md (Kingdom Claiming), ADR-007 (Freemium Model)

---

## Executive Summary

One trusted player per kingdom becomes the official Atlas Ambassador. They promote Atlas within their community, submit data for their kingdom, and get rewarded with exclusive perks. The program turns passionate users into a distributed growth engine that scales word-of-mouth across 1,190 kingdoms.

**Expected Impact:** 5-15 new users per ambassador, 2-5% Supporter conversion rate  
**Cost Per Ambassador:** ~$4.99/mo in waived Supporter fee  
**Break-Even:** 1 paying referral per ambassador per month

---

## 1. Why This Program

### The Problem
- User Growth grade: **B-** (organic only, no referral system)
- Atlas covers 1,190 kingdoms but has no feet on the ground in most of them
- Players trust recommendations from their own kingdom members over generic marketing
- No mechanism to reward power users who already promote Atlas informally

### The Opportunity
- Gaming communities recruit constantly — alliance leaders share tools with members daily
- Each kingdom has Discord servers, Line groups, and in-game alliance chats
- A single trusted voice in each kingdom can reach 50-200 active players
- At just 100 ambassadors: potential reach of 5,000-20,000 players

### Vision Alignment
- ✅ **Helps players make better decisions** — more players access Atlas data
- ✅ **Maintains data integrity** — ambassadors submit accurate kingdom data
- ✅ **Competitive-but-fair** — equal opportunity, merit-based selection
- ✅ **Community-driven** — players growing Atlas for players

---

## 2. Program Structure

### 2.1 Who Can Apply

| Requirement | Details |
|------------|---------|
| **Linked Kingshot Account** | Must have linked their in-game account on Atlas |
| **TC Level 25+** | Demonstrates commitment and game knowledge |
| **Home Kingdom Match** | Must represent their own kingdom (verified via linked account) |
| **Active Atlas User** | Logged in within the last 14 days |
| **Good Standing** | No history of rejected data submissions (or >80% approval rate) |
| **Account Age** | Atlas account at least 7 days old |

### 2.2 One Per Kingdom Rule

- **Maximum 1 Ambassador per kingdom** at any time
- If a kingdom already has an active Ambassador, new applicants join a waitlist
- If the current Ambassador is removed/steps down, the next waitlisted applicant is offered the role

### 2.3 Application Process

1. **Apply** — User fills out application (in-app form or Discord initially)
   - Kingdom number (auto-filled from linked account)
   - Role in kingdom (Leader / R4 / R3 / Officer / Member)
   - Why they want to be Ambassador (short paragraph)
   - How they plan to promote Atlas (Discord? Line? In-game chat?)
   - Estimated active alliance members they can reach
2. **Review** — Atlas admin reviews within 48 hours
   - Verify linked account matches claimed kingdom
   - Check contribution history and account standing
   - Ensure kingdom slot is open
3. **Approve/Reject** — Admin decision with brief reason
   - Approved: Perks activated immediately
   - Rejected: Feedback provided, can reapply in 30 days

---

## 3. Ambassador Perks

### 3.1 Permanent Perks (While Active)

| Perk | Details |
|------|---------|
| **Free Supporter Tier** | $4.99/mo value — ad-free, Supporter badge, Discord role |
| **Ambassador Badge** | Unique gold badge on profile: `🏛️ AMBASSADOR` |
| **Ambassador Discord Role** | Gold-colored role in Atlas Discord, above Supporter |
| **Ambassador Discord Channel** | Private channel for ambassador-only discussions with Atlas team |
| **Early Access** | First to test new features, even before Supporters |
| **Direct Line to Atlas Team** | Priority feedback channel |

### 3.2 Kingdom-Level Visibility

| Where | What Shows |
|-------|-----------|
| **Kingdom Profile Page** | "This kingdom has an Ambassador" banner with ambassador's username |
| **Kingdom Card** | Small `🏛️` icon indicating ambassador presence |
| **Ambassador's Reviews** | "Kingdom Ambassador" tag on reviews of their home kingdom |
| **Public Ambassadors Page** | Listed with kingdom, username, and stats |

### 3.3 Referral Rewards (Stacking)

Each ambassador gets a unique kingdom-branded referral link:
```
ks-atlas.com/join/k172
```

| Milestone | Reward |
|-----------|--------|
| **5 signups** | "Recruiter I" badge on profile |
| **15 signups** | "Recruiter II" badge + shoutout in Atlas Discord |
| **30 signups** | "Recruiter III" badge + featured on About page |
| **50 signups** | "Growth Legend" badge + input on feature roadmap |

---

## 4. Ambassador Responsibilities

### 4.1 Required (Minimum Activity)

| Responsibility | Frequency | How We Track |
|---------------|-----------|--------------|
| **Log in to Atlas** | At least 1x per week | Last login timestamp |
| **Submit KvK results** for their kingdom | After each KvK (~every 4 weeks) | Submission records |
| **Share Atlas** in their community | Ongoing | Referral link clicks/signups |

### 4.2 Encouraged (Earns Recognition)

| Activity | Impact |
|----------|--------|
| Submit status updates for their kingdom | Keeps kingdom data fresh |
| Report data inaccuracies | Maintains data integrity |
| Write reviews for kingdoms they've faced in KvK | Helps scouting community |
| Provide feature feedback | Shapes product direction |
| Welcome new Atlas users from their kingdom | Improves retention |

### 4.3 What Ambassadors Should NOT Do

- ❌ Misrepresent data for competitive advantage
- ❌ Spam communities with Atlas links
- ❌ Claim to speak officially for Atlas on game policy
- ❌ Share confidential early-access features publicly
- ❌ Sell or trade their Ambassador status

---

## 5. Performance & Renewal

### 5.1 Ambassador Scorecard (Monthly)

| Metric | Weight | Measurement |
|--------|--------|-------------|
| **Login Frequency** | 20% | Days active / 30 |
| **Data Submissions** | 30% | KvK results, status updates, corrections |
| **Referral Signups** | 30% | New users from referral link |
| **Community Engagement** | 20% | Reviews written, feedback submitted |

### 5.2 Renewal Cycle

- **Review Period:** Every 3 months (quarterly)
- **Auto-Renewed** if meeting minimum requirements (login 1x/week + 1 KvK submission per cycle)
- **Warning** at 2 months if falling below minimums
- **Grace Period:** 2 weeks after warning to catch up

### 5.3 Removal Triggers

| Trigger | Action |
|---------|--------|
| Inactive 30+ days | Auto-suspended, 7-day notice to reactivate |
| Data accuracy below 70% | Reviewed by admin, potential removal |
| Community guideline violation | Immediate removal |
| Kingdom requests removal | Reviewed case-by-case |
| Ambassador requests to step down | Graceful removal, can reapply later |

Removed ambassadors:
- Lose all ambassador perks immediately
- Keep any earned referral badges permanently
- Can reapply after 30 days (except for guideline violations — permanent ban)

---

## 6. Phased Rollout

### Phase 1: Manual MVP (Week 1-2)
**Goal:** Validate the concept with 5-10 hand-picked ambassadors

| Task | How |
|------|-----|
| **Recruitment** | Personally invite top contributors from Discord |
| **Application** | Google Form or Discord thread |
| **Approval** | Manual admin review |
| **Badge** | Add `is_ambassador` flag to Supabase `profiles` table |
| **Supporter Perk** | Create 100% Stripe coupon, apply manually |
| **Discord Role** | Create "Ambassador" role manually in Discord |
| **Referral Tracking** | UTM links per ambassador (e.g., `?ref=amb-k172`) |
| **Reporting** | Manual check-in via Discord every 2 weeks |

**Success Criteria:** 3+ ambassadors actively promoting, 20+ referral signups in first month

### Phase 2: In-App System (Week 3-6)
**Goal:** Scale to 25-50 ambassadors with self-serve application

| Task | How |
|------|-----|
| **Application Form** | In-app modal on Profile page (if eligible) |
| **Ambassador Dashboard** | Stats page showing referrals, submissions, scorecard |
| **Referral Links** | Auto-generated `ks-atlas.com/join/k{number}` links |
| **Badge Component** | New `AmbassadorBadge.tsx` component (gold theme) |
| **Kingdom Profile Integration** | "Ambassador" section on kingdom profile pages |
| **Automated Tracking** | `ambassadors` + `ambassador_referrals` tables |
| **Admin Panel** | Ambassador management tab in admin dashboard |

**Success Criteria:** 25+ active ambassadors, 100+ referral signups

### Phase 3: Full Program (Month 2-3)
**Goal:** Scale across all interested kingdoms

| Task | How |
|------|-----|
| **Public Ambassadors Directory** | `/ambassadors` page listing all active ambassadors |
| **Ambassador Leaderboard** | Rankings by referrals, submissions, engagement |
| **Automated Renewal** | Quarterly auto-review based on scorecard |
| **Ambassador API** | Endpoints for stats, application, management |
| **Notifications** | Email/Discord alerts for milestones, renewals, warnings |
| **Waitlist System** | Auto-notify waitlisted users when spot opens |

---

## 7. Database Schema (Phase 2+)

### New Table: `ambassadors`

```sql
CREATE TABLE ambassadors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  kingdom_number INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'removed', 'waitlisted')),
  role_in_kingdom TEXT, -- Leader, R4, R3, Officer, Member
  application_text TEXT,
  promotion_plan TEXT,
  estimated_reach INTEGER,
  referral_code TEXT UNIQUE, -- e.g., 'k172'
  referral_count INTEGER DEFAULT 0,
  data_submissions_count INTEGER DEFAULT 0,
  last_active TIMESTAMPTZ DEFAULT now(),
  applied_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  removed_at TIMESTAMPTZ,
  removal_reason TEXT,
  next_review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(kingdom_number, status) -- Only 1 active ambassador per kingdom
);
```

### New Table: `ambassador_referrals`

```sql
CREATE TABLE ambassador_referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ambassador_id UUID REFERENCES ambassadors(id) NOT NULL,
  referred_user_id UUID REFERENCES auth.users(id) NOT NULL,
  referral_code TEXT NOT NULL,
  converted_to_supporter BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(referred_user_id) -- Each user can only be referred once
);
```

### Profile Extension

```sql
ALTER TABLE profiles ADD COLUMN is_ambassador BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN referred_by TEXT; -- referral code that brought them
```

---

## 8. Cost Analysis

### Per-Ambassador Cost
- **Waived Supporter fee:** $4.99/mo
- **Admin time:** ~5 min/mo for check-ins (automated in Phase 2+)
- **Discord management:** Negligible (role-based)

### Revenue Model

| Scenario | Ambassadors | Referrals/Ambassador | Total New Users | 3% Convert | Monthly Revenue |
|----------|-------------|---------------------|-----------------|------------|----------------|
| **Conservative** | 20 | 5 | 100 | 3 | $14.97 |
| **Moderate** | 50 | 10 | 500 | 15 | $74.85 |
| **Optimistic** | 100 | 15 | 1,500 | 45 | $224.55 |

### Break-Even
- Cost of 50 ambassadors: $249.50/mo
- Need 50 Supporter conversions from referrals to break even
- At 3% conversion of 500 referral signups = 15 conversions ($74.85/mo)
- **True break-even: ~167 ambassadors at 10 referrals each at 3% conversion**
- But: User growth, engagement, data quality, and community value are harder to quantify and likely exceed direct revenue

### ROI Beyond Revenue
- **Data quality:** Ambassadors submit KvK results → more accurate scores
- **User engagement:** Referred users have higher retention (trusted referrer)
- **Community credibility:** "We have ambassadors in 50+ kingdoms"
- **Content generation:** Ambassador reviews provide social proof
- **Competitive moat:** Hard for competitors to replicate grassroots network

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Ambassadors go inactive | High | Medium | Quarterly review, auto-suspend at 30 days |
| Bad actors submit false data | Low | High | >80% accuracy requirement, admin oversight |
| Kingdom drama (rival claims) | Medium | Low | First-approved rule, admin arbitration |
| Program costs exceed value | Low | Medium | Phase 1 validates with 5-10 ambassadors first |
| Ambassadors feel entitled | Low | Medium | Clear terms of service, perks are privileges not rights |
| Spam perception in communities | Medium | Medium | Guidelines on tasteful promotion, no spam policy |

---

## 10. Marketing the Program

### Launch Messaging (Brand Voice)

**Discord Announcement:**
> 🏛️ **Introducing: Kingdom Ambassadors**
> 
> Think Atlas is the best tool for Kingshot? Prove it.
> 
> We're looking for one player per kingdom to become an official Atlas Ambassador. Free Supporter perks, exclusive badge, direct line to the Atlas team, and your name on the wall.
> 
> **What we need from you:** Share Atlas with your alliance, submit KvK results, and help us stay accurate.
> 
> **What you get:** Everything Supporters get, plus Ambassador-only perks. No cost. Ever.
> 
> Real data. Real results. Now with real people on the ground.
> 
> Apply now → [link]

### In-App Promotion
- Banner on Profile page for eligible users: "Represent your kingdom. Become an Ambassador."
- Kingdom profiles without ambassadors: "No Ambassador yet. Apply to represent K{number}."

---

## Appendix: Comparison With Other Referral Options

| Feature | Ambassador Program | Alliance Invite System | Share-to-Unlock |
|---------|-------------------|----------------------|-----------------|
| **Effort to Build** | Medium | Medium | Low |
| **Growth Potential** | High (deep, sustained) | High (viral, broad) | Low-Medium |
| **Cost** | $4.99/ambassador/mo | Free (badge rewards) | Free |
| **Data Quality Impact** | High (submissions required) | None | None |
| **Community Building** | Very High | Medium | Low |
| **Scalability** | Capped at 1,190 (1 per kingdom) | Unlimited | Unlimited |
| **Time to First Results** | 2-4 weeks | 1-2 weeks | Days |

**Recommendation:** Ambassador Program as the primary growth engine, with Alliance Invite System as a complementary viral mechanic anyone can use.

---

*This document requires owner approval before implementation begins.*
