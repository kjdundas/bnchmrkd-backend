-- ═══════════════════════════════════════════════════════════════════════
-- CREATE performances TABLE
-- Stores competition results (race times, jump/throw marks) logged
-- by athletes from the mobile app. Distinct from athlete_metrics
-- which tracks physical testing data.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS performances (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discipline    text NOT NULL,          -- e.g. '100m', 'Long Jump', 'Shot Put'
  mark          numeric NOT NULL,       -- seconds for time events, metres for field events
  competition_name text,                -- optional: 'County Championships'
  competition_date date NOT NULL DEFAULT CURRENT_DATE,
  sex           text NOT NULL DEFAULT 'M',
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- Index for user lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_performances_user_id
  ON performances(user_id);

CREATE INDEX IF NOT EXISTS idx_performances_user_discipline
  ON performances(user_id, discipline);

-- ── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE performances ENABLE ROW LEVEL SECURITY;

-- Athletes can read their own performances
CREATE POLICY "Users can read own performances"
  ON performances FOR SELECT
  USING (auth.uid() = user_id);

-- Athletes can insert their own performances
CREATE POLICY "Users can insert own performances"
  ON performances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Athletes can update their own performances
CREATE POLICY "Users can update own performances"
  ON performances FOR UPDATE
  USING (auth.uid() = user_id);

-- Athletes can delete their own performances
CREATE POLICY "Users can delete own performances"
  ON performances FOR DELETE
  USING (auth.uid() = user_id);
