import { createClient } from '@supabase/supabase-js';

// Determine if we're in Vite environment
const isVite = typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined';

// Get environment variables based on the environment
let supabaseUrl: string;
let supabaseAnonKey: string;

if (isVite) {
  // Vite environment - use VITE_ prefixed env vars
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
} else {
  // Next.js environment
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV || 'development';
  const isProd = appEnv === 'production';

  supabaseUrl = isProd
    ? process.env.NEXT_PUBLIC_SUPABASE_URL_PROD || ''
    : process.env.NEXT_PUBLIC_SUPABASE_URL_DEV || '';

  supabaseAnonKey = isProd
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD || ''
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV || '';
}

console.log('[Supabase] Initializing with URL:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'EMPTY');
console.log('[Supabase] isVite:', isVite);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
