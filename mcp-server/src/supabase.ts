import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { AsyncLocalStorage } from 'node:async_hooks';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

// ── Per-session state via AsyncLocalStorage ───────────────────────────────────
// Each HTTP session runs its tool handlers inside a context created by
// runWithSessionContext().  All auth helpers read/write from that context
// instead of from module-level singletons, so two simultaneous sessions
// never see each other's credentials (fixes ENF-2 multi-session isolation).

export interface SessionState {
  supabase: SupabaseClient;
  memoryStorage: Record<string, string>;
  userId: string | null;
  session: Session | null;
  companyId: string | null;
}

export const sessionStorage = new AsyncLocalStorage<SessionState>();

function createSessionState(): SessionState {
  const memoryStorage: Record<string, string> = {};
  const customStorage = {
    getItem: (key: string) => memoryStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      memoryStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete memoryStorage[key];
    },
  };

  const client = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      storage: customStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return {
    supabase: client,
    memoryStorage,
    userId: null,
    session: null,
    companyId: null,
  };
}

/**
 * Run `fn` inside an isolated session context.
 * Used by the HTTP server to wrap each session's tool handler dispatch.
 * For stdio (single-user), a default context is injected at startup.
 */
export function runWithSessionContext<T>(state: SessionState, fn: () => T): T {
  return sessionStorage.run(state, fn);
}

export function createNewSessionState(): SessionState {
  return createSessionState();
}

// ── Fallback singleton for stdio (single-user) mode ──────────────────────────
// When running via stdio there is no HTTP layer and no concurrent sessions,
// so we keep a single global state and inject it automatically.
const stdioState = createSessionState();

function getState(): SessionState {
  const ctx = sessionStorage.getStore();
  if (ctx) return ctx;
  // Fallback for stdio mode (no AsyncLocalStorage context active)
  return stdioState;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** The Supabase client for the current session. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getState().supabase;
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

/**
 * Login with email/password. Sets the session for all subsequent queries
 * within the current AsyncLocalStorage context.
 */
export async function login(email: string, password: string): Promise<{ userId: string; email: string }> {
  const state = getState();
  const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed: ${error.message}`);
  if (!data.session || !data.user) throw new Error('Login failed: no session returned');

  state.session = data.session;
  state.userId = data.user.id;
  state.companyId = null; // reset cached company on new login

  return { userId: data.user.id, email: data.user.email || email };
}

/**
 * Logout and clear the session for the current context.
 */
export async function logout(): Promise<void> {
  const state = getState();
  await state.supabase.auth.signOut();
  state.session = null;
  state.userId = null;
  state.companyId = null;
  for (const key of Object.keys(state.memoryStorage)) {
    delete state.memoryStorage[key];
  }
}

/**
 * Proactively refresh the session if it expires within 5 minutes.
 * Called before operations that need a valid token.
 */
export async function ensureSessionValid(): Promise<void> {
  const state = getState();
  if (!state.session) return;
  const expiresAt = state.session.expires_at || 0;
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt - now < 300) {
    const { data, error } = await state.supabase.auth.refreshSession();
    if (!error && data.session) {
      state.session = data.session;
      state.userId = data.session.user?.id ?? state.userId;
    } else if (expiresAt < now) {
      state.session = null;
      state.userId = null;
      throw new Error('Session expired and refresh failed. Please login again.');
    }
  }
}

/**
 * Get the current authenticated user ID. Throws if not logged in or session expired.
 */
export async function ensureAndGetUserId(): Promise<string> {
  await ensureSessionValid();
  return getUserId();
}

export function getUserId(): string {
  const state = getState();
  if (!state.userId) throw new Error('Not authenticated. Use the "login" tool first.');
  if (state.session?.expires_at && state.session.expires_at < Math.floor(Date.now() / 1000)) {
    state.session = null;
    state.userId = null;
    throw new Error('Session expired. Please login again.');
  }
  return state.userId;
}

/**
 * Get the current session access token. Throws if not logged in.
 */
export function getAccessToken(): string {
  const state = getState();
  if (!state.session?.access_token) throw new Error('Not authenticated. Use the "login" tool first.');
  return state.session.access_token;
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
  const state = getState();
  return state.userId !== null && state.session !== null;
}

/**
 * Get the company_id for the current user. Fetches and caches on first call per session.
 * Returns the first company owned by the user (most users have one).
 */
export async function getCompanyId(): Promise<string> {
  const state = getState();
  if (state.companyId) return state.companyId;
  const userId = getUserId();
  const { data, error } = await state.supabase
    .from('company')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  if (error || !data) throw new Error('No company found for this user. Create a company first.');
  state.companyId = data.id;
  return state.companyId!;
}
