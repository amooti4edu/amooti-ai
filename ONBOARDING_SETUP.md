# Onboarding System Implementation - Setup Guide

## ✅ COMPLETED

### 1. Database Migrations (Created - Ready to Apply)
- ✅ `20260305_add_onboarding_fields.sql` - Adds onboarding_completed and term fields to profiles table
- ✅ `20260305_create_subscriptions_table.sql` - Creates subscriptions table for billing
- ✅ `20260305_add_teacher_role.sql` - Adds 'teacher' role support (changes enum to text with check constraint)

### 2. Frontend Components (Implemented)
- ✅ **RoleSelector.tsx** - Student/Teacher/School selection 
- ✅ **ClassTermForm.tsx** - Class (S1-S4) & Term (1-3) selection (context-aware for each role)
- ✅ **TierSelector.tsx** - Free/Basic/Premium pricing tier selection (with dev mode payment skip)
- ✅ **Onboarding.tsx** - Master coordinator managing the flow (supports all 3 roles)
- ✅ **ProfileEditor.tsx** - Editable profile dialog accessible from chat
- ✅ **Chat.tsx** - Updated with onboarding check before showing chat

### 3. Auth Context Updates
- ✅ Updated signUp to support: student | teacher | school
- ✅ Updated Profile interface with onboarding_completed and term fields
- ✅ Updated fetchProfile query to include new fields

### 4. Login Page Fixed
- ✅ Fixed bug where "teacher" role was being converted to "student"
- ✅ Now properly supports three distinct roles: student, teacher, school
- ✅ Login URLs: `/login/student`, `/login/teacher`, `/login/school`

---

## 🐛 Bug Fix Summary

**Issue**: Login page was converting teacher role to student
- Problem: `Login.tsx` had logic that treated everything except "school" as "student"
- Fix: Updated to support all three roles: student, teacher, school
- Impact: Teachers can now sign up and be properly identified as teachers in the system

**Changes Made**:
1. Updated `Login.tsx` - role parameter handling
2. Updated `src/lib/auth.tsx` - signUp type signature
3. Updated `RoleSelector.tsx` - now shows 3 distinct options
4. Updated `ClassTermForm.tsx` - context-aware messaging for each role
5. Updated `Onboarding.tsx` - supports all 3 roles in state management

---

## 🚀 NEXT STEPS - To Get Everything Working

### Step 1: Apply Database Migrations to Supabase

Run these migrations in your Supabase SQL editor in this exact order:

#### Migration 1: Add teacher role support
```sql
-- From: supabase/migrations/20260305_add_teacher_role.sql
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'teacher', 'school'));

COMMENT ON COLUMN profiles.role IS 'User role: student (individual learner), teacher (individual educator), or school (enterprise account)';

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
```

#### Migration 2: Add onboarding fields to profiles
```sql
-- From: supabase/migrations/20260305_add_onboarding_fields.sql

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS term TEXT;

COMMENT ON COLUMN profiles.onboarding_completed IS 'Flag indicating user has completed initial onboarding (role, class, tier selection)';
COMMENT ON COLUMN profiles.term IS 'Student term/form level (s1, s2, s3, s4) or null for teachers/other roles';

CREATE INDEX IF NOT EXISTS idx_profile_onboarding ON profiles(onboarding_completed);
```

#### Migration 3: Create subscriptions table
```sql
-- From: supabase/migrations/20260305_create_subscriptions_table.sql

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    tier TEXT NOT NULL CHECK (tier IN ('free', 'basic', 'premium')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    pesapal_reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

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

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON public.subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end);

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
```

### Step 2: Regenerate Supabase Types

   ```sql
   -- From: supabase/migrations/20260305_add_onboarding_fields.sql
   
   ALTER TABLE profiles
   ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
   
   ALTER TABLE profiles
   ADD COLUMN IF NOT EXISTS term TEXT;
   
   COMMENT ON COLUMN profiles.onboarding_completed IS 'Flag indicating user has completed initial onboarding (role, class, tier selection)';
   COMMENT ON COLUMN profiles.term IS 'Student term/form level (s1, s2, s3, s4) or null for teachers/other roles';
   
   CREATE INDEX IF NOT EXISTS idx_profile_onboarding ON profiles(onboarding_completed);
   ```

2. **Create subscriptions table:**
   ```sql
   -- From: supabase/migrations/20260305_create_subscriptions_table.sql
   
   CREATE TABLE IF NOT EXISTS public.subscriptions (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
       tier TEXT NOT NULL CHECK (tier IN ('free', 'basic', 'premium')),
       status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
       current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
       current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
       pesapal_reference_id TEXT,
       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   
   ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
   
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
   
   CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
   CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON public.subscriptions(tier);
   CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
   CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions(current_period_end);
   
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
   ```

### Step 2: Regenerate Supabase Types

After applying migrations, regenerate your Supabase types:

```bash
npm run supabase:types
```

Or manually: Open Supabase dashboard → SQL Editor → Run types generation

### Step 3: Verify Schema with Check Script

```bash
export VITE_SUPABASE_PUBLISHABLE_KEY="your_key_here" && node check-supabase-schema.js
```

Should show:
- ✅ profiles table exists with onboarding_completed and term
- ✅ subscriptions table exists with all required columns
- ✅ Both tables have proper RLS policies and indexes

---

## 📋 Account Types & Architecture

### Three Account Types

#### 1. **Student Account** (individual)
- **Who**: Individual learners wanting to study with AI tutoring
- **Profile fields**: role='student', class, term, tier
- **Features**: 
  - Personal chat history
  - Query & Quiz modes (if premium)
  - Daily usage limits based on tier
- **Storage**: Individual data isolated per user

#### 2. **Teacher Account** (individual)
- **Who**: Individual educators wanting to create lesson plans and materials
- **Profile fields**: role='teacher', class, term, tier
- **Features**:
  - Teacher mode (premium only)
  - Lesson plan generation
  - Document creation and export
  - Daily usage limits based on tier
- **Storage**: Individual data isolated per user

#### 3. **School Account** (enterprise)
- **Who**: School administrators or organizations managing multiple users
- **Profile fields**: role='school', class, term, tier
- **Features**:
  - **IMPORTANT**: One login, shared by multiple students & teachers
  - School-wide subscription and usage tracking
  - Bulk user management (TODO)
  - Organization-level settings (TODO)
- **User Tracking**: Need to track individual students/teachers using the school account
  - Future: Implement `school_users` table to log who logs in under school account
  - Current: Need to collect user info (names, roles) during school setup

### Role Flow Differences

All three follow the same onboarding steps:
1. **Select role** → "Student", "Teacher", or "School"
2. **Select class & term** → S1-S4, Term 1-3 (with contextual messaging)
3. **Select tier** → Free/Basic/Premium (school might have different pricing)
4. **Complete** → Save subscription and mark onboarding_completed = true

**School Special Handling** (TODO):
- For school accounts, might need additional setup:
  - Collect school name
  - Collect initial list of student/teacher users
  - Set up school-level policies
- Store user list in a `school_team_members` or similar table

---

After sign-up/sign-in:

1. **Check onboarding_completed flag** (in Chat.tsx)
   - If `false`: Show Onboarding flow
   - If `true`: Proceed to chat normally

2. **Step 1: Role Selection** (RoleSelector.tsx)
   - Choose: Student or School/Teacher
   - Saves to: `profiles.role`

3. **Step 2: Class & Term** (ClassTermForm.tsx)
   - Select class: S1, S2, S3, S4
   - Select term: 1, 2, 3
   - Saves to: `profiles.class`, `profiles.term`

4. **Step 3: Tier Selection** (TierSelector.tsx)
   - Choose: Free, Basic, Premium
   - Dev mode: Taps tier → immediately proceeds (payment skipped)
   - Prod mode: Would process PesaPal payment
   - Creates: `subscriptions` record (30-day billing cycle)
   - Saves to: `profiles.tier`

5. **Complete Onboarding**
   - Sets: `profiles.onboarding_completed = true`
   - Redirects to Chat

---

## ⚙️ Key Features Implemented

### Profile Editor
- Accessible from chat via settings icon
- Users can update: display_name, class, term anytime
- Current tier displayed (read-only from UI)
- Located at: `src/components/ProfileEditor.tsx`

### Tier Management
- **Free**: 5 questions/day, query & quiz modes
- **Basic**: 10 questions/day, advanced AI
- **Premium**: 20 questions/day + teacher mode + lesson plan generation
- 30-day billing cycle from purchase date

### Development Mode
- `TierSelector.tsx` has `isDevelopment` prop (currently `true`)
- When true: Payment skipped, tier selection immediate
- When false: Would show PesaPal payment redirect
- Toggle: `Chart.tsx` line ~77: `isDevelopment={true}`

---

## 💳 Payment Integration (Placeholder - Ready for PesaPal)

### Current State
- Payment flow is skipped in dev mode
- `pesapal_reference_id` column ready for payment tracking
- `subscriptions` table structure ready for billing

### To Integrate PesaPal
1. Get PesaPal merchant account credentials
2. Create payment modal component
3. Call PesaPal API from TierSelector step
4. Store `pesapal_reference_id` in subscriptions table
5. Create webhook handler for payment confirmation
6. Update subscription status on payment success

### Cron Job for Monthly Reset (To Do)
- Create edge function: `reset_expired_subscriptions`
- Schedule: Daily cron job
- Logic: Find subscriptions where `current_period_end < now()` and `status = 'active'`
- Action: Reset tier to 'free', mark as 'expired'
- Future: Could auto-renew if user enabled auto-renewal

---

## 🔒 Security Considerations

### Row-Level Security (RLS)
- ✅ Users can only view/update own profile
- ✅ Users can only view/update own subscriptions
- ✅ Rate limits table protected by user_id check

### Authentication
- Onboarding requires `session.user` (protected by useAuth)
- Subscription saves require auth token
- All profile updates require user_id validation

### Tier Validation
- Chat/Teacher edge functions check `profiles.tier`
- Daily limits enforced via `rate_limits` table
- Premium-only features gated in UI + backend

---

## 📁 File Structure

```
src/
├── components/
│   ├── onboarding/
│   │   ├── Onboarding.tsx          (Master coordinator)
│   │   ├── RoleSelector.tsx        (Step 1: Role choice)
│   │   ├── ClassTermForm.tsx       (Step 2: Class & term)
│   │   └── TierSelector.tsx        (Step 3: Tier selection)
│   └── ProfileEditor.tsx            (Editable profile dialog)
├── pages/
│   └── Chat.tsx                     (Updated with onboarding check)
└── lib/
    └── auth.tsx                     (Updated Profile interface)

supabase/
├── migrations/
│   ├── 20260305_add_onboarding_fields.sql
│   └── 20260305_create_subscriptions_table.sql
└── check-supabase-schema.js         (Updated schema check)
```

---

## ✨ What's Ready to Test

1. **Sign in/Sign up flow** (Already working)
   - Email/password sign up with role
   - Google OAuth sign in
   - Profile auto-created

2. **Onboarding flow** (Ready to test after migrations applied)
   - Dev mode: Tap role → class → tier → Go to chat
   - No payment required in dev mode
   - All onboarding data saved to DB

3. **Profile editor** (In chat settings)
   - Update display name, class, term
   - Changes persisted immediately

4. **Chat protected by onboarding**
   - Redirects to onboarding if not completed
   - Once complete, normal chat experience

---

## 🔗 Environment Variables

Make sure `.env` is configured:
```
VITE_SUPABASE_PROJECT_ID="ehswpksboxyzqztdhofh"
VITE_SUPABASE_PUBLISHABLE_KEY="your_key"
VITE_SUPABASE_URL="https://ehswpksboxyzqztdhofh.supabase.co"
```

---

## 🐛 Troubleshooting

### "subscriptions table not found" error
- Migrations not yet applied to database
- Run the SQL in Supabase dashboard
- Then run type generation

### Onboarding not showing
- Check `profile?.onboarding_completed` is in DB
- Verify migration applied successfully
- Check browser console for errors

### Profile not updating
- Check RLS policies on profiles table
- Verify user_id matches auth.users(id)
- Check network tab for API errors

---

## 📊 Database Schema Summary

### profiles table additions:
- `onboarding_completed: boolean (default false)`
- `term: text (nullable - s1, s2, s3, s4)`

### subscriptions table (new):
- `id: uuid`
- `user_id: uuid (FK → auth.users)`
- `tier: text (free, basic, premium)`
- `status: text (active, canceled, expired)`
- `current_period_start: timestamptz`
- `current_period_end: timestamptz` (30 days from start)
- `pesapal_reference_id: text (nullable)`
- `created_at, updated_at: timestamptz`

---

**Status**: ✅ Ready for database migrations and testing
**Last Updated**: March 5, 2026
