
-- RECREATION SCRIPT FOR PROFILES TABLE
-- This script completely resets the profiles table schema to fix structural and permission issues.
-- Run this in your Supabase SQL Editor.

-- 1. Drop the existing table and all its dependencies (triggers, policies)
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. Create the new profiles table with the correct structure
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to Supabase Auth user
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Profile fields
  full_name TEXT NOT NULL,
  company_name TEXT,
  role TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  address TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

  -- Ensure one profile per user
  CONSTRAINT profiles_user_id_key UNIQUE (user_id)
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies

-- Policy for SELECT: Users can only see their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy for INSERT: Users can create their own profile
-- This is critical for the signup flow
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy for UPDATE: Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy for DELETE: Users can delete their own profile
CREATE POLICY "Users can delete own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = user_id);

-- 5. Create Trigger Function for updated_at
-- This function automatically updates the updated_at timestamp
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Attach Trigger to Table
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- Verification comment (can be run separately)
-- SELECT * FROM public.profiles;
