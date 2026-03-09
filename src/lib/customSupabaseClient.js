import { createClient } from '@supabase/supabase-js';

const normalizeEnv = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const supabaseUrl = normalizeEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = normalizeEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

// Bypass navigator.locks which causes hangs on Edge/Opera where the property
// is non-configurable.  GoTrue's lock option lets us skip it on all browsers.
const customSupabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { lock: async (_name, _acquireTimeout, fn) => fn() },
    })
  : null;

export default customSupabaseClient;

export {
    customSupabaseClient,
    customSupabaseClient as supabase,
    supabaseUrl,
    supabaseAnonKey,
};
