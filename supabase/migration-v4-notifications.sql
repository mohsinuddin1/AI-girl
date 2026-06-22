-- ═══════════════════════════════════════════════════════════════════
-- PureScan AI — V4 Migration: Push Notifications System
-- ═══════════════════════════════════════════════════════════════════
--
-- PREREQUISITES (already run):
--   ✅ supabase-setup.sql       → users, scans, storage bucket
--   ✅ supabase-setup-v2.sql    → scan_state ENUM, scan_logs, scans extras
--   ✅ migration-v3-accuracy.sql→ health_preferences, summary, macros
--
-- THIS MIGRATION ADDS:
--   • users.notification_preferences → per-user notification settings
--   • push_tokens table              → stores Expo push tokens per device
--   • admin_notifications table      → admin-created push notifications
--   • RLS policies for all new tables
--
-- Run in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- Safe to re-run (all statements use IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────
-- 1. users.notification_preferences (JSONB)
-- ─────────────────────────────────────────────────────
-- WHO WRITES: App (NotificationsScreen toggles)
-- WHO READS:  App on load, admin dashboard for segmentation
-- STRUCTURE:  { "daily_reminder": true, "streak_saver": true, "new_features": false, "push_enabled": true }
-- SIZE:       ~100 bytes per user
--
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"daily_reminder": true, "streak_saver": true, "new_features": false, "push_enabled": false}'::jsonb;

COMMENT ON COLUMN users.notification_preferences
  IS 'Per-user notification settings: { daily_reminder, streak_saver, new_features, push_enabled }';


-- ─────────────────────────────────────────────────────
-- 2. push_tokens table
-- ─────────────────────────────────────────────────────
-- Stores Expo push tokens per user per device.
-- Used by the admin to send targeted push notifications.
-- A user can have multiple tokens (multiple devices).
--
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expo_push_token TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'unknown',  -- 'ios', 'android'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Each user+token combination is unique
    UNIQUE(user_id, expo_push_token)
);

COMMENT ON TABLE push_tokens
  IS 'Expo push tokens for sending admin-triggered push notifications to users.';

-- Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id
  ON push_tokens(user_id);

-- Index for querying active tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_active
  ON push_tokens(is_active)
  WHERE is_active = true;


-- ─────────────────────────────────────────────────────
-- 3. admin_notifications table
-- ─────────────────────────────────────────────────────
-- Admin creates notification campaigns here.
-- A Supabase Edge Function or cron job reads this table 
-- and sends push notifications via Expo Push API.
--
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',              -- Extra payload data (e.g., deeplink, type)
    target_audience TEXT DEFAULT 'all',    -- 'all', 'pro', 'free', 'specific_users'
    target_user_ids UUID[] DEFAULT '{}',  -- Used when target_audience = 'specific_users'
    status TEXT DEFAULT 'draft',          -- 'draft', 'scheduled', 'sending', 'sent', 'failed'
    scheduled_at TIMESTAMPTZ,             -- When to send (NULL = send immediately)
    sent_at TIMESTAMPTZ,                  -- When actually sent
    total_recipients INT DEFAULT 0,
    successful_sends INT DEFAULT 0,
    failed_sends INT DEFAULT 0,
    created_by TEXT,                       -- Admin email or identifier
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE admin_notifications
  IS 'Admin-created push notification campaigns. Edge function reads scheduled/pending rows and dispatches via Expo Push API.';

-- Index for finding pending notifications to send
CREATE INDEX IF NOT EXISTS idx_admin_notifications_status
  ON admin_notifications(status)
  WHERE status IN ('scheduled', 'sending');


-- ─────────────────────────────────────────────────────
-- 4. RLS Policies — push_tokens
-- ─────────────────────────────────────────────────────
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can insert/update their own push tokens
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'push_tokens_insert_own' AND tablename = 'push_tokens') THEN
    CREATE POLICY push_tokens_insert_own ON push_tokens
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'push_tokens_update_own' AND tablename = 'push_tokens') THEN
    CREATE POLICY push_tokens_update_own ON push_tokens
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'push_tokens_select_own' AND tablename = 'push_tokens') THEN
    CREATE POLICY push_tokens_select_own ON push_tokens
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Service role can read all tokens (for sending notifications)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'push_tokens_service_select' AND tablename = 'push_tokens') THEN
    CREATE POLICY push_tokens_service_select ON push_tokens
      FOR SELECT USING (auth.role() = 'service_role');
  END IF;
END $$;


-- ─────────────────────────────────────────────────────
-- 5. RLS Policies — admin_notifications
-- ─────────────────────────────────────────────────────
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only service role (admin/edge function) can read/write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_notif_service_all' AND tablename = 'admin_notifications') THEN
    CREATE POLICY admin_notif_service_all ON admin_notifications
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (optional)
-- ═══════════════════════════════════════════════════════════════════

-- Check new column on users:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'users' AND column_name = 'notification_preferences';

-- Check push_tokens table:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'push_tokens' ORDER BY ordinal_position;

-- Check admin_notifications table:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'admin_notifications' ORDER BY ordinal_position;

-- Check RLS policies:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('push_tokens', 'admin_notifications');
