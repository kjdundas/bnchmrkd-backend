-- ════════════════════════════════════════════════════════════════════
-- Athlete app v1 — extend athlete_profiles to store performance data
-- ════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor.
-- Adds columns for storing scraped/analysed performance data so the
-- athlete dashboard has something to display on day one.
--
-- Idempotent: uses ADD COLUMN IF NOT EXISTS / CREATE POLICY IF NOT EXISTS.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Performance data columns ───────────────────────────────────────
ALTER TABLE public.athlete_profiles
  ADD COLUMN IF NOT EXISTS world_athletics_url text,
  ADD COLUMN IF NOT EXISTS nationality          text,
  ADD COLUMN IF NOT EXISTS discipline           text,
  ADD COLUMN IF NOT EXISTS disciplines          text[],
  ADD COLUMN IF NOT EXISTS pb_value             numeric,
  ADD COLUMN IF NOT EXISTS pb_display           text,
  ADD COLUMN IF NOT EXISTS last_result_value    numeric,
  ADD COLUMN IF NOT EXISTS last_result_display  text,
  ADD COLUMN IF NOT EXISTS last_result_date     date,
  ADD COLUMN IF NOT EXISTS races                jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS disciplines_data     jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS analysis_data        jsonb,
  ADD COLUMN IF NOT EXISTS dob_estimated        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gender_estimated     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at       timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at           timestamptz DEFAULT now();

-- ── 2. Helpful indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS athlete_profiles_discipline_idx
  ON public.athlete_profiles (discipline);

CREATE INDEX IF NOT EXISTS athlete_profiles_last_synced_idx
  ON public.athlete_profiles (last_synced_at DESC);

-- ── 3. Row Level Security ─────────────────────────────────────────────
ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;

-- Athletes can read ONLY their own row
DROP POLICY IF EXISTS athlete_profiles_self_select ON public.athlete_profiles;
CREATE POLICY athlete_profiles_self_select
  ON public.athlete_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Athletes can insert ONLY their own row (id must equal auth.uid())
DROP POLICY IF EXISTS athlete_profiles_self_insert ON public.athlete_profiles;
CREATE POLICY athlete_profiles_self_insert
  ON public.athlete_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Athletes can update ONLY their own row
DROP POLICY IF EXISTS athlete_profiles_self_update ON public.athlete_profiles;
CREATE POLICY athlete_profiles_self_update
  ON public.athlete_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Athletes can delete ONLY their own row (account deletion)
DROP POLICY IF EXISTS athlete_profiles_self_delete ON public.athlete_profiles;
CREATE POLICY athlete_profiles_self_delete
  ON public.athlete_profiles
  FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- ── 4. Auto-bump updated_at on UPDATE ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_athlete_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS athlete_profiles_touch_updated_at ON public.athlete_profiles;
CREATE TRIGGER athlete_profiles_touch_updated_at
  BEFORE UPDATE ON public.athlete_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_athlete_profiles_updated_at();
