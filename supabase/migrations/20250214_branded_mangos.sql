-- Branded Mangos: Embeddable List Generator
-- Migration: Create embed_sites table, add source tracking to lists

-- Create embed_sites table
CREATE TABLE IF NOT EXISTS embed_sites (
  id TEXT PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  favicon_url TEXT,
  logo_url TEXT,
  og_image_url TEXT,
  colors JSONB,
  theme JSONB,
  button_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add source tracking columns to lists table
ALTER TABLE lists ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS source_site_id TEXT REFERENCES embed_sites(id);

-- Index for fast template lookup by source_url
CREATE INDEX IF NOT EXISTS idx_lists_source_url ON lists(source_url) WHERE source_url IS NOT NULL AND is_template = true;

-- Index for embed_sites domain lookup
CREATE INDEX IF NOT EXISTS idx_embed_sites_domain ON embed_sites(domain);

-- Enable RLS on embed_sites
ALTER TABLE embed_sites ENABLE ROW LEVEL SECURITY;

-- Allow public read access to embed_sites
CREATE POLICY "embed_sites_public_read" ON embed_sites
  FOR SELECT USING (true);

-- Allow public insert (site registration)
CREATE POLICY "embed_sites_public_insert" ON embed_sites
  FOR INSERT WITH CHECK (true);

-- Allow public update (for refreshing branding)
CREATE POLICY "embed_sites_public_update" ON embed_sites
  FOR UPDATE USING (true);
