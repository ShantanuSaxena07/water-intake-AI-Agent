import { createClient } from '@supabase/supabase-js';

// Read the secret credentials we saved in the vault (.env.local)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Initialize the secure connection client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);