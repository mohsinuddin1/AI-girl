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

CREATE POLICY "Enable read access for all users"
    ON public.app_settings FOR SELECT
    USING (true);

-- Update increment_scan_usage RPC
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
    v_free_limit INT;
    v_free_enabled BOOLEAN;
BEGIN
    -- Get global app settings
    SELECT free_daily_limit, free_scans_enabled INTO v_free_limit, v_free_enabled FROM public.app_settings LIMIT 1;
    IF v_free_limit IS NULL THEN
        v_free_limit := 1;
        v_free_enabled := true;
    END IF;

    -- Check if user is pro
    SELECT is_pro INTO v_is_pro FROM public.users WHERE id = p_user_id;

    -- SAFELY get or create usage record using ON CONFLICT to avoid Insert race conditions
    INSERT INTO public.scan_usage (user_id, daily_scans, weekly_scans, monthly_scans, last_reset_day, last_reset_week, last_reset_month)
    VALUES (p_user_id, 0, 0, 0, v_today, v_current_week_start, v_current_month_start)
    ON CONFLICT (user_id) DO NOTHING;

    -- Lock the row FOR UPDATE to avoid Update race conditions
    SELECT * INTO v_usage FROM public.scan_usage WHERE user_id = p_user_id FOR UPDATE;

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
        -- Free user rate limit check based on settings
        IF NOT v_free_enabled THEN
             RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED';
        END IF;
        IF v_usage.daily_scans >= v_free_limit THEN
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
