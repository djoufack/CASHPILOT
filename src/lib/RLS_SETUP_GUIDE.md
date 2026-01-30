
# Row Level Security (RLS) Setup Guide

This guide explains how to secure your application data using Row Level Security (RLS) in Supabase.

## Why RLS is Important

By default, without RLS policies, tables in Supabase might be "UNRESTRICTED" or protected in a way that doesn't verify the owner of the data. 

**Row Level Security** ensures that:
- Users can **only view** their own data.
- Users can **only create** data belonging to themselves.
- Users can **only update/delete** their own data.

This prevents one user from accessing or modifying another user's clients, invoices, or personal information.

## How to Apply the Fix

We have created a comprehensive SQL script `src/lib/fix-rls-policies.sql` that:
1. Automatically removes any conflicting old policies.
2. Enables RLS on all key tables.
3. Creates strict security policies for each table.

### Steps:

1. **Copy the SQL Code**:
   Open `src/lib/fix-rls-policies.sql` in your project and copy all of its content.

2. **Go to Supabase Dashboard**:
   Log in to your Supabase project dashboard.

3. **Open SQL Editor**:
   Click on the **SQL Editor** icon in the left sidebar.

4. **Create a New Query**:
   Click "New query" or open an empty query editor.

5. **Paste and Run**:
   - Paste the code you copied.
   - Click the **Run** button (bottom right or top right depending on UI).
   - You should see a "Success" message indicating the policies were applied.

## Protected Tables

The script secures the following tables:
- `profiles`
- `clients`
- `projects`
- `tasks` (secured via project ownership)
- `timesheets`
- `invoices`
- `quotes`
- `expenses`
- `notifications`
- `recurring_invoices`

## Troubleshooting

### "New row violates row-level security policy"
If you see this error when trying to create data (e.g., signing up or adding a client):
- **Cause**: The data you are trying to insert has a `user_id` that does NOT match your currently logged-in user's ID (`auth.uid()`).
- **Fix**: Ensure your application code is correctly passing the user's ID. For example:
  