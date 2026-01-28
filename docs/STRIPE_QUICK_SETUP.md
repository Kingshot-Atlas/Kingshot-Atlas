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

### Create "Atlas Pro" Product

1. Click **+ Add product**
2. Fill in:
   - **Name:** Atlas Pro
   - **Description:** Full access to Kingshot Atlas premium features
   - **Image:** Upload your logo (optional)

3. Add **Monthly Price:**
   - Click **Add another price**
   - Amount: **$4.99**
   - Billing period: **Monthly**
   - Click **Save**
   - Copy the Price ID (e.g., `price_1ABC123...`)

4. Add **Yearly Price:**
   - Click **Add another price**
   - Amount: **$39.99**
   - Billing period: **Yearly**
   - Click **Save**
   - Copy the Price ID

### Create "Atlas Recruiter" Product

1. Click **+ Add product**
2. Fill in:
   - **Name:** Atlas Recruiter
   - **Description:** Alliance recruiter tools for Kingshot Atlas

3. Add **Monthly Price:** **$14.99** → Copy Price ID
4. Add **Yearly Price:** **$119.99** → Copy Price ID

---

## Step 3: Add Price IDs to .env (1 min)

```env
REACT_APP_STRIPE_PRO_MONTHLY=price_xxxxx      # Pro $4.99/mo
REACT_APP_STRIPE_PRO_YEARLY=price_xxxxx       # Pro $39.99/yr
REACT_APP_STRIPE_RECRUITER_MONTHLY=price_xxxxx # Recruiter $14.99/mo
REACT_APP_STRIPE_RECRUITER_YEARLY=price_xxxxx  # Recruiter $119.99/yr
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
| Free | $0 | $0 | 2 compare, 3 watchlist, last 5 KvKs |
| Pro | $4.99 | $39.99 | 4 compare, 20 watchlist, full history, export |
| Recruiter | $14.99 | $119.99 | 10 compare, claim kingdom, recruiter dashboard |
