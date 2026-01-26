-- Templates Feature Migration
-- Extends the lists table to support templates
-- Run this in Supabase SQL Editor

-- Add template columns to lists table
ALTER TABLE lists ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS template_description TEXT;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS template_category TEXT;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE lists ADD COLUMN IF NOT EXISTS translation_group_id TEXT;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS use_count INTEGER DEFAULT 0;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT false;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Indexes for template queries
CREATE INDEX IF NOT EXISTS idx_lists_template ON lists(is_template) WHERE is_template = true;
CREATE INDEX IF NOT EXISTS idx_lists_template_status ON lists(status) WHERE is_template = true;
CREATE INDEX IF NOT EXISTS idx_lists_template_category ON lists(template_category, language) WHERE is_template = true AND status = 'approved';
CREATE INDEX IF NOT EXISTS idx_lists_translation_group ON lists(translation_group_id) WHERE translation_group_id IS NOT NULL;

-- Function to increment use_count atomically
CREATE OR REPLACE FUNCTION increment_template_use_count(template_id_param TEXT)
RETURNS void AS $$
BEGIN
  UPDATE lists
  SET use_count = use_count + 1,
      updated_at = NOW()
  WHERE id = template_id_param;
END;
$$ LANGUAGE plpgsql;
