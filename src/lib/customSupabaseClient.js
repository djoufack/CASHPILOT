import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rfzvrezrcigzmldgvntz.supabase.co';
const supabaseAnonKey = '[SUPABASE_ANON_KEY_REDACTED]';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
