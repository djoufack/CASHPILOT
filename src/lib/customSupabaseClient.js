import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rfzvrezrcigzmldgvntz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmenZyZXpyY2lnem1sZGd2bnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjcxODIsImV4cCI6MjA4NTIwMzE4Mn0.glzebP-k0AqNHdoru-bY83mJqyS19gVSEH-hgQhuXTA';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
