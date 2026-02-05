-- Backup Codes Feature Migration
-- Enables server-side storage for quick transfer codes
-- Run this in Supabase SQL Editor

-- Create backup_codes table
CREATE TABLE IF NOT EXISTS backup_codes (
  code TEXT PRIMARY KEY,           -- e.g., "MANGO-7X2K"
  data JSONB NOT NULL,             -- { version, createdAt, lists, templates }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- 24 hours from creation
  redeemed_at TIMESTAMPTZ          -- NULL until used (tracks usage, not one-time)
);

-- Index for cleanup job (find expired codes)
CREATE INDEX IF NOT EXISTS idx_backup_codes_expires ON backup_codes(expires_at);

-- Function to clean up expired codes (can be called by cron or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_backup_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM backup_codes
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE backup_codes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (create backup codes)
CREATE POLICY "Anyone can create backup codes"
  ON backup_codes FOR INSERT
  WITH CHECK (true);

-- Allow anyone to read non-expired codes
CREATE POLICY "Anyone can read valid backup codes"
  ON backup_codes FOR SELECT
  USING (expires_at > NOW());

-- Allow updating redeemed_at
CREATE POLICY "Anyone can update redeemed_at"
  ON backup_codes FOR UPDATE
  USING (expires_at > NOW())
  WITH CHECK (true);
