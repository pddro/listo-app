'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { EmbedSite } from '@/types';
import { ThemeColors } from '@/lib/gemini';
import { supabase } from '@/lib/supabase';

type Status = 'loading' | 'creating' | 'redirecting' | 'error';

export default function MangoClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [site, setSite] = useState<EmbedSite | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const hasStarted = useRef(false);

  const url = searchParams.get('url');
  const siteId = searchParams.get('site');

  // Fetch site branding for the loading screen
  useEffect(() => {
    if (!siteId) return;

    const fetchSite = async () => {
      const { data } = await supabase
        .from('embed_sites')
        .select('*')
        .eq('id', siteId)
        .single();

      if (data) {
        setSite(data as EmbedSite);
      }
    };

    fetchSite();
  }, [siteId]);

  // Create the branded list
  useEffect(() => {
    if (!url || !siteId || hasStarted.current) return;
    hasStarted.current = true;

    const createList = async () => {
      setStatus('creating');

      try {
        const response = await fetch('/api/embed/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, siteId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create list');
        }

        const { listId } = await response.json();
        setStatus('redirecting');
        router.push(`/${listId}`);
      } catch (err) {
        console.error('[Mango] Creation failed:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'Something went wrong'
        );
        setStatus('error');
      }
    };

    createList();
  }, [url, siteId, router]);

  // Missing params
  if (!url || !siteId) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafafa',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>🥭</p>
          <p style={{ color: '#6B7280', fontSize: '16px' }}>
            Missing URL or site parameter.
          </p>
        </div>
      </div>
    );
  }

  const primaryColor = site?.theme
    ? (site.theme as ThemeColors).primary
    : '#FF6B35';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: site?.theme
          ? (site.theme as ThemeColors).bgPrimary
          : '#fafafa',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '32px',
          maxWidth: '400px',
        }}
      >
        {/* Site branding */}
        {site?.favicon_url && (
          <img
            src={site.favicon_url}
            alt={site.name}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              marginBottom: '16px',
              display: 'inline-block',
            }}
          />
        )}

        {site && (
          <p
            style={{
              fontSize: '14px',
              color: site?.theme
                ? (site.theme as ThemeColors).textSecondary
                : '#6B7280',
              marginBottom: '24px',
            }}
          >
            from {site.name}
          </p>
        )}

        {status === 'error' ? (
          <>
            <p
              style={{
                fontSize: '48px',
                marginBottom: '16px',
              }}
            >
              😕
            </p>
            <p
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#dc2626',
                marginBottom: '8px',
              }}
            >
              Couldn&apos;t create your Mango
            </p>
            <p
              style={{
                fontSize: '14px',
                color: '#6B7280',
                marginBottom: '24px',
              }}
            >
              {errorMessage}
            </p>
            <button
              onClick={() => {
                hasStarted.current = false;
                setStatus('loading');
                setErrorMessage('');
                // Trigger re-creation
                window.location.reload();
              }}
              style={{
                padding: '10px 24px',
                backgroundColor: primaryColor,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </>
        ) : (
          <>
            {/* Spinning mango */}
            <div
              style={{
                fontSize: '56px',
                marginBottom: '24px',
                animation: 'spin 2s linear infinite',
              }}
            >
              🥭
            </div>

            <p
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: site?.theme
                  ? (site.theme as ThemeColors).textPrimary
                  : '#1A1A1A',
                marginBottom: '8px',
              }}
            >
              {status === 'redirecting'
                ? 'Your Mango is ready!'
                : 'Creating your Mango...'}
            </p>

            <p
              style={{
                fontSize: '14px',
                color: site?.theme
                  ? (site.theme as ThemeColors).textSecondary
                  : '#6B7280',
              }}
            >
              {status === 'redirecting'
                ? 'Redirecting...'
                : 'Turning this page into a shareable checklist'}
            </p>

            {/* Loading bar */}
            <div
              style={{
                marginTop: '32px',
                height: '3px',
                backgroundColor: site?.theme
                  ? (site.theme as ThemeColors).borderLight
                  : '#E5E7EB',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  backgroundColor: primaryColor,
                  borderRadius: '2px',
                  animation: 'loading 1.5s ease-in-out infinite',
                }}
              />
            </div>
          </>
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes loading {
              0% { width: 0%; margin-left: 0; }
              50% { width: 60%; margin-left: 20%; }
              100% { width: 0%; margin-left: 100%; }
            }
          `,
        }}
      />
    </div>
  );
}
