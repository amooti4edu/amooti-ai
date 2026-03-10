-- Migration: Fix handle_new_user trigger for proper profile creation
-- Date: 2026-03-10
-- Description: Corrects the handle_new_user function to properly create profiles with all required fields

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _role text;
  _display_name text;
BEGIN
  -- Determine role from metadata or default to 'student'
  _role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  
  -- Determine display_name from metadata or user info
  _display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'name',
    NEW.email
  );
  
  -- Insert profile with all required fields
  INSERT INTO public.profiles (
    user_id,
    display_name,
    role,
    tier,
    onboarding_completed
  ) VALUES (
    NEW.id,
    _display_name,
    _role,
    'free',
    false
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Insert into user_roles if the table exists (for backward compatibility)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trg_new_user ON auth.users;
CREATE TRIGGER trg_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();