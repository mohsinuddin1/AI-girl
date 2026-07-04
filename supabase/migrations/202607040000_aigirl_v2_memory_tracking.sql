-- Track condensation timing
ALTER TABLE public.aigirl_users 
  ADD COLUMN IF NOT EXISTS long_term_facts_updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.aigirl_users 
  ADD COLUMN IF NOT EXISTS message_count_since_condense INT DEFAULT 0;

-- Add use_gemini_chats to app_settings if missing
ALTER TABLE public.aigirl_app_settings 
  ADD COLUMN IF NOT EXISTS use_gemini_chats BOOLEAN DEFAULT true;

-- Create RPC to increment message count
CREATE OR REPLACE FUNCTION public.increment_message_count(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.aigirl_users 
    SET message_count_since_condense = COALESCE(message_count_since_condense, 0) + 1 
    WHERE id = p_user_id;
END;
$$;
