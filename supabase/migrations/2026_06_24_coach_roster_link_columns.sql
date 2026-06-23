-- ═══════════════════════════════════════════════════════════════════════
-- coach_roster link awareness  (Phase A · ticket A2)
-- Adds the two-tier flags to existing roster rows. All existing rows become
-- data-only (is_linked = false) — no behaviour change until an athlete is
-- invited and accepts. coach_roster RLS is unchanged (still coach-owned).
--
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE coach_roster
  ADD COLUMN IF NOT EXISTS is_linked           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS link_id             uuid REFERENCES coach_athlete_links(id) ON DELETE SET NULL,
  -- For data-only records of MINORS: the coach's recorded lawful basis /
  -- parental-awareness attestation (ticket A8). Null for adults / unset.
  ADD COLUMN IF NOT EXISTS minor_consent_basis text;

CREATE INDEX IF NOT EXISTS idx_coach_roster_link_id ON coach_roster(link_id);
