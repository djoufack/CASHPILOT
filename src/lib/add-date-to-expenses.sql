
-- Migration to add date column to expenses table
-- Run this in your Supabase SQL Editor

-- 1. Add the date column if it doesn't exist
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Backfill existing records: set 'date' to 'created_at' where it is currently null
UPDATE public.expenses 
SET date = created_at 
WHERE date IS NULL;
