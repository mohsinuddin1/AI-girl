-- ═══════════════════════════════════════════════════════════
-- MedGPT: Storage Bucket + Medical Reports Table + Cron Job
-- Run this in Supabase Dashboard → SQL Editor
-- Project: iiqwcbgtqpnixvavvdwn (MedGPT)
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- 1. Create private storage bucket for medical uploads
-- ───────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-uploads',
  'medical-uploads',
  false,
  10485760,  -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Authenticated users can upload to their own folder
CREATE POLICY "Users can upload own medical files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'medical-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: Users can read their own files
CREATE POLICY "Users can read own medical files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'medical-uploads'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


-- ───────────────────────────────────────────────────────────
-- 2. Create medical_reports table
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Medical Report',
  report_type TEXT NOT NULL DEFAULT 'document',
  summary TEXT NOT NULL DEFAULT '',
  key_findings JSONB DEFAULT '[]'::jsonb,
  conditions_discussed JSONB DEFAULT '[]'::jsonb,
  recommended_followups JSONB DEFAULT '[]'::jsonb,
  file_storage_path TEXT,           -- path in medical-uploads bucket (nulled after 10-day cleanup)
  file_mime_type TEXT,
  file_name TEXT,                   -- original filename from picker
  raw_analysis JSONB,               -- full Gemini response for future reference
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_medical_reports_user_id ON medical_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_medical_reports_created_at ON medical_reports(created_at DESC);

-- Enable RLS
ALTER TABLE medical_reports ENABLE ROW LEVEL SECURITY;

-- Users can read their own reports
CREATE POLICY "Users can read own reports"
ON medical_reports FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own reports (for edge function via user's auth token)
CREATE POLICY "Users can insert own reports"
ON medical_reports FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Service role can also insert (edge function uses service role key)
-- Note: Service role bypasses RLS by default, so no policy needed for it.

-- Users can update their own reports (rename, edit)
CREATE POLICY "Users can update own reports"
ON medical_reports FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own reports
CREATE POLICY "Users can delete own reports"
ON medical_reports FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_medical_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER medical_reports_updated_at
  BEFORE UPDATE ON medical_reports
  FOR EACH ROW EXECUTE FUNCTION update_medical_reports_updated_at();


-- ───────────────────────────────────────────────────────────
-- 3. Cron job: Clean up uploaded files after 10 days
--    (Only deletes raw files, NOT the report text/analysis)
-- ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'cleanup-medical-uploads-10days',
  '0 3 * * *',  -- Runs daily at 3:00 AM UTC
  $$
    -- Step 1: Null out storage paths in reports older than 10 days
    UPDATE medical_reports
    SET file_storage_path = NULL
    WHERE file_storage_path IS NOT NULL
      AND created_at < now() - interval '10 days';

    -- Step 2: Delete actual storage objects older than 10 days
    DELETE FROM storage.objects
    WHERE bucket_id = 'medical-uploads'
      AND created_at < now() - interval '10 days';
  $$
);
