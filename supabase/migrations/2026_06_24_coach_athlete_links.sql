-- ═══════════════════════════════════════════════════════════════════════
-- coach_athlete_links  (Phase A · ticket A1)
-- Represents a coach↔athlete relationship and its consent lifecycle.
--   pending  → invite sent, awaiting athlete approval
--   active   → athlete approved; coach may read shared data (see A4 RLS)
--   declined → athlete declined
--   revoked  → either party ended it; access cut immediately
--   expired  → invite lapsed
--
-- Two-tier model: a coach_roster row can be a private "data-only" record
-- (no link) or "linked" to a real athlete account via a row here.
--
-- Idempotent. Follows existing RLS conventions (TO authenticated, USING +
-- WITH CHECK, no ownership handoff).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS coach_athlete_links (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,   -- null until accepted / for tokenized invites
  invite_email     text,                                               -- email the coach invited
  invite_token     text UNIQUE,                                        -- for not-yet-registered athletes (sign-up auto-link)
  roster_id        uuid REFERENCES coach_roster(id) ON DELETE SET NULL, -- data-only record this upgrades, if any
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','active','declined','revoked','expired')),
  initiated_by     text NOT NULL DEFAULT 'coach'
                     CHECK (initiated_by IN ('coach','athlete')),
  parental_consent boolean NOT NULL DEFAULT false,
  consent_at       timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cal_coach        ON coach_athlete_links(coach_id);
CREATE INDEX IF NOT EXISTS idx_cal_athlete      ON coach_athlete_links(athlete_user_id);
CREATE INDEX IF NOT EXISTS idx_cal_token        ON coach_athlete_links(invite_token);
-- Fast "is there an active link?" lookups used by A4 shared-data policies.
CREATE INDEX IF NOT EXISTS idx_cal_active_pair  ON coach_athlete_links(athlete_user_id, coach_id) WHERE status = 'active';

-- Prevent duplicate live links for the same coach+athlete pair.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cal_live_pair
  ON coach_athlete_links(coach_id, athlete_user_id)
  WHERE athlete_user_id IS NOT NULL AND status IN ('pending','active');

-- ── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE coach_athlete_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cal_select_party  ON coach_athlete_links;
DROP POLICY IF EXISTS cal_insert_coach  ON coach_athlete_links;
DROP POLICY IF EXISTS cal_update_party  ON coach_athlete_links;
DROP POLICY IF EXISTS cal_delete_coach  ON coach_athlete_links;

-- Either party to the link can see it.
CREATE POLICY cal_select_party
  ON coach_athlete_links FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid() OR athlete_user_id = auth.uid());

-- A coach may create an invite they own. (Athlete-initiated requests are a
-- P1 path and will get their own policy/RPC.)
CREATE POLICY cal_insert_coach
  ON coach_athlete_links FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid() AND initiated_by = 'coach');

-- Either party can update (accept/decline/revoke), but cannot reassign the
-- relationship to someone else (no ownership handoff).
CREATE POLICY cal_update_party
  ON coach_athlete_links FOR UPDATE
  TO authenticated
  USING      (coach_id = auth.uid() OR athlete_user_id = auth.uid())
  WITH CHECK (coach_id = auth.uid() OR athlete_user_id = auth.uid());

-- Only the coach who owns the invite can hard-delete it.
CREATE POLICY cal_delete_coach
  ON coach_athlete_links FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid());

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION set_coach_athlete_links_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cal_updated_at ON coach_athlete_links;
CREATE TRIGGER trg_cal_updated_at
  BEFORE UPDATE ON coach_athlete_links
  FOR EACH ROW EXECUTE FUNCTION set_coach_athlete_links_updated_at();
