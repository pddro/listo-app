// API endpoints configuration
// Uses Supabase Edge Functions for all AI-related functionality

// Determine if we're in Vite environment
const isVite = typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined';

// Get Supabase URL and anon key based on environment
let SUPABASE_URL: string;
let SUPABASE_ANON_KEY: string;

if (isVite) {
  // Vite environment
  SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
  SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
} else {
  // Next.js environment
  SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL_PROD || process.env.NEXT_PUBLIC_SUPABASE_URL_DEV || '';
  SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV || '';
}

// Get edge function URL
const getEdgeFunctionUrl = (functionName: string) => {
  // For production, use edge functions
  // URL format: https://PROJECT_REF.supabase.co -> https://PROJECT_REF.supabase.co/functions/v1/FUNCTION
  if (SUPABASE_URL) {
    return `${SUPABASE_URL}/functions/v1/${functionName}`;
  }
  // Fallback to local API routes for development
  return `/api/${functionName}`;
};

export const API = {
  ai: getEdgeFunctionUrl('ai'),
  theme: getEdgeFunctionUrl('theme'),
  title: getEdgeFunctionUrl('title'),
  emojify: getEdgeFunctionUrl('emojify'),
  transcribe: getEdgeFunctionUrl('transcribe'),
} as const;

// Get headers for Supabase edge function calls
export const getSupabaseHeaders = (): Record<string, string> => {
  if (SUPABASE_ANON_KEY) {
    return {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    };
  }
  return {};
};

// Helper to make API calls with proper error handling
export async function apiCall<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `API call failed: ${response.status}`);
  }

  return response.json();
}
