# Monetization Strategy for Kingshot Atlas

**Created:** 2026-01-27  
**Target:** Quick revenue with user-friendly approach

---

## Executive Summary

Kingshot Atlas should monetize through a **freemium model** with optional premium features. The key is providing enough value for free to attract users while offering compelling premium features that serious players and recruiters will gladly pay for.

---

## Tier Structure

### Free Tier (Core Experience)
*Goal: Attract users, build community, generate word-of-mouth*

| Feature | Included |
|---------|----------|
| Kingdom Directory | ✅ Full access |
| Kingdom Profiles | ✅ Basic stats |
| Full KvK History | ✅ All records |
| Compare (2 kingdoms) | ✅ |
| Leaderboards | ✅ Top 50 |
| User Profile | ✅ Basic |
| Status Submissions | ✅ |
| Reviews | ✅ Read & write |

### Premium Tier — **Atlas Pro** ($4.99/month or $39.99/year)
*Goal: Serious players and recruiters*

| Feature | Value Proposition | Status |
|---------|-------------------|--------|
| ~~Full KvK History~~ | *Now free for all users* | ✅ Free |
| **Score Timeline** | Track performance over time | ✅ Live |
| **Kingdom Watchlist** | Track up to 20 kingdoms with status change alerts | 🛠️ Coming Soon |
| **Multi-Compare** | Compare up to 5 kingdoms side-by-side | ✅ Live |
| **Priority Support** | Faster response times | ✅ Live |
| **Pro Badge** | Visible on profile and reviews | ✅ Live |
| **Discord Role** | Exclusive Pro role & badge in Discord | ✅ Live |

### Recruiter Tier — **Atlas Recruiter** ($14.99/month)
*Goal: Alliance recruiters and kingdom managers*

| Feature | Value Proposition | Status |
|---------|-------------------|--------|
| All Pro features | ✅ | ✅ Live |
| **Claim Kingdom** | Official kingdom representative badge | ✅ Live |
| **Recruiter Dashboard** | Track kingdom views, profile engagement | 🛠️ Coming Soon |
| **Custom Kingdom Banner** | Upload alliance banner for profile | 🛠️ Coming Soon |
| **Recruit Inbox** | Receive transfer interest from players | 🛠️ Coming Soon |
| **Discord Role** | Exclusive Recruiter role & badge in Discord | ✅ Live |

---

## Quick-Win Monetization (Launch Week)

### 1. Tip Jar / Ko-fi Integration
- Add "Support Atlas" button in footer/about page
- One-time donations, no commitment
- **Effort:** Low (1 hour)
- **Expected:** $50-200/month initially

### 2. Simple Paywall for Premium Features
- Use Stripe Checkout (no backend subscription management needed initially)
- Unlock premium with one-time payment (simpler than subscriptions to start)
- **Effort:** Medium (4-8 hours)
- **Expected:** Depends on user base

### 3. Non-Intrusive Ads
- Single banner ad at bottom of directory page
- Use ethical ad network (Carbon Ads, EthicalAds)
- Remove for premium users
- **Effort:** Low (2 hours)
- **Expected:** $0.50-2 CPM

---

## Implementation Priority

### Phase 1: Week 1-2 (Immediate)
1. **Ko-fi/Buy Me a Coffee button** — Get early supporters
2. **Premium feature gates** — Show "Pro" badges on locked features
3. **Email capture** — "Get notified when Premium launches"

### Phase 2: Week 3-4
1. **Stripe integration** — Simple checkout for Pro tier
2. **Premium feature implementation** — Full KvK history, watchlist
3. **User dashboard** — Show subscription status

### Phase 3: Month 2+
1. **Recruiter tier** — Kingdom claiming, recruiter tools
2. **Subscription management** — Upgrade/downgrade/cancel
3. **Discord bot** — Premium commands

---

## Pricing Psychology

### Why $4.99/month
- **Coffee test:** "Less than a coffee per week"
- **Yearly discount:** 33% off encourages commitment
- **Low barrier:** Easy impulse decision for gamers

### Why $14.99/month for Recruiters
- **B2B pricing:** Business expense for alliance leaders
- **Exclusive features:** Kingdom claiming is high-value
- **Social proof:** Recruiter badge builds trust

---

## Revenue Projections (Conservative)

Assuming 1,000 monthly active users after 3 months:

| Scenario | Pro (3% convert) | Recruiter (0.5% convert) | Monthly Revenue |
|----------|------------------|--------------------------|-----------------|
| Conservative | 30 × $4.99 | 5 × $14.99 | $225/month |
| Moderate | 50 × $4.99 | 10 × $14.99 | $400/month |
| Optimistic | 100 × $4.99 | 20 × $14.99 | $800/month |

---

## User-Friendly Practices

### DO ✅
- **Generous free tier** — Most users should never need to pay
- **No paywall for core data** — Kingdom stats should be free
- **Clear value proposition** — Premium features are genuinely useful
- **Easy cancellation** — One-click cancel, no dark patterns
- **Transparent pricing** — Show prices upfront, no hidden fees

### DON'T ❌
- Paywall basic kingdom lookup
- Require payment to submit data
- Use aggressive pop-ups or countdown timers
- Hide cancellation options
- Auto-renew without clear notice

---

## Technical Implementation

### Stripe Integration (Recommended)
```
npm install @stripe/stripe-js
```

1. Create Stripe account
2. Add products: Atlas Pro, Atlas Recruiter
3. Implement Checkout redirect
4. Store subscription status in user profile
5. Check status on protected features

### Premium Feature Gates
```typescript
// Example: Check premium status
const isPro = user?.subscription_tier === 'pro' || user?.subscription_tier === 'recruiter';

// In component
{isPro ? <PremiumFeature /> : <UpgradePrompt feature="Feature Name" />}

// Note: KvK History is now FREE for all users - no gating required
```

---

## Marketing Angles

### For Players
> "Find your forever kingdom. Atlas Pro gives you the complete picture."

### For Recruiters
> "Attract top talent. Show them your kingdom's true strength."

### For Community
> "Your support keeps Atlas free for everyone."

---

## Next Steps

1. [ ] Add Ko-fi button to About page (immediate)
2. [ ] Create "Pro" feature badges in UI
3. [ ] Set up Stripe account
4. [ ] Design upgrade prompts (non-intrusive)
5. [ ] Implement premium feature checks in AuthContext
6. [ ] Build subscription management UI

---

*Strategy by Business & Maintenance Specialist*
