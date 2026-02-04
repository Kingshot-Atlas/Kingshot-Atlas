# Stripe Quick Setup Guide

## Step 1: Get Your API Keys (2 min)

1. Go to [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys)
2. Copy your **Publishable key** (starts with `pk_live_` or `pk_test_`)
3. Add to your `.env` file:
   ```
   REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
   ```

---

## Step 2: Create Products (5 min)

Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)

### Create "Atlas Supporter" Product

1. Click **+ Add product**
2. Fill in:
   - **Name:** Atlas Supporter
   - **Description:** Support Kingshot Atlas and get premium perks
   - **Image:** Upload your logo (optional)

3. Add **Monthly Price:**
   - Click **Add another price**
   - Amount: **$4.99**
   - Billing period: **Monthly**
   - Click **Save**
   - Copy the Price ID (e.g., `price_1ABC123...`)

### Create "Atlas Recruiter" Product

1. Click **+ Add product**
2. Fill in:
   - **Name:** Atlas Recruiter
   - **Description:** Alliance recruiter tools for Kingshot Atlas

3. Add **Monthly Price:** **$19.99** → Copy Price ID
4. Add **Yearly Price:** **$159.99** → Copy Price ID

---

## Step 3: Add Payment Links to .env (1 min)

```env
# Atlas Supporter: $4.99/month
VITE_STRIPE_PRO_MONTHLY_LINK=https://buy.stripe.com/dRm8wQ2Fe2ye7dC3n9eZ206
VITE_STRIPE_PRO_YEARLY_LINK=
# Atlas Recruiter: $19.99/month, $159.99/year
VITE_STRIPE_RECRUITER_MONTHLY_LINK=https://buy.stripe.com/eVqaEY93C8WC2Xm3n9eZ204
VITE_STRIPE_RECRUITER_YEARLY_LINK=https://buy.stripe.com/bJebJ23Ji0q62Xm8HteZ205
```

---

## Step 4: Create Payment Links (3 min)

For each product/price, create a Payment Link:

1. Go to [Payment Links](https://dashboard.stripe.com/payment-links)
2. Click **+ New**
3. Select your product and price
4. Configure:
   - ✅ Collect email addresses
   - ✅ Allow promotion codes (optional)
   - **After payment:** Redirect to `https://your-domain.com/profile?upgraded=true`
5. Click **Create link**
6. Copy the Payment Link ID (the part after `buy.stripe.com/`)

**Important:** Add `?client_reference_id={USER_ID}` to track which user purchased.

---

## Step 5: Set Up Customer Portal (2 min)

1. Go to [Billing → Customer Portal](https://dashboard.stripe.com/settings/billing/portal)
2. Enable features:
   - ✅ Allow customers to update payment methods
   - ✅ Allow customers to cancel subscriptions
   - ✅ Allow customers to switch plans
3. Click **Save**
4. Copy the Portal Link and add to `.env`:
   ```
   REACT_APP_STRIPE_PORTAL_URL=https://billing.stripe.com/p/login/xxxxx
   ```

---

## Step 6: Run Supabase Migration

Run this SQL in your [Supabase SQL Editor](https://supabase.com/dashboard):

```sql
-- Add subscription columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' 
  CHECK (subscription_tier IN ('free', 'pro', 'recruiter')),
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive' 
  CHECK (subscription_status IN ('inactive', 'active', 'canceled', 'past_due'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id);
```

---

## Step 7: Test It

1. Run `npm start` in `/apps/web`
2. Go to `/upgrade`
3. Click a subscription button
4. You should be redirected to Stripe checkout (or Ko-fi as fallback)

---

## Manual Fulfillment (No Backend)

Without a backend webhook, you'll need to manually update user tiers:

1. Stripe sends you a payment notification email
2. Find the user's email in the payment details
3. In Supabase, run:
   ```sql
   UPDATE profiles 
   SET subscription_tier = 'pro', 
       subscription_status = 'active'
   WHERE email = 'customer@email.com';
   ```

---

## Future: Automatic Webhooks

When you deploy a backend API, set up webhooks:

1. [Stripe Webhooks](https://dashboard.stripe.com/webhooks) → Add endpoint
2. URL: `https://your-api.com/api/stripe/webhook`
3. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

This will automatically update user tiers when they subscribe/cancel.

---

## Quick Reference

| Tier | Monthly | Yearly | Features |
|------|---------|--------|----------|
| Free | $0 | $0 | 2 compare, full history, basic features |
| Supporter | $4.99 | — | Supporter badge, Discord role, ad-free, early access |
| Recruiter | $19.99 | $159.99 | All Supporter perks + claim kingdom, recruiter dashboard |
