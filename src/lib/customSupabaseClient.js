import { createClient } from '@supabase/supabase-js';

// supabase-js v2.39 does NOT forward auth.lock to gotrue-js, so the only way
// to prevent "Lock broken by another request with the 'steal' option" AbortErrors
// is to remove navigator.locks before the client initialises.  GoTrue then falls
// back to its built-in lockNoOp, which is safe for single-tab usage.
try {
  if (typeof globalThis !== 'undefined' && globalThis.navigator && globalThis.navigator.locks) {
    Object.defineProperty(globalThis.navigator, 'locks', { value: undefined, configurable: true, writable: true });
  }
} catch (_e) {
  // navigator.locks may be non-configurable in some browsers — ignore
}

const normalizeEnv = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const supabaseUrl = normalizeEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = normalizeEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

const customSupabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export default customSupabaseClient;

export {
    customSupabaseClient,
    customSupabaseClient as supabase,
    supabaseUrl,
    supabaseAnonKey,
};
