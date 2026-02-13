# Stripe Quick Setup Guide

## Step 1: Get Your API Keys (2 min)

1. Go to [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys)
2. Copy your **Publishable key** (starts with `pk_live_` or `pk_test_`)
3. Add to your `.env` file:
   ```
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
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
   - Copy the Price ID (e.g., `price_1SuX3zL7R9uCnPH3m4PyIrNI`)

4. Add **Yearly Price:**
   - Click **Add another price**
   - Amount: **$49.99**
   - Billing period: **Yearly**
   - Click **Save**
   - Copy the Price ID (e.g., `price_1T0NX1L7R9uCnPH37QoS7mqE`)

---

## Step 3: Add Payment Links to .env (1 min)

```env
# Atlas Supporter payment links
VITE_STRIPE_PRO_MONTHLY_LINK=https://buy.stripe.com/dRm8wQ2Fe2ye7dC3n9eZ206
VITE_STRIPE_PRO_YEARLY_LINK=https://buy.stripe.com/3cIcN67Zy3CifK8cXJeZ20b
```

> **Note:** Env var names still use `PRO` for backward compatibility but the tier is branded "Atlas Supporter".

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
   VITE_STRIPE_PORTAL_URL=https://billing.stripe.com/p/login/xxxxx
   ```

---

## Step 6: Run Supabase Migration

Run this SQL in your [Supabase SQL Editor](https://supabase.com/dashboard):

```sql
-- Add subscription columns to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id);
```

> **Note:** No CHECK constraint on `subscription_tier` — the app validates tiers in code (`free` or `supporter`).

---

## Step 7: Test It

1. Run `npm run dev` in `/apps/web`
2. Go to `/support`
3. Toggle between Monthly/Yearly and click the subscribe button
4. You should be redirected to Stripe checkout (or Ko-fi as fallback)

---

## Manual Fulfillment (No Backend)

Without a backend webhook, you'll need to manually update user tiers:

1. Stripe sends you a payment notification email
2. Find the user's email in the payment details
3. In Supabase, run:
   ```sql
   UPDATE profiles 
   SET subscription_tier = 'supporter', 
       subscription_status = 'active'
   WHERE email = 'customer@email.com';
   ```

---

## Automatic Webhooks (LIVE)

Stripe webhooks are configured and automatically update user tiers.

### Webhook Endpoint
- **URL:** `https://kingshot-atlas.onrender.com/api/v1/stripe/webhook`
- **Source:** `apps/api/api/routers/stripe.py`

### Events Handled
| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activate supporter tier, send welcome email, sync Discord role |
| `customer.subscription.updated` | Sync tier changes (upgrade/downgrade/renewal) |
| `customer.subscription.deleted` | Downgrade to free, send cancellation email, remove Discord role |
| `invoice.payment_failed` | Send payment failed email (first attempt only) |

### Required Env Vars (Render Dashboard)
- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_WEBHOOK_SECRET` — Webhook signing secret (from Stripe Dashboard → Webhooks)

### Stripe CLI Testing (Local Development)
```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
# Login to your Stripe account
stripe login

# Forward webhook events to local API
stripe listen --forward-to localhost:8000/api/v1/stripe/webhook

# Copy the webhook signing secret from the output (whsec_...)
# Set it as STRIPE_WEBHOOK_SECRET in your .env

# In another terminal, trigger test events:
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_failed
```

### Monitoring
- Webhook events are logged to the `webhook_events` table in Supabase
- View in Admin Dashboard → Webhook Monitor tab
- Health check: `GET /api/v1/stripe/health`

---

## Quick Reference

| Tier | Monthly | Yearly | Features |
|------|---------|--------|----------|
| Free | $0 | $0 | 2 compare, full history, basic features |
| Supporter | $4.99/mo | $49.99/yr (~$4.17/mo, save 17%) | Supporter badge, Discord role, ad-free, early access, battle planner, unlimited bot commands |

### Stripe IDs
| Resource | ID |
|----------|----|
| Product: Atlas Supporter | `prod_TsHdTjVrFBUmrO` |
| Price: Monthly ($4.99/mo) | `price_1SuX3zL7R9uCnPH3m4PyIrNI` |
| Price: Yearly ($49.99/yr) | `price_1T0NX1L7R9uCnPH37QoS7mqE` |
| Payment Link: Monthly | `https://buy.stripe.com/dRm8wQ2Fe2ye7dC3n9eZ206` |
| Payment Link: Yearly | `https://buy.stripe.com/3cIcN67Zy3CifK8cXJeZ20b` |
| Product: Kingdom Fund | `prod_TvsIYrR0SeTEU7` |
