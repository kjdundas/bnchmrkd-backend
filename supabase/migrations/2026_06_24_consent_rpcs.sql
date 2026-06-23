-- ═══════════════════════════════════════════════════════════════════════
-- Consent lifecycle RPCs  (Phase A · ticket A3)
-- SECURITY DEFINER so they can look up accounts by email (user_profiles) and
-- write links regardless of RLS — but each function enforces the caller's
-- role/ownership internally. search_path pinned to avoid hijacking.
--
-- Functions:
--   invite_athlete(email, roster_id?)        — coach only
--   respond_to_invite(link_id, accept, parental_consent?) — athlete only
--   revoke_link(link_id)                      — either party
--
-- Idempotent (CREATE OR REPLACE).
-- ═══════════════════════════════════════════════════════════════════════

-- ── Coach invites an athlete by email ──────────────────────────────────
-- Returns jsonb:
--   { result: 'invited',     link_id, delivery: 'in_app' }     (athlete account exists)
--   { result: 'invited',     link_id, delivery: 'share_link', invite_token }  (no account yet)
--   { result: 'already',     link_id }                          (live link already exists)
CREATE OR REPLACE FUNCTION invite_athlete(p_email text, p_roster_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coach   uuid := auth.uid();
  v_email   text := lower(trim(p_email));
  v_athlete uuid;
  v_existing coach_athlete_links%ROWTYPE;
  v_token   text;
  v_link_id uuid;
BEGIN
  IF v_coach IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Caller must be a coach.
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_coach AND account_type = 'coach') THEN
    RAISE EXCEPTION 'Only coaches can invite athletes';
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  -- Find an existing athlete account by email.
  SELECT id INTO v_athlete
  FROM user_profiles
  WHERE lower(email) = v_email AND account_type = 'athlete'
  LIMIT 1;

  IF v_athlete = v_coach THEN
    RAISE EXCEPTION 'You cannot invite yourself';
  END IF;

  -- Reuse an existing live link if one exists (no duplicates).
  IF v_athlete IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM coach_athlete_links
    WHERE coach_id = v_coach AND athlete_user_id = v_athlete
      AND status IN ('pending','active')
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('result','already','link_id', v_existing.id);
    END IF;
  END IF;

  IF v_athlete IS NOT NULL THEN
    -- Account exists → in-app pending invite.
    INSERT INTO coach_athlete_links (coach_id, athlete_user_id, invite_email, roster_id, status, initiated_by)
    VALUES (v_coach, v_athlete, v_email, p_roster_id, 'pending', 'coach')
    RETURNING id INTO v_link_id;
    RETURN jsonb_build_object('result','invited','link_id', v_link_id, 'delivery','in_app');
  ELSE
    -- No account → tokenized invite the coach shares as a sign-up link.
    v_token := encode(gen_random_bytes(18), 'hex');
    INSERT INTO coach_athlete_links (coach_id, invite_email, invite_token, roster_id, status, initiated_by)
    VALUES (v_coach, v_email, v_token, p_roster_id, 'pending', 'coach')
    RETURNING id INTO v_link_id;
    RETURN jsonb_build_object('result','invited','link_id', v_link_id, 'delivery','share_link','invite_token', v_token);
  END IF;
END;
$$;

-- ── Athlete accepts or declines an invite ──────────────────────────────
CREATE OR REPLACE FUNCTION respond_to_invite(p_link_id uuid, p_accept boolean, p_parental_consent boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_athlete uuid := auth.uid();
  v_link    coach_athlete_links%ROWTYPE;
BEGIN
  IF v_athlete IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_link FROM coach_athlete_links WHERE id = p_link_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  -- Only the invited athlete may respond.
  IF v_link.athlete_user_id IS DISTINCT FROM v_athlete THEN
    RAISE EXCEPTION 'This invite is not addressed to you';
  END IF;

  IF v_link.status <> 'pending' THEN
    RAISE EXCEPTION 'Invite is no longer pending';
  END IF;

  IF p_accept THEN
    -- NOTE (ticket A8 / legal): minor parental-consent enforcement is added
    -- here once the age threshold + mechanism are confirmed. For now we record
    -- the parental_consent flag passed by the client.
    UPDATE coach_athlete_links
    SET status = 'active', consent_at = now(), parental_consent = p_parental_consent
    WHERE id = p_link_id;

    -- Mark the coach's data-only record (if any) as linked.
    IF v_link.roster_id IS NOT NULL THEN
      UPDATE coach_roster SET is_linked = true, link_id = p_link_id WHERE id = v_link.roster_id;
    END IF;

    RETURN jsonb_build_object('result','active','link_id', p_link_id);
  ELSE
    UPDATE coach_athlete_links SET status = 'declined' WHERE id = p_link_id;
    RETURN jsonb_build_object('result','declined','link_id', p_link_id);
  END IF;
END;
$$;

-- ── Either party revokes / ends a link ─────────────────────────────────
CREATE OR REPLACE FUNCTION revoke_link(p_link_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_link coach_athlete_links%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_link FROM coach_athlete_links WHERE id = p_link_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link not found';
  END IF;

  IF v_user <> v_link.coach_id AND v_user IS DISTINCT FROM v_link.athlete_user_id THEN
    RAISE EXCEPTION 'You are not part of this relationship';
  END IF;

  UPDATE coach_athlete_links SET status = 'revoked', revoked_at = now() WHERE id = p_link_id;
  UPDATE coach_roster SET is_linked = false WHERE link_id = p_link_id;

  RETURN jsonb_build_object('result','revoked','link_id', p_link_id);
END;
$$;

-- Expose to authenticated users (authorization is enforced inside each function).
GRANT EXECUTE ON FUNCTION invite_athlete(text, uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_invite(uuid, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_link(uuid)                     TO authenticated;
