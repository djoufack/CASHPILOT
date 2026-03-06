import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

// In-memory storage for Node.js (no localStorage available).
// This lets Supabase JS persist the session and automatically include
// the JWT in PostgREST requests — without reassigning the client instance.
const memoryStorage: Record<string, string> = {};
const customStorage = {
  getItem: (key: string) => memoryStorage[key] ?? null,
  setItem: (key: string, value: string) => { memoryStorage[key] = value; },
  removeItem: (key: string) => { delete memoryStorage[key]; },
};

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    persistSession: true,
    autoRefreshToken: false,
  }
});

let currentUserId: string | null = null;
let currentSession: Session | null = null;

/**
 * Login with email/password. Sets the session for all subsequent queries.
 * Uses in-memory storage so the existing client instance automatically
 * includes the JWT in all PostgREST requests (no reassignment needed).
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
  // Clear in-memory storage
  for (const key of Object.keys(memoryStorage)) {
    delete memoryStorage[key];
  }
}

/**
 * Get the current authenticated user ID. Throws if not logged in.
 */
export function getUserId(): string {
  if (!currentUserId) throw new Error('Not authenticated. Use the "login" tool first.');
  return currentUserId;
}

/**
 * Get the current session access token. Throws if not logged in.
 */
export function getAccessToken(): string {
  if (!currentSession?.access_token) throw new Error('Not authenticated. Use the "login" tool first.');
  return currentSession.access_token;
}

/**
 * Get the Supabase project URL.
 */
export function getSupabaseUrl(): string {
  return supabaseUrl!;
}

/**
 * Check if a user is currently logged in.
 */
export function isAuthenticated(): boolean {
  return currentUserId !== null && currentSession !== null;
}

export { supabase };
