-- ═══════════════════════════════════════════════════════════════════════
-- CREATE athlete_progress TABLE  (roadmap Phase 1A)
-- Persists gamification state (XP, streak, earned badges) so it survives
-- app reinstall / device switch. Previously this lived only in an in-memory
-- store on the mobile client and was lost on reload.
--
-- One row per user. XP is accumulated server-side-of-truth (the row is the
-- source of truth); current streak / counts are still derived from logs at
-- read time, but total_xp, longest_streak and badges_earned persist here.
--
-- Idempotent: safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS athlete_progress (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp       integer     NOT NULL DEFAULT 0,
  longest_streak integer     NOT NULL DEFAULT 0,
  badges_earned  text[]      NOT NULL DEFAULT '{}',   -- badge ids already awarded
  last_log_date  date,                                -- last day a metric was logged
  bootstrapped   boolean     NOT NULL DEFAULT false,  -- has historical XP been backfilled
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE athlete_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS athlete_progress_select_own ON athlete_progress;
DROP POLICY IF EXISTS athlete_progress_insert_own ON athlete_progress;
DROP POLICY IF EXISTS athlete_progress_update_own ON athlete_progress;
DROP POLICY IF EXISTS athlete_progress_delete_own ON athlete_progress;

CREATE POLICY athlete_progress_select_own
  ON athlete_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY athlete_progress_insert_own
  ON athlete_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY athlete_progress_update_own
  ON athlete_progress FOR UPDATE
  TO authenticated
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());  -- prevents ownership handoff

CREATE POLICY athlete_progress_delete_own
  ON athlete_progress FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Keep updated_at fresh on every write.
CREATE OR REPLACE FUNCTION set_athlete_progress_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_athlete_progress_updated_at ON athlete_progress;
CREATE TRIGGER trg_athlete_progress_updated_at
  BEFORE UPDATE ON athlete_progress
  FOR EACH ROW EXECUTE FUNCTION set_athlete_progress_updated_at();
