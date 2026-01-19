// API endpoints configuration
// Uses Supabase Edge Functions for all AI-related functionality

// Determine if we're in Vite environment
const isVite = typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined';

// Get Supabase URL based on environment
let SUPABASE_URL: string;

if (isVite) {
  // Vite environment
  SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
} else {
  // Next.js environment
  SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL_PROD || process.env.NEXT_PUBLIC_SUPABASE_URL_DEV || '';
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
