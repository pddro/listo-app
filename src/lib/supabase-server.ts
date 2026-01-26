import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client for API routes
const appEnv = process.env.NEXT_PUBLIC_APP_ENV || 'development';
const isProd = appEnv === 'production';

const supabaseUrl = isProd
  ? process.env.NEXT_PUBLIC_SUPABASE_URL_PROD || ''
  : process.env.NEXT_PUBLIC_SUPABASE_URL_DEV || '';

const supabaseAnonKey = isProd
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD || ''
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV || '';

export const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);
