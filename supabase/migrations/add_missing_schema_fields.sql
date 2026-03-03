-- Migration: Add missing schema fields for edge functions
-- Date: 2026-03-03
-- Description: Adds tier, subject, class to profiles and completes rate_limits table

-- ============================================================================
-- 1. Add tier column to profiles (required for rate limits & plan validation)
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'
CHECK (tier IN ('free', 'basic', 'premium'));

COMMENT ON COLUMN profiles.tier IS 'User subscription tier: free (5 q/day), basic (10 q/day), premium (20 q/day)';

-- ============================================================================
-- 2. Add optional subject and class columns to profiles (improves context)
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN subject TEXT,
ADD COLUMN class TEXT;

COMMENT ON COLUMN profiles.subject IS 'Primary subject (e.g., Chemistry, Biology)';
COMMENT ON COLUMN profiles.class IS 'Student class/level (e.g., Senior 2, Form 4)';

-- ============================================================================
-- 3. Complete rate_limits table with missing columns
-- ============================================================================

ALTER TABLE rate_limits
ADD COLUMN daily_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN burst_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN last_day TEXT;

COMMENT ON COLUMN rate_limits.daily_count IS 'Number of requests used today';
COMMENT ON COLUMN rate_limits.burst_count IS 'Number of requests in current minute window';
COMMENT ON COLUMN rate_limits.last_day IS 'Last day queries were made (YYYY-MM-DD format)';

-- ============================================================================
-- Create indexes for faster rate limit lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON rate_limits(user_id);

-- ============================================================================
-- Summary of changes:
-- ============================================================================
-- profiles table:
--   + tier (text, default 'free', constrained to free/basic/premium)
--   + subject (text, optional)
--   + class (text, optional)
--
-- rate_limits table:
--   + daily_count (integer, default 0)
--   + burst_count (integer, default 0)
--   + last_day (text, YYYY-MM-DD format)
--   + index on user_id for faster lookups
-- ============================================================================
