/*
  # Add profile auto-creation trigger

  1. Purpose
    When a new user signs up via Supabase Auth, a corresponding `profiles` row
    must be created automatically. Without this, all subsequent queries to
    `profiles` and `games` tables fail with 400/404 errors because the user
    has no profile record.

  2. Changes
    - Create `handle_new_user()` function that inserts a profile row
      with defaults (name, coins, elo, skins) from the auth user's metadata
    - Create `on_auth_user_created` trigger on `auth.users` AFTER INSERT
      that calls `handle_new_user()`

  3. Security
    - The function runs with SECURITY DEFINER (as the database owner)
      so it can insert into `public.profiles` even though the calling
      user (the new auth user) doesn't yet have INSERT permission
    - The trigger is on `auth.users` which only Supabase Auth can write to
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
