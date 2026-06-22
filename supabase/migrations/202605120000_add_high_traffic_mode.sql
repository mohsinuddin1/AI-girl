ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS high_traffic_mode BOOLEAN NOT NULL DEFAULT false;
