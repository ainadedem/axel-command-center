ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false;

-- Backfill existing rows: those with no company_id were previously treated as global/all companies.
UPDATE public.team_members SET is_global = true WHERE company_id IS NULL;

-- Update the trigger function so updated_at is refreshed when the new column changes.
-- (The existing trigger already fires on UPDATE, so no new trigger is needed.)