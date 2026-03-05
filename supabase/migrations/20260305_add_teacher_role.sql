-- Migration: Add teacher role to app_role enum
-- Date: 2026-03-05
-- Description: Extends app_role enum to support individual teachers in addition to students and school accounts

-- Add 'teacher' to the app_role enum
-- Note: In PostgreSQL, to add a value to an enum, we need to create a new type and migrate
-- This is a more complex operation, so we'll use a text column approach with check constraint instead

-- First, update profiles table role column from enum to text with check constraint
-- Step 1: Backup the data
CREATE TEMP TABLE profiles_backup AS
SELECT * FROM profiles;

-- Step 2: Drop constraints that reference the enum
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Step 3: Change role column type from app_role to text
ALTER TABLE profiles 
  ALTER COLUMN role TYPE text 
  USING role::text;

-- Step 4: Add check constraint for valid roles
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'teacher', 'school'));

-- Step 5: Add comment
COMMENT ON COLUMN profiles.role IS 'User role: student (individual learner), teacher (individual educator), or school (enterprise account)';

-- Step 6: Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Notes:
-- - 'student': Individual student account
-- - 'teacher': Individual teacher account  
-- - 'school': Enterprise account shared by multiple users
-- The handle_new_user trigger will need to be updated to use 'student' | 'teacher' | 'school'
