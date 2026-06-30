-- 0. Create aigirl_users table if not exists (Prerequisite mirror table for auth.users)
CREATE TABLE IF NOT EXISTS public.aigirl_users (
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

-- Enable RLS and add basic policies for public.aigirl_users
ALTER TABLE public.aigirl_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.aigirl_users;
CREATE POLICY "Users can view own profile"
    ON public.aigirl_users FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.aigirl_users;
CREATE POLICY "Users can update own profile"
    ON public.aigirl_users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.aigirl_users;
CREATE POLICY "Users can insert own profile"
    ON public.aigirl_users FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Create aigirl_app_settings table if not exists
CREATE TABLE IF NOT EXISTS public.aigirl_app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    free_daily_limit INT NOT NULL DEFAULT 1,
    free_scans_enabled BOOLEAN NOT NULL DEFAULT true,
    free_chat_limit INT DEFAULT 5,
    pro_chat_limit INT DEFAULT 100,
    use_gemini BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert default row if empty
INSERT INTO public.aigirl_app_settings (free_daily_limit, free_scans_enabled, free_chat_limit, pro_chat_limit, use_gemini)
SELECT 1, true, 5, 100, true
WHERE NOT EXISTS (SELECT 1 FROM public.aigirl_app_settings);

-- Set permissions
ALTER TABLE public.aigirl_app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.aigirl_app_settings;
CREATE POLICY "Enable read access for all users"
    ON public.aigirl_app_settings FOR SELECT
    USING (true);

-- 2. Create raw aigirl_chat_messages table
CREATE TABLE IF NOT EXISTS public.aigirl_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.aigirl_users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    is_image BOOLEAN DEFAULT FALSE,
    image_uri TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extremely important for chat load speed
CREATE INDEX IF NOT EXISTS idx_aigirl_chat_msgs_user_id ON public.aigirl_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_aigirl_chat_msgs_created_at ON public.aigirl_chat_messages(created_at DESC);

ALTER TABLE public.aigirl_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chat_messages" ON public.aigirl_chat_messages;
CREATE POLICY "Users can view own chat_messages"
    ON public.aigirl_chat_messages FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chat_messages" ON public.aigirl_chat_messages;
CREATE POLICY "Users can insert own chat_messages"
    ON public.aigirl_chat_messages FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat_messages" ON public.aigirl_chat_messages;
CREATE POLICY "Users can delete own chat_messages"
    ON public.aigirl_chat_messages FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);


-- 4. Create aigirl_chat_usage table
CREATE TABLE IF NOT EXISTS public.aigirl_chat_usage (
    user_id UUID PRIMARY KEY REFERENCES public.aigirl_users(id) ON DELETE CASCADE,
    daily_msgs INT DEFAULT 0,
    weekly_msgs INT DEFAULT 0,
    monthly_msgs INT DEFAULT 0,
    last_reset_day DATE DEFAULT CURRENT_DATE,
    last_reset_week DATE DEFAULT CURRENT_DATE,
    last_reset_month DATE DEFAULT CURRENT_DATE
);

ALTER TABLE public.aigirl_chat_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chat_usage" ON public.aigirl_chat_usage;
CREATE POLICY "Users can view own chat_usage"
    ON public.aigirl_chat_usage FOR SELECT 
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chat_usage" ON public.aigirl_chat_usage;
CREATE POLICY "Users can insert own chat_usage"
    ON public.aigirl_chat_usage FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chat_usage" ON public.aigirl_chat_usage;
CREATE POLICY "Users can update own chat_usage"
    ON public.aigirl_chat_usage FOR UPDATE 
    TO authenticated
    USING (auth.uid() = user_id);


-- 5. Create increment_aigirl_chat_usage RPC
CREATE OR REPLACE FUNCTION public.increment_aigirl_chat_usage(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usage public.aigirl_chat_usage%ROWTYPE;
    v_is_pro BOOLEAN;
    v_today DATE := CURRENT_DATE;
    v_current_week_start DATE := date_trunc('week', CURRENT_DATE)::DATE;
    v_current_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
    v_free_limit INT;
    v_pro_limit INT;
    v_res json;
BEGIN
    -- Check if user is pro
    SELECT is_pro INTO v_is_pro FROM public.aigirl_users WHERE id = p_user_id;

    -- Fetch dynamic limits from app_settings
    SELECT free_chat_limit, pro_chat_limit INTO v_free_limit, v_pro_limit FROM public.aigirl_app_settings LIMIT 1;
    IF v_free_limit IS NULL THEN v_free_limit := 5; END IF;
    IF v_pro_limit IS NULL THEN v_pro_limit := 100; END IF;

    -- Get or create usage record
    SELECT * INTO v_usage FROM public.aigirl_chat_usage WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO public.aigirl_chat_usage (user_id, daily_msgs, weekly_msgs, monthly_msgs, last_reset_day, last_reset_week, last_reset_month)
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
    UPDATE public.aigirl_chat_usage
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


-- 6. Feedback
CREATE TABLE IF NOT EXISTS public.aigirl_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.aigirl_users(id) ON DELETE SET NULL,
    email TEXT,
    name TEXT,
    feedback_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for feedbacks
CREATE INDEX IF NOT EXISTS idx_aigirl_feedback_user_id ON public.aigirl_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_aigirl_feedback_created_at ON public.aigirl_feedback(created_at);

ALTER TABLE public.aigirl_feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'feedbacks_insert_auth' AND tablename = 'aigirl_feedback') THEN
    CREATE POLICY feedbacks_insert_auth ON public.aigirl_feedback
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'feedbacks_service_select' AND tablename = 'aigirl_feedback') THEN
    CREATE POLICY feedbacks_service_select ON public.aigirl_feedback
      FOR SELECT USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 7. Create aigirl_scan_usage table
CREATE TABLE IF NOT EXISTS public.aigirl_scan_usage (
    user_id UUID PRIMARY KEY REFERENCES public.aigirl_users(id) ON DELETE CASCADE,
    daily_scans INT DEFAULT 0,
    weekly_scans INT DEFAULT 0,
    monthly_scans INT DEFAULT 0,
    last_reset_day DATE DEFAULT CURRENT_DATE,
    last_reset_week DATE DEFAULT CURRENT_DATE,
    last_reset_month DATE DEFAULT CURRENT_DATE
);

ALTER TABLE public.aigirl_scan_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scan usage"
    ON public.aigirl_scan_usage FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own scan usage"
    ON public.aigirl_scan_usage FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scan usage"
    ON public.aigirl_scan_usage FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 8. Create get_aigirl_scan_usage
CREATE OR REPLACE FUNCTION public.get_aigirl_scan_usage(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usage public.aigirl_scan_usage%ROWTYPE;
    v_today DATE := CURRENT_DATE;
    v_current_week_start DATE := date_trunc('week', CURRENT_DATE)::DATE;
    v_current_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
    v_res json;
BEGIN
    SELECT * INTO v_usage FROM public.aigirl_scan_usage WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO public.aigirl_scan_usage (user_id, daily_scans, weekly_scans, monthly_scans, last_reset_day, last_reset_week, last_reset_month)
        VALUES (p_user_id, 0, 0, 0, v_today, v_current_week_start, v_current_month_start)
        RETURNING * INTO v_usage;
    END IF;

    -- Reset daily if needed
    IF v_usage.last_reset_day < v_today THEN
        v_usage.daily_scans := 0;
        v_usage.last_reset_day := v_today;
    END IF;

    -- Reset weekly if needed
    IF v_usage.last_reset_week < v_current_week_start THEN
        v_usage.weekly_scans := 0;
        v_usage.last_reset_week := v_current_week_start;
    END IF;

    -- Reset monthly if needed
    IF v_usage.last_reset_month < v_current_month_start THEN
        v_usage.monthly_scans := 0;
        v_usage.last_reset_month := v_current_month_start;
    END IF;

    -- Update table if resets happened
    UPDATE public.aigirl_scan_usage
    SET daily_scans = v_usage.daily_scans,
        weekly_scans = v_usage.weekly_scans,
        monthly_scans = v_usage.monthly_scans,
        last_reset_day = v_usage.last_reset_day,
        last_reset_week = v_usage.last_reset_week,
        last_reset_month = v_usage.last_reset_month
    WHERE user_id = p_user_id;

    v_res := row_to_json(v_usage);
    RETURN v_res;
END;
$$;

-- 9. Create increment_aigirl_scan_usage
CREATE OR REPLACE FUNCTION public.increment_aigirl_scan_usage(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usage public.aigirl_scan_usage%ROWTYPE;
    v_is_pro BOOLEAN;
    v_today DATE := CURRENT_DATE;
    v_current_week_start DATE := date_trunc('week', CURRENT_DATE)::DATE;
    v_current_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
    v_res json;
BEGIN
    -- Check if user is pro
    SELECT is_pro INTO v_is_pro FROM public.aigirl_users WHERE id = p_user_id;

    -- Get or create usage record
    SELECT * INTO v_usage FROM public.aigirl_scan_usage WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO public.aigirl_scan_usage (user_id, daily_scans, weekly_scans, monthly_scans, last_reset_day, last_reset_week, last_reset_month)
        VALUES (p_user_id, 0, 0, 0, v_today, v_current_week_start, v_current_month_start)
        RETURNING * INTO v_usage;
    END IF;

    -- Reset daily if needed
    IF v_usage.last_reset_day < v_today THEN
        v_usage.daily_scans := 0;
        v_usage.last_reset_day := v_today;
    END IF;

    -- Reset weekly if needed
    IF v_usage.last_reset_week < v_current_week_start THEN
        v_usage.weekly_scans := 0;
        v_usage.last_reset_week := v_current_week_start;
    END IF;

    -- Reset monthly if needed
    IF v_usage.last_reset_month < v_current_month_start THEN
        v_usage.monthly_scans := 0;
        v_usage.last_reset_month := v_current_month_start;
    END IF;

    -- Check rate limits before incrementing
    IF v_is_pro THEN
        IF v_usage.daily_scans >= 40 OR v_usage.weekly_scans >= 150 OR v_usage.monthly_scans >= 520 THEN
            RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED';
        END IF;
    ELSE
        -- Free user rate limit: 1 scan per day
        IF v_usage.daily_scans >= 1 THEN
            RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED';
        END IF;
    END IF;

    -- Increment
    v_usage.daily_scans := v_usage.daily_scans + 1;
    v_usage.weekly_scans := v_usage.weekly_scans + 1;
    v_usage.monthly_scans := v_usage.monthly_scans + 1;

    -- Update table
    UPDATE public.aigirl_scan_usage
    SET daily_scans = v_usage.daily_scans,
        weekly_scans = v_usage.weekly_scans,
        monthly_scans = v_usage.monthly_scans,
        last_reset_day = v_usage.last_reset_day,
        last_reset_week = v_usage.last_reset_week,
        last_reset_month = v_usage.last_reset_month
    WHERE user_id = p_user_id;

    -- Also update the legacy daily_scans parameter inside the users table to avoid breaking legacy code relying on it
    UPDATE public.aigirl_users 
    SET daily_scans = v_usage.daily_scans, 
        last_scan_date = v_usage.last_reset_day
    WHERE id = p_user_id;

    v_res := row_to_json(v_usage);
    RETURN v_res;
END;
$$;

-- 10. Create aigirl_delete_user_account
CREATE OR REPLACE FUNCTION public.aigirl_delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only allow users to delete their own account
    DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
