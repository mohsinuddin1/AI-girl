-- Add long_term_facts column to aigirl_users for the auto-condensing memory
ALTER TABLE aigirl_users
ADD COLUMN IF NOT EXISTS long_term_facts TEXT DEFAULT '';
