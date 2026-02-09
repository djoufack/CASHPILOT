import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

let currentUserId: string | null = null;
let currentSession: Session | null = null;

/**
 * Login with email/password. Sets the session for all subsequent queries.
 * RLS policies apply automatically after login.
 */
export async function login(email: string, password: string): Promise<{ userId: string; email: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed: ${error.message}`);
  if (!data.session || !data.user) throw new Error('Login failed: no session returned');

  currentSession = data.session;
  currentUserId = data.user.id;

  return { userId: data.user.id, email: data.user.email || email };
}

/**
 * Logout and clear the session.
 */
export async function logout(): Promise<void> {
  await supabase.auth.signOut();
  currentSession = null;
  currentUserId = null;
}

/**
 * Get the current authenticated user ID. Throws if not logged in.
 */
export function getUserId(): string {
  if (!currentUserId) throw new Error('Not authenticated. Use the "login" tool first.');
  return currentUserId;
}

/**
 * Check if a user is currently logged in.
 */
export function isAuthenticated(): boolean {
  return currentUserId !== null && currentSession !== null;
}

export { supabase };
