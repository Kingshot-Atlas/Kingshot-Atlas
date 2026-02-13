# Supabase Subscription Setup

## 1. Add subscription_tier column to profiles table

Run this SQL in your Supabase SQL Editor:

```sql
-- Add subscription columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'supporter')),
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'canceled', 'past_due'));

-- Create index for faster tier lookups
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier ON profiles(subscription_tier);

-- Create index for Stripe customer lookups (for webhook handling)
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id);
```

## 2. Create RLS policies for subscription data

```sql
-- Users can read their own subscription data
CREATE POLICY "Users can view own subscription" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Only service role can update subscription data (via webhooks)
CREATE POLICY "Service role can update subscriptions" ON profiles
  FOR UPDATE USING (auth.role() = 'service_role');
```

## 3. Stripe Product Setup

In your Stripe Dashboard, create the following products:

### Atlas Supporter
- **Monthly:** $4.99/month (payment link in `VITE_STRIPE_PRO_MONTHLY_LINK`)

## 4. Environment Variables

Add to your `.env` file:

```env
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
VITE_STRIPE_SUPPORTER_MONTHLY=price_xxx
VITE_STRIPE_PORTAL_URL=https://billing.stripe.com/p/login/xxx
```

## 5. Stripe Payment Links (No Backend Required)

For a simple setup without a backend API, use Stripe Payment Links:

1. Go to Stripe Dashboard → Products → Select your product
2. Click "Create payment link"
3. Set success URL: `https://your-domain.com/profile?upgraded=true&session_id={CHECKOUT_SESSION_ID}`
4. Enable "Collect customer email" 
5. Add `client_reference_id` as a URL parameter (this will be the user's Supabase ID)
6. Copy the payment link URL and use it directly in your upgrade buttons

## 6. Webhook Setup (Optional - For Auto-Updates)

If you want automatic subscription updates, you'll need a backend endpoint to handle Stripe webhooks:

1. In Stripe Dashboard → Webhooks → Add endpoint
2. URL: `https://your-api-domain.com/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

For now, without a deployed backend, you can manually update user tiers in Supabase after receiving payment notifications from Stripe.
