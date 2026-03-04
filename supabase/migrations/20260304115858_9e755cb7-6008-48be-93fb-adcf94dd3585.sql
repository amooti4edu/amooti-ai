
-- ============================================================
-- 1. RATE_LIMITS: restructure to use user_id as PK
-- ============================================================

-- Drop existing rate_limits and recreate
DROP TABLE IF EXISTS public.rate_limits;

CREATE TABLE public.rate_limits (
    user_id      UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    burst_count  INTEGER     DEFAULT 0,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    daily_count  INTEGER     DEFAULT 0,
    last_day     DATE        DEFAULT CURRENT_DATE,
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rl_user ON public.rate_limits(user_id);

-- Auto-update updated_at on rate_limits
CREATE OR REPLACE FUNCTION public.update_rate_limits_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rate_limits_updated
  BEFORE UPDATE ON public.rate_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_rate_limits_timestamp();

-- RLS: users can view own rate limits (edge function uses service role for writes)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rate limits"
  ON public.rate_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. PROFILES: make id = auth user id
-- ============================================================

-- Backup existing profiles data
CREATE TEMP TABLE _profiles_backup AS
  SELECT user_id, display_name, tier, role::text as role_text, subject, class, created_at
  FROM public.profiles;

-- Drop and recreate profiles
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.profiles (
    id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tier         TEXT        NOT NULL DEFAULT 'free',
    role         TEXT        NOT NULL DEFAULT 'individual',
    display_name TEXT,
    subject      TEXT,
    class        TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Restore data: map user_id -> id
INSERT INTO public.profiles (id, display_name, tier, role, subject, class, created_at)
  SELECT user_id, display_name, COALESCE(tier, 'free'), COALESCE(role_text, 'individual'), subject, class, created_at
  FROM _profiles_backup
ON CONFLICT (id) DO NOTHING;

DROP TABLE IF EXISTS _profiles_backup;

-- RLS policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- 3. UPDATE handle_new_user() trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, tier, role, display_name)
  VALUES (
    NEW.id,
    'free',
    COALESCE(NEW.raw_user_meta_data->>'role', 'individual'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;

  -- Also insert into user_roles if it exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student'))
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trg_new_user ON auth.users;
CREATE TRIGGER trg_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
