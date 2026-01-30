
-- This SQL script is designed to fix Row Level Security (RLS) policies for the 'profiles' table.
-- It addresses issues where a new profile cannot be created due to RLS violations during user signup.
-- This script ensures that authenticated users can create, view, update, and delete their own profiles.

-- Step 1: Temporarily disable RLS on the 'profiles' table.
-- This allows us to modify policies without immediate enforcement issues.
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on the 'profiles' table.
-- This ensures a clean slate before applying new policies, preventing conflicts.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Users can only insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;
-- Add more DROP POLICY statements here if you have other specific policy names
-- Example: DROP POLICY IF EXISTS "old_policy_name" ON public.profiles;

-- Step 3: Create an INSERT policy for the 'profiles' table.
-- This policy allows any authenticated user to insert a new profile,
-- but only if the user_id in the new profile matches their authenticated user ID.
CREATE POLICY "Allow authenticated user to insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Step 4: Create a SELECT policy for the 'profiles' table.
-- This policy allows authenticated users to view their own profile data.
CREATE POLICY "Allow authenticated user to select their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Step 5: Create an UPDATE policy for the 'profiles' table.
-- This policy allows authenticated users to modify their own profile data.
CREATE POLICY "Allow authenticated user to update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 6: Create a DELETE policy for the 'profiles' table.
-- This policy allows authenticated users to delete their own profile data.
CREATE POLICY "Allow authenticated user to delete their own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Step 7: Re-enable RLS on the 'profiles' table.
-- After all policies are set up, re-enable RLS to enforce them.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Important Note:
-- To apply this script, you need to execute it in your Supabase SQL editor
-- or via a migration tool. This will ensure that new users can sign up
-- and create their profiles without encountering RLS errors.
-- Make sure the 'user_id' column in your 'profiles' table is correctly linked
-- to 'auth.users.id' (e.g., via a foreign key constraint).
