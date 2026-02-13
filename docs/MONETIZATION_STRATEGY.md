# Monetization Strategy for Kingshot Atlas

**Created:** 2026-01-27  
**Updated:** 2026-02-15  
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

### Premium Tier — **Atlas Supporter** ($4.99/month)
*Goal: Community supporters who want to help fund Atlas*

| Feature | Value Proposition | Status |
|---------|-------------------|--------|
| **Supporter Badge** | Pink badge visible on profile | ✅ Live |
| **Discord Supporter Role** | Exclusive pink role in Discord | ✅ Live |
| **Exclusive Discord Channel** | Access to supporter-only discussions | ✅ Live |
| **Early Access** | Be first to try new features | ✅ Live |
| **Ad-Free Experience** | Clean, distraction-free browsing | ✅ Live |

### ~~Recruiter Tier~~ (REMOVED 2026-02-13)
*Recruiter tier was removed. Kingdom claiming, recruiter dashboard, and transfer tools are now available to all linked users via the Transfer Hub. This simplifies the tier structure and increases engagement.*

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

### Why $4.99/month for Supporters
- **Coffee test:** "Less than a coffee per week"
- **Community-focused:** Support the project, get recognition
- **Low barrier:** Easy impulse decision for gamers

### Why $49.99/year for Annual Supporters
- **~17% savings** vs monthly ($59.88/yr → $49.99/yr)
- **Commitment signal:** Annual subscribers churn less
- **Higher LTV:** $49.99 upfront vs $4.99×12 risk
- **Default option:** Support page defaults to yearly toggle

---

## Revenue Projections (Conservative)

Assuming 1,000 monthly active users after 3 months:

| Scenario | Supporter Monthly (3%) | Supporter Annual (1%) | Monthly Revenue |
|----------|------------------------|--------------------------|------------------|
| Conservative | 30 × $4.99 | 10 × $4.17 | $191/month |
| Moderate | 50 × $4.99 | 20 × $4.17 | $333/month |
| Optimistic | 100 × $4.99 | 50 × $4.17 | $708/month |

---

## User-Friendly Practices

### DO 
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

1. ✅ Create Stripe account
2. ✅ Add product: Atlas Supporter ($4.99/mo, $49.99/yr)
3. ✅ Implement Payment Link checkout
4. ✅ Store subscription status in user profile
5. ✅ Check status on protected features

### Premium Feature Gates
```typescript
// Check premium status
const isSupporter = user?.subscription_tier === 'supporter';

// In component
{isSupporter ? <PremiumFeature /> : <UpgradePrompt feature="Feature Name" />}
```

---

## Marketing Angles

### For Players
> "Stop guessing. Start winning. Atlas Supporter unlocks the full picture."

### For Recruiters
> "Attract top talent. Show them your kingdom's true strength."

### For Community
> "Your support keeps Atlas free for everyone."

---

## Next Steps

1. [x] Add Ko-fi button to About page
2. [x] Create Supporter feature badges in UI
3. [x] Set up Stripe account + webhook
4. [x] Design upgrade prompts (non-intrusive)
5. [x] Implement premium feature checks in PremiumContext
6. [x] Build subscription management UI (Stripe Customer Portal)
7. [x] Launch annual plan ($49.99/yr)
8. [x] Kingdom Fund contributions (community treasury)
9. [ ] Automated welcome/retention email flows
10. [ ] Expand Kingdom Fund features (weekly depletion, tier perks)

---

*Strategy by Business Lead*
