-- Create status_submissions table for kingdom transfer status updates
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Create the status_submissions table
CREATE TABLE IF NOT EXISTS status_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kingdom_number INTEGER NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  notes TEXT,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE status_submissions ENABLE ROW LEVEL SECURITY;

-- 3. Create policies
-- Anyone can view approved submissions
CREATE POLICY "Anyone can view approved submissions" 
  ON status_submissions FOR SELECT 
  USING (status = 'approved');

-- Authenticated users can view their own submissions
CREATE POLICY "Users can view own submissions" 
  ON status_submissions FOR SELECT 
  USING (auth.uid() = submitted_by);

-- Admins can view all submissions (check profiles.is_admin)
CREATE POLICY "Admins can view all submissions" 
  ON status_submissions FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- Authenticated users can insert submissions
CREATE POLICY "Authenticated users can submit" 
  ON status_submissions FOR INSERT 
  WITH CHECK (auth.uid() = submitted_by);

-- Admins can update submissions (for review)
CREATE POLICY "Admins can update submissions" 
  ON status_submissions FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
    )
  );

-- 4. Create indexes
CREATE INDEX idx_status_submissions_kingdom ON status_submissions(kingdom_number);
CREATE INDEX idx_status_submissions_status ON status_submissions(status);
CREATE INDEX idx_status_submissions_submitted_by ON status_submissions(submitted_by);
CREATE INDEX idx_status_submissions_submitted_at ON status_submissions(submitted_at DESC);

-- 5. Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- 6. Verify table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'status_submissions' 
ORDER BY ordinal_position;
