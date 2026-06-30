-- Migration to add memory and name columns to aigirl_users
ALTER TABLE public.aigirl_users ADD COLUMN IF NOT EXISTS memory TEXT DEFAULT '';
ALTER TABLE public.aigirl_users ADD COLUMN IF NOT EXISTS name TEXT;
