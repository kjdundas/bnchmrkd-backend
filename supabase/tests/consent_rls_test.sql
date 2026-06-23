-- ═══════════════════════════════════════════════════════════════════════
-- Consent RLS test  (Phase A · ticket A10)  ⚠ security-critical
-- Proves the coach↔athlete consent boundary on the LIVE data model:
--   a coach can read an athlete's data ONLY through an ACTIVE link.
--
-- Self-contained: creates throwaway users, asserts visibility across the
-- link lifecycle by impersonating the coach role under RLS, then cleans up
-- via FK cascade. Raises an exception (aborting) on any failure; prints a
-- NOTICE on success. Re-runnable.
--
-- Run via: Supabase SQL editor, or the Supabase MCP execute_sql tool.
-- Verified passing 24 Jun 2026.
-- ═══════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  coach   uuid := gen_random_uuid();
  athlete uuid := gen_random_uuid();
  link    uuid;
  c       int;
BEGIN
  -- setup (as postgres; RLS bypassed)
  INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  VALUES
    (coach,   '00000000-0000-0000-0000-000000000000','authenticated','authenticated','t_coach_'||coach||'@example.com', now(), now()),
    (athlete, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','t_ath_'||athlete||'@example.com', now(), now());
  INSERT INTO user_profiles (id, account_type, full_name, email) VALUES
    (coach,   'coach',   'Test Coach',   't_coach_'||coach||'@example.com'),
    (athlete, 'athlete', 'Test Athlete', 't_ath_'||athlete||'@example.com');
  INSERT INTO athlete_progress (user_id, total_xp, bootstrapped) VALUES (athlete, 123, true);
  INSERT INTO coach_athlete_links (coach_id, athlete_user_id, status, initiated_by)
  VALUES (coach, athlete, 'pending', 'coach') RETURNING id INTO link;

  -- 1. PENDING → hidden
  PERFORM set_config('request.jwt.claims', json_build_object('sub', coach)::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO c FROM athlete_progress WHERE user_id = athlete;
  IF c <> 0 THEN RAISE EXCEPTION 'FAIL: read with PENDING link (got %)', c; END IF;
  RESET ROLE;

  -- 2. ACTIVE → visible
  UPDATE coach_athlete_links SET status='active', consent_at=now() WHERE id = link;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', coach)::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO c FROM athlete_progress WHERE user_id = athlete;
  IF c <> 1 THEN RAISE EXCEPTION 'FAIL: could not read with ACTIVE link (got %)', c; END IF;
  RESET ROLE;

  -- 3. REVOKED → hidden
  UPDATE coach_athlete_links SET status='revoked', revoked_at=now() WHERE id = link;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', coach)::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO c FROM athlete_progress WHERE user_id = athlete;
  IF c <> 0 THEN RAISE EXCEPTION 'FAIL: still read after REVOKE (got %)', c; END IF;
  RESET ROLE;

  -- 4. Unrelated coach → hidden
  UPDATE coach_athlete_links SET status='active' WHERE id = link;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid())::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO c FROM athlete_progress WHERE user_id = athlete;
  IF c <> 0 THEN RAISE EXCEPTION 'FAIL: unrelated coach read data (got %)', c; END IF;
  RESET ROLE;

  DELETE FROM auth.users WHERE id IN (coach, athlete);  -- cascade cleanup
  RAISE NOTICE 'CONSENT RLS TEST PASSED (pending=hidden, active=visible, revoked=hidden, unrelated=hidden)';
END $$;
