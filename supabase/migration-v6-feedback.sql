-- ═══════════════════════════════════════════════════════════════════
-- PureScan AI — V6 Migration: Feedbacks Table
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.feedbacks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    email TEXT,
    name TEXT,
    feedback_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.feedbacks IS 'Stores user feedback, specifically designed to intercept subscription cancellations or account deletions.';

-- Enable Row Level Security
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own feedback
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'feedbacks_insert_auth' AND tablename = 'feedbacks') THEN
    CREATE POLICY feedbacks_insert_auth ON public.feedbacks
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Allow service role (admin) to view all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'feedbacks_service_select' AND tablename = 'feedbacks') THEN
    CREATE POLICY feedbacks_service_select ON public.feedbacks
      FOR SELECT USING (auth.role() = 'service_role');
  END IF;
END $$;
