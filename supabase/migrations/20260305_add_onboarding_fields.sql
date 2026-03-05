-- Migration: Add onboarding fields to profiles
-- Date: 2026-03-05
-- Description: Adds onboarding_completed and term fields to support onboarding flow

-- Add onboarding_completed column (tracks if user completed initial setup)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Add term column (s1-s4 for students, nullable for teachers)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS term TEXT;

-- Add comments for clarity
COMMENT ON COLUMN profiles.onboarding_completed IS 'Flag indicating user has completed initial onboarding (role, class, tier selection)';
COMMENT ON COLUMN profiles.term IS 'Student term/form level (s1, s2, s3, s4) or null for teachers/other roles';

-- Create index for onboarding queries
CREATE INDEX IF NOT EXISTS idx_profile_onboarding ON profiles(onboarding_completed);
