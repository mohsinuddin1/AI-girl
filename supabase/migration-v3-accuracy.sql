-- ═══════════════════════════════════════════════════════════════════
-- PureScan AI — V3 Migration: Accuracy & Personalization Update
-- ═══════════════════════════════════════════════════════════════════
--
-- PREREQUISITES (already run):
--   ✅ supabase-setup.sql    → users, scans, storage bucket
--   ✅ supabase-setup-v2.sql → scan_state ENUM, scan_logs, scans extras
--
-- THIS MIGRATION ADDS:
--   • users.health_preferences  → personalized AI prompts
--   • scans.summary             → AI analysis summary text
--   • scans.macros              → nutrition data (calories, protein, etc.)
--   • scans.product_image_url   → product image from barcode API
--   • scans.product_type        → 'food' or 'cosmetic'
--
-- Run in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- Safe to re-run (all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────
-- 1. users.health_preferences  (JSONB)
-- ─────────────────────────────────────────────────────
-- WHO WRITES:  useStore.setHealthPreferences() on onboarding completion
-- WHO READS:   analyze-scan & scan-barcode edge functions (fetchUserHealthProfile)
-- STRUCTURE:   { "diseases": ["PCOS", "Eczema"], "allergies": ["Parabens"], "goals": ["skin"] }
-- SIZE:        ~200–500 bytes per user (tiny — JSON text of short string arrays)
--
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS health_preferences JSONB DEFAULT NULL;

COMMENT ON COLUMN users.health_preferences
  IS 'Onboarding data: { diseases: string[], allergies: string[], goals: string[] }. Injected into AI prompts for personalized risk assessment.';


-- ─────────────────────────────────────────────────────
-- 2. scans.summary  (TEXT)
-- ─────────────────────────────────────────────────────
-- WHO WRITES:  Frontend (saveScan ) after receiving AI result
-- CONTENT:     "This moisturizer contains mostly safe ingredients..."
-- SIZE:        ~100–300 bytes per scan
--
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS summary TEXT;


-- ─────────────────────────────────────────────────────
-- 3. scans.macros  (JSONB)
-- ─────────────────────────────────────────────────────
-- WHO WRITES:  Frontend (saveScan) for food scans
-- STRUCTURE:   { "calories": 250, "protein": 8, "carbs": 30, "fats": 12, "sugar": 5, ... }
-- SIZE:        ~100–200 bytes per food scan, NULL for cosmetics
--
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS macros JSONB DEFAULT NULL;


-- ─────────────────────────────────────────────────────
-- 4. scans.product_image_url  (TEXT)
-- ─────────────────────────────────────────────────────
-- WHO WRITES:  Frontend for barcode scans (image from OpenFoodFacts API)
-- CONTENT:     "https://images.openfoodfacts.org/images/products/..."
-- SIZE:        ~100–200 bytes per barcode scan, NULL for photo scans
--
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS product_image_url TEXT;


-- ─────────────────────────────────────────────────────
-- 5. scans.product_type  (TEXT)
-- ─────────────────────────────────────────────────────
-- WHO WRITES:  Frontend (saveScan)
-- CONTENT:     'food' or 'cosmetic'
-- NOTE:        Different from scan_type which is 'food'/'cosmetics' (plural)
--              product_type is the AI-determined type in the result payload
-- SIZE:        ~8 bytes per scan
--
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS product_type TEXT;


-- ─────────────────────────────────────────────────────
-- 6. INDEX: scans.barcode (for future caching)
-- ─────────────────────────────────────────────────────
-- The barcode column already exists from v2.
-- Adding a partial index for fast cache lookups when barcode is not null.
--
CREATE INDEX IF NOT EXISTS idx_scans_barcode
  ON scans(barcode)
  WHERE barcode IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (optional — run these to confirm everything)
-- ═══════════════════════════════════════════════════════════════════

-- Uncomment and run individually to verify:

-- Check users columns:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'users' ORDER BY ordinal_position;

-- Check scans columns:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'scans' ORDER BY ordinal_position;

-- Check scan_logs columns:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'scan_logs' ORDER BY ordinal_position;

-- Check all indexes:
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename IN ('users', 'scans', 'scan_logs');

-- Check RLS policies:
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('users', 'scans', 'scan_logs');


-- ═══════════════════════════════════════════════════════════════════
-- COMPLETE SCHEMA REFERENCE (after v1 + v2 + v3)
-- ═══════════════════════════════════════════════════════════════════
--
-- ┌─────────────────────────────────────────────────────────────────┐
-- │  TABLE: users                                                  │
-- ├────────────────────────┬──────────┬─────────┬──────────────────┤
-- │ Column                 │ Type     │ Size    │ Purpose          │
-- ├────────────────────────┼──────────┼─────────┼──────────────────┤
-- │ id                     │ UUID     │ 16 B    │ PK, FK→auth.users│
-- │ email                  │ TEXT     │ ~30 B   │ User email       │
-- │ is_pro                 │ BOOL     │ 1 B     │ Subscription flag│
-- │ stripe_customer_id     │ TEXT     │ ~30 B   │ Stripe ID        │
-- │ daily_scans            │ INT      │ 4 B     │ Scans today      │
-- │ last_scan_date         │ DATE     │ 4 B     │ Last scan date   │
-- │ current_streak         │ INT      │ 4 B     │ Consecutive days │
-- │ level_xp               │ INT      │ 4 B     │ Gamification XP  │
-- │ health_preferences ✨  │ JSONB    │ ~300 B  │ AI personalizatn │
-- │ created_at             │ TSTZ     │ 8 B     │ Account created  │
-- ├────────────────────────┴──────────┴─────────┴──────────────────┤
-- │ TOTAL per user row: ~400 bytes                                 │
-- │ For 10,000 users: ~4 MB                                       │
-- │ For 100,000 users: ~40 MB                                     │
-- └────────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────────┐
-- │  TABLE: scans                                                  │
-- ├────────────────────────┬──────────┬─────────┬──────────────────┤
-- │ Column                 │ Type     │ Size    │ Purpose          │
-- ├────────────────────────┼──────────┼─────────┼──────────────────┤
-- │ id                     │ UUID     │ 16 B    │ PK               │
-- │ user_id                │ UUID     │ 16 B    │ FK→users         │
-- │ image_url              │ TEXT     │ ~100 B  │ Scan photo URL   │
-- │ product_name           │ TEXT     │ ~40 B   │ Product name     │
-- │ ingredients            │ JSONB    │ ~2 KB   │ Full AI analysis │
-- │ harmful_chemicals      │ JSONB    │ ~500 B  │ High/mod risk    │
-- │ grade                  │ TEXT     │ 1 B     │ A-E grade        │
-- │ score                  │ INT      │ 4 B     │ 0-100 toxicity   │
-- │ scan_type (v2)         │ TEXT     │ ~8 B    │ food/cosmetics   │
-- │ method (v2)            │ TEXT     │ ~10 B   │ barcode/item/ing │
-- │ barcode (v2)           │ TEXT     │ ~15 B   │ EAN/UPC code     │
-- │ brand (v2)             │ TEXT     │ ~20 B   │ Brand name       │
-- │ summary ✨             │ TEXT     │ ~200 B  │ AI summary text  │
-- │ macros ✨              │ JSONB    │ ~150 B  │ Nutrition data   │
-- │ product_image_url ✨   │ TEXT     │ ~150 B  │ API product img  │
-- │ product_type ✨        │ TEXT     │ ~8 B    │ food/cosmetic    │
-- │ created_at             │ TSTZ     │ 8 B     │ Scan timestamp   │
-- ├────────────────────────┴──────────┴─────────┴──────────────────┤
-- │ TOTAL per scan row: ~3.2 KB (food+macros), ~2.8 KB (cosmetic) │
-- │ For 10 scans/user, 10K users: ~320 MB                         │
-- │ For 10 scans/user, 100K users: ~3.2 GB                        │
-- │                                                                │
-- │ NOTE: ingredients JSONB is the heaviest column (~2 KB).        │
-- │ It stores the full enriched array with position, concentration,│
-- │ contextualNote, personalNote, regulatoryStatus per ingredient. │
-- │ A product with 30 ingredients × ~70 bytes each ≈ 2.1 KB.      │
-- └────────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────────┐
-- │  TABLE: scan_logs (from v2 — unchanged)                        │
-- ├────────────────────────┬──────────┬─────────┬──────────────────┤
-- │ Column                 │ Type     │ Size    │ Purpose          │
-- ├────────────────────────┼──────────┼─────────┼──────────────────┤
-- │ id                     │ UUID     │ 16 B    │ PK               │
-- │ user_id                │ UUID     │ 16 B    │ FK→users         │
-- │ scan_type              │ TEXT     │ ~8 B    │ food/cosmetics   │
-- │ method                 │ TEXT     │ ~10 B   │ barcode/item/ing │
-- │ barcode                │ TEXT     │ ~15 B   │ Optional barcode │
-- │ product_name           │ TEXT     │ ~40 B   │ Optional name    │
-- │ current_state          │ ENUM     │ 4 B     │ State machine    │
-- │ error_message          │ TEXT     │ ~50 B   │ Error details    │
-- │ created_at             │ TSTZ     │ 8 B     │ Log timestamp    │
-- │ updated_at             │ TSTZ     │ 8 B     │ Last update      │
-- ├────────────────────────┴──────────┴─────────┴──────────────────┤
-- │ TOTAL per log row: ~165 bytes                                  │
-- │ For 10 scans/user, 10K users: ~16 MB                          │
-- │ For 10 scans/user, 100K users: ~165 MB                        │
-- └────────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────────┐
-- │  TOTAL DATABASE SIZE ESTIMATES                                 │
-- ├─────────────────────────────┬───────────┬──────────────────────┤
-- │ Scale                       │ Data Size │ + Indexes (~20%)     │
-- ├─────────────────────────────┼───────────┼──────────────────────┤
-- │ 1,000 users, 5 scans each   │ ~18 MB    │ ~22 MB              │
-- │ 10,000 users, 10 scans each │ ~340 MB   │ ~408 MB             │
-- │ 100,000 users, 10 scans each│ ~3.4 GB   │ ~4.1 GB             │
-- ├─────────────────────────────┴───────────┴──────────────────────┤
-- │ Supabase Free tier: 500 MB database                            │
-- │ Supabase Pro tier: 8 GB database (expandable)                  │
-- │                                                                │
-- │ ⚡ TIP: The ingredients JSONB (~2KB/scan) dominates storage.   │
-- │ When you hit 50K+ scans, consider archiving old scans or       │
-- │ storing only harmful_chemicals (not full ingredients list).     │
-- └────────────────────────────────────────────────────────────────┘
--
-- ✨ = NEW in this migration (v3)
