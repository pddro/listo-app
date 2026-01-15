import { createClient } from '@supabase/supabase-js';

const isProd = process.env.NODE_ENV === 'production';

const supabaseUrl = isProd
  ? process.env.NEXT_PUBLIC_SUPABASE_URL_PROD!
  : process.env.NEXT_PUBLIC_SUPABASE_URL_DEV!;

const supabaseAnonKey = isProd
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD!
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
