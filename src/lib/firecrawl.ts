import { FirecrawlColors } from '@/types';

interface FirecrawlBranding {
  logo?: string;
  colorScheme?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: {
      primary?: string;
      secondary?: string;
    };
  };
  images?: {
    logo?: string;
    favicon?: string;
    ogImage?: string;
  };
}

interface FirecrawlResponse {
  success: boolean;
  data?: {
    metadata?: {
      title?: string;
      description?: string;
      ogImage?: string;
    };
    branding?: FirecrawlBranding;
  };
}

export interface SiteBranding {
  name: string;
  favicon_url: string | null;
  logo_url: string | null;
  og_image_url: string | null;
  colors: FirecrawlColors | null;
}

export async function scrapeWebsiteBranding(url: string): Promise<SiteBranding> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is not configured');
  }

  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['branding'],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Firecrawl] API error:', response.status, errorText);
    throw new Error(`Firecrawl API error: ${response.status}`);
  }

  const result: FirecrawlResponse = await response.json();

  if (!result.success || !result.data) {
    throw new Error('Firecrawl returned unsuccessful response');
  }

  const { metadata, branding } = result.data;

  const colors: FirecrawlColors | null = branding?.colors
    ? {
        primary: branding.colors.primary || '#FF6B35',
        secondary: branding.colors.secondary || '#4A4A4A',
        accent: branding.colors.accent || '#FF6B35',
        background: branding.colors.background || '#FFFFFF',
        textPrimary: branding.colors.text?.primary || '#1A1A1A',
        textSecondary: branding.colors.text?.secondary || '#6B7280',
      }
    : null;

  // Helper: only keep URLs, skip inline SVG data or vector markup
  const isUsableUrl = (val?: string) =>
    val && val.startsWith('http') ? val : null;

  const favicon = isUsableUrl(branding?.images?.favicon);
  const logo =
    isUsableUrl(branding?.images?.logo) || isUsableUrl(branding?.logo);
  const ogImage =
    isUsableUrl(branding?.images?.ogImage) || isUsableUrl(metadata?.ogImage);

  return {
    name: metadata?.title || new URL(url).hostname,
    favicon_url: favicon,
    logo_url: logo,
    og_image_url: ogImage,
    colors,
  };
}
