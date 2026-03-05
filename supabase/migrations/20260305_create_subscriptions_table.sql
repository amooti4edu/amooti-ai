-- Migration: Create subscriptions table for billing
-- Date: 2026-03-05
-- Description: Tracks active subscriptions, tier, and billing periods for monthly billing cycle

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    tier TEXT NOT NULL CHECK (tier IN ('free', 'basic', 'premium')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    pesapal_reference_id TEXT, -- Reference from PesaPal for tracking payments
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON public.subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON public.subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON public.subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_subscriptions_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subscriptions_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_subscriptions_timestamp();

-- Comments
COMMENT ON TABLE public.subscriptions IS 'Tracks user subscriptions and billing periods. 30-day cycles from purchase/upgrade date.';
COMMENT ON COLUMN public.subscriptions.tier IS 'Subscription tier: free (5 q/day), basic (10 q/day), premium (20 q/day + teacher mode)';
COMMENT ON COLUMN public.subscriptions.status IS 'Subscription status: active (valid), canceled (user canceled), expired (period ended)';
COMMENT ON COLUMN public.subscriptions.current_period_start IS 'Start of current 30-day billing cycle';
COMMENT ON COLUMN public.subscriptions.current_period_end IS 'End of current 30-day billing cycle (when tier reverts if not renewed)';
COMMENT ON COLUMN public.subscriptions.pesapal_reference_id IS 'Reference ID from PesaPal payment for tracking and reconciliation';
