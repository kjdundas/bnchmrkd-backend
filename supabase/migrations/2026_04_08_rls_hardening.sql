-- ════════════════════════════════════════════════════════════════════
-- bnchmrkd. — pre-launch RLS hardening
-- ════════════════════════════════════════════════════════════════════
-- Fixes three issues found in the 2026-04-08 pre-launch RLS audit:
--   1. UPDATE policies on coach_roster, user_profiles, athlete_metrics
--      are missing WITH CHECK clauses (allowing owner-handoff attacks).
--   2. Redundant "Athletes can manage own profile" ALL policy overlaps
--      the four newer athlete_profiles_self_* policies — drop it.
--   3. Tighten role target from {public} to {authenticated} on all
--      policies (cosmetic + micro-perf; anon was already blocked).
--
-- Idempotent: safe to run multiple times. Every change is DROP + CREATE.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. coach_roster ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Coaches can view own roster"   ON public.coach_roster;
DROP POLICY IF EXISTS "Coaches can insert own roster" ON public.coach_roster;
DROP POLICY IF EXISTS "Coaches can update own roster" ON public.coach_roster;
DROP POLICY IF EXISTS "Coaches can delete own roster" ON public.coach_roster;

CREATE POLICY coach_roster_select_own
  ON public.coach_roster
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY coach_roster_insert_own
  ON public.coach_roster
  FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY coach_roster_update_own
  ON public.coach_roster
  FOR UPDATE
  TO authenticated
  USING      (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());  -- prevents ownership handoff

CREATE POLICY coach_roster_delete_own
  ON public.coach_roster
  FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid());

-- ── 2. user_profiles ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own profile"   ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY user_profiles_select_own
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY user_profiles_insert_own
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY user_profiles_update_own
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING      (id = auth.uid())
  WITH CHECK (id = auth.uid());  -- prevents id rewrite

-- (no DELETE policy — account deletion cascades from auth.users)

-- ── 3. athlete_metrics ───────────────────────────────────────────────
DROP POLICY IF EXISTS athlete_metrics_select_own ON public.athlete_metrics;
DROP POLICY IF EXISTS athlete_metrics_insert_own ON public.athlete_metrics;
DROP POLICY IF EXISTS athlete_metrics_update_own ON public.athlete_metrics;
DROP POLICY IF EXISTS athlete_metrics_delete_own ON public.athlete_metrics;

CREATE POLICY athlete_metrics_select_own
  ON public.athlete_metrics
  FOR SELECT
  TO authenticated
  USING (athlete_id = auth.uid());

CREATE POLICY athlete_metrics_insert_own
  ON public.athlete_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY athlete_metrics_update_own
  ON public.athlete_metrics
  FOR UPDATE
  TO authenticated
  USING      (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());  -- prevents ownership handoff

CREATE POLICY athlete_metrics_delete_own
  ON public.athlete_metrics
  FOR DELETE
  TO authenticated
  USING (athlete_id = auth.uid());

-- ── 4. coach_profiles ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Coaches can manage own profile" ON public.coach_profiles;

CREATE POLICY coach_profiles_self_select
  ON public.coach_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY coach_profiles_self_insert
  ON public.coach_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY coach_profiles_self_update
  ON public.coach_profiles
  FOR UPDATE
  TO authenticated
  USING      (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY coach_profiles_self_delete
  ON public.coach_profiles
  FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- ── 5. athlete_profiles — drop the redundant legacy ALL policy ──────
-- The four self_* policies already cover SELECT/INSERT/UPDATE/DELETE.
DROP POLICY IF EXISTS "Athletes can manage own profile" ON public.athlete_profiles;

-- ════════════════════════════════════════════════════════════════════
-- Verification query — run this after the migration to confirm state.
-- Expected: every policy targets {authenticated}, every UPDATE has
-- both USING and WITH CHECK, no policy names containing "manage own".
-- ════════════════════════════════════════════════════════════════════
-- SELECT tablename, policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('user_profiles','coach_profiles','athlete_profiles','coach_roster','athlete_metrics')
-- ORDER BY tablename, cmd, policyname;
