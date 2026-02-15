'use client';

import { useState } from 'react';
import { EmbedSite } from '@/types';

type SetupState = 'idle' | 'loading' | 'done' | 'error';

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  let r = parseInt(c.substring(0, 2), 16) / 255;
  let g = parseInt(c.substring(2, 4), 16) / 255;
  let b = parseInt(c.substring(4, 6), 16) / 255;
  r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
}

export default function EmbedClient() {
  const [url, setUrl] = useState('');
  const [buttonColor, setButtonColor] = useState('#FF6B35');
  const [state, setState] = useState<SetupState>('idle');
  const [site, setSite] = useState<EmbedSite | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setState('loading');
    setErrorMessage('');

    try {
      const response = await fetch('/api/embed/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), buttonColor }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Setup failed');
      }

      const { site: siteData } = await response.json();
      setSite(siteData);
      // Auto-apply the site's primary color as button color
      if (siteData.colors?.primary) {
        setButtonColor(siteData.colors.primary);
      }
      setState('done');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong'
      );
      setState('error');
    }
  };

  const embedCode = site
    ? `<script src="https://listmango.com/embed.js" data-site="${site.id}" data-color="${buttonColor}"></script>`
    : '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#fafafa',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: '48px 24px',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <p style={{ fontSize: '48px', marginBottom: '8px' }}>🥭</p>
          </a>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#1A1A1A',
              marginBottom: '12px',
            }}
          >
            Embed ListMango
          </h1>
          <p style={{ fontSize: '16px', color: '#6B7280', lineHeight: 1.6 }}>
            Let your readers turn any page into a shareable checklist.
            <br />
            Branded with your site&apos;s colors and identity.
          </p>
        </div>

        {state === 'done' && site ? (
          /* Results */
          <div>
            {/* Site preview */}
            <div
              style={{
                padding: '24px',
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                {site.favicon_url && (
                  <img
                    src={site.favicon_url}
                    alt=""
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                    }}
                  />
                )}
                <div>
                  <p
                    style={{
                      fontWeight: 600,
                      fontSize: '16px',
                      color: '#1A1A1A',
                    }}
                  >
                    {site.name}
                  </p>
                  <p style={{ fontSize: '13px', color: '#6B7280' }}>
                    {site.domain}
                  </p>
                </div>
              </div>

              {/* Color swatches */}
              {site.colors && (
                <div
                  style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
                >
                  {Object.entries(site.colors as unknown as Record<string, string>).map(
                    ([key, value]) => (
                      <button
                        key={key}
                        onClick={() => setButtonColor(value)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          backgroundColor: buttonColor === value ? '#EFF6FF' : '#F9FAFB',
                          borderRadius: '6px',
                          fontSize: '12px',
                          border: buttonColor === value ? '1px solid #93C5FD' : '1px solid transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '4px',
                            backgroundColor: value,
                            border: '1px solid #E5E7EB',
                          }}
                        />
                        <span style={{ color: '#6B7280' }}>{key}</span>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Customization */}
            <div
              style={{
                padding: '24px',
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                marginBottom: '24px',
              }}
            >
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  marginBottom: '16px',
                }}
              >
                Customize
              </h3>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <label style={{ flexShrink: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      color: '#6B7280',
                      marginBottom: '6px',
                    }}
                  >
                    Color
                  </span>
                  <input
                    type="color"
                    value={buttonColor}
                    onChange={(e) => setButtonColor(e.target.value)}
                    style={{
                      width: '44px',
                      height: '44px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  />
                </label>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: '12px',
                      color: '#6B7280',
                      marginBottom: '6px',
                    }}
                  >
                    Preview
                  </span>
                  <button
                    style={{
                      padding: '10px 18px',
                      backgroundColor: buttonColor,
                      color: isLightColor(buttonColor) ? '#1A1A1A' : '#fff',
                      border: 'none',
                      borderRadius: '24px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'default',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                    }}
                  >
                    🥭 Make it a List
                  </button>
                </div>
              </div>
            </div>

            {/* Embed code */}
            <div
              style={{
                padding: '24px',
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                marginBottom: '24px',
              }}
            >
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#1A1A1A',
                  marginBottom: '12px',
                }}
              >
                Embed Code
              </h3>
              <p
                style={{
                  fontSize: '13px',
                  color: '#6B7280',
                  marginBottom: '12px',
                  lineHeight: 1.5,
                }}
              >
                Paste this before the closing{' '}
                <code
                  style={{
                    backgroundColor: '#F3F4F6',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                >
                  &lt;/body&gt;
                </code>{' '}
                tag on any page.
              </p>

              <div
                style={{
                  position: 'relative',
                  backgroundColor: '#1A1A1A',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <code
                  style={{
                    color: '#E5E7EB',
                    fontSize: '13px',
                    wordBreak: 'break-all',
                    lineHeight: 1.5,
                    display: 'block',
                  }}
                >
                  {embedCode}
                </code>
                <button
                  onClick={handleCopy}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    padding: '6px 12px',
                    backgroundColor: copied ? '#22C55E' : '#374151',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Start over */}
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => {
                  setState('idle');
                  setSite(null);
                  setUrl('');
                }}
                style={{
                  color: '#6B7280',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '14px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Set up a different site
              </button>
            </div>
          </div>
        ) : (
          /* Setup form */
          <form onSubmit={handleSubmit}>
            <div
              style={{
                padding: '24px',
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                marginBottom: '24px',
              }}
            >
              <label>
                <span
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    marginBottom: '8px',
                  }}
                >
                  Your website URL
                </span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  disabled={state === 'loading'}
                />
              </label>

              {errorMessage && (
                <p
                  style={{
                    color: '#dc2626',
                    fontSize: '14px',
                    marginTop: '12px',
                  }}
                >
                  {errorMessage}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={state === 'loading' || !url.trim()}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor:
                  state === 'loading' || !url.trim() ? '#D1D5DB' : '#FF6B35',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 600,
                cursor:
                  state === 'loading' || !url.trim()
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {state === 'loading'
                ? 'Scanning your site...'
                : 'Get Embed Code'}
            </button>
          </form>
        )}

        {/* How it works */}
        <div style={{ marginTop: '48px' }}>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#1A1A1A',
              marginBottom: '24px',
              textAlign: 'center',
            }}
          >
            How it works
          </h2>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {[
              {
                icon: '1',
                title: 'Enter your site URL',
                desc: "We'll extract your branding (colors, favicon, name)",
              },
              {
                icon: '2',
                title: 'Copy the embed code',
                desc: 'A single <script> tag — paste it on any page',
              },
              {
                icon: '3',
                title: 'Readers click the button',
                desc: 'Your page content becomes a branded, shareable checklist',
              },
            ].map((step) => (
              <div
                key={step.icon}
                style={{
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#FF6B35',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                    flexShrink: 0,
                  }}
                >
                  {step.icon}
                </div>
                <div>
                  <p
                    style={{
                      fontWeight: 600,
                      fontSize: '15px',
                      color: '#1A1A1A',
                      marginBottom: '4px',
                    }}
                  >
                    {step.title}
                  </p>
                  <p style={{ fontSize: '14px', color: '#6B7280' }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
