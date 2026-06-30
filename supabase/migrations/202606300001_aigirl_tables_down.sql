-- Drop Functions
DROP FUNCTION IF EXISTS public.get_aigirl_scan_usage(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.increment_aigirl_scan_usage(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.increment_aigirl_chat_usage(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.aigirl_delete_user_account() CASCADE;

-- Drop Tables (CASCADE automatically removes associated policies and indexes)
DROP TABLE IF EXISTS public.aigirl_scan_usage CASCADE;
DROP TABLE IF EXISTS public.aigirl_feedback CASCADE;
DROP TABLE IF EXISTS public.aigirl_chat_usage CASCADE;
DROP TABLE IF EXISTS public.aigirl_chat_messages CASCADE;
DROP TABLE IF EXISTS public.aigirl_app_settings CASCADE;
DROP TABLE IF EXISTS public.aigirl_users CASCADE;
