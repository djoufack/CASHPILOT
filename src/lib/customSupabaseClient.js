import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://rfzvrezrcigzmldgvntz.supabase.co';
export const supabaseAnonKey = '[SUPABASE_ANON_KEY_REDACTED]';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
