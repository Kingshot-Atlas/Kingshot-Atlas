# Stripe Production Checklist

## Required Environment Variables

These must be set in **Render Dashboard** (Environment tab):

| Variable | Source | Required |
|----------|--------|----------|
| `STRIPE_SECRET_KEY` | [Stripe Dashboard → API Keys](https://dashboard.stripe.com/apikeys) → Secret key (`sk_live_xxx`) | ✅ Yes |
| `STRIPE_WEBHOOK_SECRET` | [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks) → Signing secret (`whsec_xxx`) | ✅ Yes |
| `SUPABASE_URL` | [Supabase Dashboard](https://supabase.com/dashboard) → Settings → API → Project URL | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → Service Role Key | ✅ Yes |
| `FRONTEND_URL` | Set to `https://ks-atlas.com` | ✅ Yes |

---

## Webhook Configuration

### 1. Create Webhook Endpoint in Stripe

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **+ Add endpoint**
3. Set **Endpoint URL**: `https://kingshot-atlas.onrender.com/api/v1/stripe/webhook`
4. Select events:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (`whsec_xxx`)
7. Add to Render as `STRIPE_WEBHOOK_SECRET`

### 2. Verify Webhook is Working

```bash
# Check Stripe configuration health
curl https://kingshot-atlas.onrender.com/api/v1/stripe/health
```

Expected response:
```json
{
  "stripe_configured": true,
  "webhook_configured": true,
  "frontend_url": "https://ks-atlas.com",
  "price_ids_configured": true
}
```

---

## Customer Portal Configuration

1. Go to [Stripe Dashboard → Settings → Billing → Customer Portal](https://dashboard.stripe.com/settings/billing/portal)
2. Enable:
   - ✅ Allow customers to update payment methods
   - ✅ Allow customers to cancel subscriptions
   - ✅ Allow customers to switch plans (optional)
3. Set **Default return URL**: `https://ks-atlas.com/profile`
4. Click **Save**

---

## Database Tables Required

Run these migrations in **Supabase SQL Editor**:

### 1. Profiles Table Columns
```sql
-- From /docs/migrations/add_subscription_columns.sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);
```

### 2. Webhook Events Table
```sql
-- From /docs/migrations/create_webhook_events.sql
-- See that file for full migration
```

---

## Troubleshooting

### "Subscription isn't working"

1. **Check webhook health**: `curl .../api/v1/stripe/health`
2. **Verify webhook events in Stripe Dashboard** → Webhooks → Recent deliveries
3. **Check Render logs** for webhook processing errors
4. **Verify Supabase service role key** is correct

### "No cancellation method"

1. **Stripe Customer Portal must be configured** (see above)
2. **User must have `stripe_customer_id`** stored in Supabase profiles table
3. **Portal endpoint requires user to have completed a Stripe checkout** previously

### Portal returns "No Stripe customer found"

This means the webhook didn't store the `stripe_customer_id`. Check:
1. Webhook is receiving events
2. `SUPABASE_SERVICE_ROLE_KEY` is correct
3. `update_user_subscription()` is being called with customer ID

---

## Quick Verification Steps

```bash
# 1. Check API health
curl https://kingshot-atlas.onrender.com/health

# 2. Check Stripe health
curl https://kingshot-atlas.onrender.com/api/v1/stripe/health

# 3. Test webhook (use Stripe CLI for local testing)
stripe trigger checkout.session.completed
```

---

## Price IDs Reference

| Tier | Cycle | Price ID |
|------|-------|----------|
| Pro | Monthly | `price_1SuX3zL7R9uCnPH3m4PyIrNI` |
| Pro | Yearly | `price_1SuX4HL7R9uCnPH3HgVWRN51` |
| Recruiter | Monthly | `price_1SuX57L7R9uCnPH30D6ar75H` |
| Recruiter | Yearly | `price_1SuX5OL7R9uCnPH3QJBqlFNh` |

These are hardcoded in `/apps/api/api/routers/stripe.py`.
