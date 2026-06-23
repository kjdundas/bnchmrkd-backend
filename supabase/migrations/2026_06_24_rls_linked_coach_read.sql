-- ═══════════════════════════════════════════════════════════════════════
-- Gate shared athlete data on an ACTIVE coach↔athlete link  (Phase A · A4)  ⚠
-- Adds SELECT policies so a coach can read a linked athlete's data ONLY while
-- coach_athlete_links has status='active'. These are ADDITIVE — athletes keep
-- their existing self-only access; coaches simply gain read on linked athletes.
-- Revoking a link removes the row from the active set → access disappears.
--
-- Tables gated (athlete-id column in parentheses):
--   athlete_profiles (id) · performances (user_id) · athlete_progress (user_id)
--   · athlete_metrics (athlete_id)
--
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- Helper: is the current user a coach with an active link to this athlete?
CREATE OR REPLACE FUNCTION coach_has_active_link(p_athlete uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM coach_athlete_links l
    WHERE l.athlete_user_id = p_athlete
      AND l.coach_id = auth.uid()
      AND l.status = 'active'
  );
$$;

REVOKE EXECUTE ON FUNCTION coach_has_active_link(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION coach_has_active_link(uuid) TO authenticated;

-- ── athlete_profiles ───────────────────────────────────────────────────
DROP POLICY IF EXISTS athlete_profiles_linked_coach_read ON athlete_profiles;
CREATE POLICY athlete_profiles_linked_coach_read
  ON athlete_profiles FOR SELECT
  TO authenticated
  USING (coach_has_active_link(id));

-- ── performances ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS performances_linked_coach_read ON performances;
CREATE POLICY performances_linked_coach_read
  ON performances FOR SELECT
  TO authenticated
  USING (coach_has_active_link(user_id));

-- ── athlete_progress ───────────────────────────────────────────────────
DROP POLICY IF EXISTS athlete_progress_linked_coach_read ON athlete_progress;
CREATE POLICY athlete_progress_linked_coach_read
  ON athlete_progress FOR SELECT
  TO authenticated
  USING (coach_has_active_link(user_id));

-- ── athlete_metrics ────────────────────────────────────────────────────
DROP POLICY IF EXISTS athlete_metrics_linked_coach_read ON athlete_metrics;
CREATE POLICY athlete_metrics_linked_coach_read
  ON athlete_metrics FOR SELECT
  TO authenticated
  USING (coach_has_active_link(athlete_id));
