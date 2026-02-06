-- Android tester email collection for Google Play closed testing
CREATE TABLE IF NOT EXISTS android_testers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE android_testers ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (email signup from web)
CREATE POLICY "Anyone can sign up as android tester"
  ON android_testers FOR INSERT
  WITH CHECK (true);

-- Allow counting for social proof
CREATE POLICY "Anyone can count android testers"
  ON android_testers FOR SELECT
  USING (true);
