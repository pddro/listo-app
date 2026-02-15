import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { scrapeWebsiteBranding } from '@/lib/firecrawl';
import { firecrawlToTheme } from '@/lib/brandTheme';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    throw new Error('Invalid URL');
  }
}

// POST /api/embed/setup - Register a new site for embedding
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, buttonColor } = body as { url: string; buttonColor?: string };

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const domain = extractDomain(url);

    // Check if site already exists
    const { data: existing } = await supabaseServer
      .from('embed_sites')
      .select('*')
      .eq('domain', domain)
      .single();

    // Scrape branding from the site (always fetch fresh)
    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const branding = await scrapeWebsiteBranding(normalizedUrl);

    if (existing) {
      // Re-scan: update existing site with fresh branding
      const theme = branding.colors ? firecrawlToTheme(branding.colors) : existing.theme;

      const { data: updated, error: updateError } = await supabaseServer
        .from('embed_sites')
        .update({
          name: branding.name,
          favicon_url: branding.favicon_url ?? existing.favicon_url,
          logo_url: branding.logo_url ?? existing.logo_url,
          og_image_url: branding.og_image_url ?? existing.og_image_url,
          colors: branding.colors ?? existing.colors,
          theme,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('[embed/setup] Update error:', updateError);
        return NextResponse.json({ site: existing });
      }

      return NextResponse.json({ site: updated });
    }

    // Convert colors to theme
    const theme = branding.colors ? firecrawlToTheme(branding.colors) : null;

    // Generate slug from site name
    const slug = slugify(branding.name);

    // Ensure unique slug
    let finalSlug = slug;
    let attempt = 0;
    while (true) {
      const { data: slugCheck } = await supabaseServer
        .from('embed_sites')
        .select('id')
        .eq('id', finalSlug)
        .single();

      if (!slugCheck) break;
      attempt++;
      finalSlug = `${slug}-${attempt}`;
    }

    // Insert new site
    const { data: site, error: insertError } = await supabaseServer
      .from('embed_sites')
      .insert({
        id: finalSlug,
        domain,
        name: branding.name,
        favicon_url: branding.favicon_url,
        logo_url: branding.logo_url,
        og_image_url: branding.og_image_url,
        colors: branding.colors,
        theme,
        button_color: buttonColor || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[embed/setup] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to register site' },
        { status: 500 }
      );
    }

    return NextResponse.json({ site });
  } catch (error) {
    console.error('[embed/setup] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
