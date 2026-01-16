import { createClient } from '@supabase/supabase-js';

// Use NEXT_PUBLIC_APP_ENV to determine environment
// Set this in your hosting platform: "production" or "staging"/"development"
const appEnv = process.env.NEXT_PUBLIC_APP_ENV || 'development';
const isProd = appEnv === 'production';

const supabaseUrl = isProd
  ? process.env.NEXT_PUBLIC_SUPABASE_URL_PROD!
  : process.env.NEXT_PUBLIC_SUPABASE_URL_DEV!;

const supabaseAnonKey = isProd
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD!
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
