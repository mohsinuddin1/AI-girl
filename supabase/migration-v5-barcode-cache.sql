-- Barcode product cache: stores AI analysis results keyed by barcode.
-- Eliminates redundant Groq API calls for previously-scanned barcodes.
-- Cache is per-barcode (global), not per-user. Personalization is layered on top.
--
-- Run this migration AFTER the existing tables are in place.

CREATE TABLE IF NOT EXISTS barcode_cache (
    barcode TEXT PRIMARY KEY,
    product_name TEXT,
    brand TEXT,
    product_type TEXT,
    image_url TEXT,
    -- Raw AI analysis (without user-specific personalNotes)
    ai_result JSONB NOT NULL,
    -- Precomputed from OpenFoodFacts
    macros JSONB,
    nutri_grade TEXT,
    nova_group INTEGER,
    allergens TEXT[],
    additives TEXT[],
    nutrient_levels JSONB,
    categories TEXT,
    -- Bookkeeping
    hit_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on barcode is implicit via PRIMARY KEY.
-- Add a TTL-style index for future cleanup jobs.
CREATE INDEX IF NOT EXISTS idx_barcode_cache_updated ON barcode_cache (updated_at);

-- Allow all authenticated users to read the cache
ALTER TABLE barcode_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read barcode cache" ON barcode_cache FOR SELECT USING (true);
-- Only service_role (edge functions) can write
CREATE POLICY "Service role can insert/update cache" ON barcode_cache FOR ALL USING (auth.role() = 'service_role');
