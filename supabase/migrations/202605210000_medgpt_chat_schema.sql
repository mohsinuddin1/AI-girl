-- 0. Create users table if not exists (Prerequisite mirror table for auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    is_pro BOOLEAN DEFAULT FALSE,
    stripe_customer_id TEXT,
    daily_scans INT DEFAULT 0,
    last_scan_date DATE DEFAULT CURRENT_DATE,
    current_streak INT DEFAULT 0,
    level_xp INT DEFAULT 0,
    health_preferences JSONB DEFAULT NULL,
    notification_preferences JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and add basic policies for public.users if they don't exist
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
    ON public.users FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Create app_settings table if not exists
CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    free_daily_limit INT NOT NULL DEFAULT 1,
    free_scans_enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert default row if empty
INSERT INTO public.app_settings (free_daily_limit, free_scans_enabled)
SELECT 1, true
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);

-- Set permissions
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.app_settings;
CREATE POLICY "Enable read access for all users"
    ON public.app_settings FOR SELECT
    USING (true);

-- 1. Create Storage Bucket for Scans (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('scans', 'scans', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'scans' bucket
DROP POLICY IF EXISTS "Public Read Scans" ON storage.objects;
CREATE POLICY "Public Read Scans"
ON storage.objects FOR SELECT
USING (bucket_id = 'scans');

DROP POLICY IF EXISTS "Users can upload their own scans" ON storage.objects;
CREATE POLICY "Users can upload their own scans"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'scans' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 2. Create raw chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    is_image BOOLEAN DEFAULT FALSE,
    image_uri TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chat_messages" ON public.chat_messages;
CREATE POLICY "Users can view own chat_messages"
    ON public.chat_messages FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chat_messages" ON public.chat_messages;
CREATE POLICY "Users can insert own chat_messages"
    ON public.chat_messages FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat_messages" ON public.chat_messages;
CREATE POLICY "Users can delete own chat_messages"
    ON public.chat_messages FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 3. Update app_settings for dynamic rate limiting and AI provider
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS free_chat_limit INT DEFAULT 5;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS pro_chat_limit INT DEFAULT 100;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS use_gemini BOOLEAN DEFAULT true;

-- 4. Create chat_usage table
CREATE TABLE IF NOT EXISTS public.chat_usage (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    daily_msgs INT DEFAULT 0,
    weekly_msgs INT DEFAULT 0,
    monthly_msgs INT DEFAULT 0,
    last_reset_day DATE DEFAULT CURRENT_DATE,
    last_reset_week DATE DEFAULT CURRENT_DATE,
    last_reset_month DATE DEFAULT CURRENT_DATE
);

ALTER TABLE public.chat_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chat_usage" ON public.chat_usage;
CREATE POLICY "Users can view own chat_usage"
    ON public.chat_usage FOR SELECT 
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chat_usage" ON public.chat_usage;
CREATE POLICY "Users can insert own chat_usage"
    ON public.chat_usage FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chat_usage" ON public.chat_usage;
CREATE POLICY "Users can update own chat_usage"
    ON public.chat_usage FOR UPDATE 
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. Create increment_chat_usage RPC
CREATE OR REPLACE FUNCTION public.increment_chat_usage(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usage public.chat_usage%ROWTYPE;
    v_is_pro BOOLEAN;
    v_today DATE := CURRENT_DATE;
    v_current_week_start DATE := date_trunc('week', CURRENT_DATE)::DATE;
    v_current_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
    v_free_limit INT;
    v_pro_limit INT;
    v_res json;
BEGIN
    -- Check if user is pro
    SELECT is_pro INTO v_is_pro FROM public.users WHERE id = p_user_id;

    -- Fetch dynamic limits from app_settings
    SELECT free_chat_limit, pro_chat_limit INTO v_free_limit, v_pro_limit FROM public.app_settings LIMIT 1;
    IF v_free_limit IS NULL THEN v_free_limit := 5; END IF;
    IF v_pro_limit IS NULL THEN v_pro_limit := 100; END IF;

    -- Get or create usage record
    SELECT * INTO v_usage FROM public.chat_usage WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO public.chat_usage (user_id, daily_msgs, weekly_msgs, monthly_msgs, last_reset_day, last_reset_week, last_reset_month)
        VALUES (p_user_id, 0, 0, 0, v_today, v_current_week_start, v_current_month_start)
        RETURNING * INTO v_usage;
    END IF;

    -- Reset daily if needed
    IF v_usage.last_reset_day < v_today THEN
        v_usage.daily_msgs := 0;
        v_usage.last_reset_day := v_today;
    END IF;

    -- Reset weekly if needed
    IF v_usage.last_reset_week < v_current_week_start THEN
        v_usage.weekly_msgs := 0;
        v_usage.last_reset_week := v_current_week_start;
    END IF;

    -- Reset monthly if needed
    IF v_usage.last_reset_month < v_current_month_start THEN
        v_usage.monthly_msgs := 0;
        v_usage.last_reset_month := v_current_month_start;
    END IF;

    -- Check rate limits before incrementing
    IF v_is_pro THEN
        IF v_usage.daily_msgs >= v_pro_limit THEN
            RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED';
        END IF;
    ELSE
        IF v_usage.daily_msgs >= v_free_limit THEN
            RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED';
        END IF;
    END IF;

    -- Increment
    v_usage.daily_msgs := v_usage.daily_msgs + 1;
    v_usage.weekly_msgs := v_usage.weekly_msgs + 1;
    v_usage.monthly_msgs := v_usage.monthly_msgs + 1;

    -- Update table
    UPDATE public.chat_usage
    SET daily_msgs = v_usage.daily_msgs,
        weekly_msgs = v_usage.weekly_msgs,
        monthly_msgs = v_usage.monthly_msgs,
        last_reset_day = v_usage.last_reset_day,
        last_reset_week = v_usage.last_reset_week,
        last_reset_month = v_usage.last_reset_month
    WHERE user_id = p_user_id;

    v_res := row_to_json(v_usage);
    RETURN v_res;
END;
$$;
