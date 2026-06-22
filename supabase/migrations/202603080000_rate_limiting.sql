-- Create scan_usage table
CREATE TABLE IF NOT EXISTS public.scan_usage (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    daily_scans INT DEFAULT 0,
    weekly_scans INT DEFAULT 0,
    monthly_scans INT DEFAULT 0,
    last_reset_day DATE DEFAULT CURRENT_DATE,
    last_reset_week DATE DEFAULT CURRENT_DATE,
    last_reset_month DATE DEFAULT CURRENT_DATE
);

ALTER TABLE public.scan_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scan usage"
    ON public.scan_usage FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own scan usage"
    ON public.scan_usage FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scan usage"
    ON public.scan_usage FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create function to get current scan usage safely initializing if missing
CREATE OR REPLACE FUNCTION public.get_scan_usage(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usage public.scan_usage%ROWTYPE;
    v_today DATE := CURRENT_DATE;
    v_current_week_start DATE := date_trunc('week', CURRENT_DATE)::DATE;
    v_current_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
    v_res json;
BEGIN
    SELECT * INTO v_usage FROM public.scan_usage WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO public.scan_usage (user_id, daily_scans, weekly_scans, monthly_scans, last_reset_day, last_reset_week, last_reset_month)
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
    UPDATE public.scan_usage
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


-- Create function to increment and return scan usage
CREATE OR REPLACE FUNCTION public.increment_scan_usage(p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usage public.scan_usage%ROWTYPE;
    v_is_pro BOOLEAN;
    v_today DATE := CURRENT_DATE;
    v_current_week_start DATE := date_trunc('week', CURRENT_DATE)::DATE;
    v_current_month_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
    v_res json;
BEGIN
    -- Check if user is pro
    SELECT is_pro INTO v_is_pro FROM public.users WHERE id = p_user_id;

    -- Get or create usage record
    SELECT * INTO v_usage FROM public.scan_usage WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        INSERT INTO public.scan_usage (user_id, daily_scans, weekly_scans, monthly_scans, last_reset_day, last_reset_week, last_reset_month)
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
    UPDATE public.scan_usage
    SET daily_scans = v_usage.daily_scans,
        weekly_scans = v_usage.weekly_scans,
        monthly_scans = v_usage.monthly_scans,
        last_reset_day = v_usage.last_reset_day,
        last_reset_week = v_usage.last_reset_week,
        last_reset_month = v_usage.last_reset_month
    WHERE user_id = p_user_id;

    -- Also update the legacy daily_scans parameter inside the users table to avoid breaking legacy code relying on it
    UPDATE public.users 
    SET daily_scans = v_usage.daily_scans, 
        last_scan_date = v_usage.last_reset_day
    WHERE id = p_user_id;

    v_res := row_to_json(v_usage);
    RETURN v_res;
END;
$$;
