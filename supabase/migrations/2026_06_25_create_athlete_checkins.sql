-- Daily readiness check-in (M3). One row per athlete per day; a linked coach
-- can read it (consent-gated via coach_has_active_link). Powers the
-- red/amber/green readiness dot on the coach roster.
CREATE TABLE IF NOT EXISTS public.athlete_checkins (
  id           bigint generated always as identity primary key,
  athlete_id   uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  sleep_hours  numeric,
  soreness     smallint check (soreness between 1 and 5),
  mood         smallint check (mood between 1 and 5),
  energy       smallint check (energy between 1 and 5),
  pain         boolean not null default false,
  pain_areas   text[] not null default '{}',
  pain_note    text,
  created_at   timestamptz not null default now(),
  unique (athlete_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS athlete_checkins_athlete_date_idx
  ON public.athlete_checkins (athlete_id, checkin_date desc);

ALTER TABLE public.athlete_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkins_select ON public.athlete_checkins;
CREATE POLICY checkins_select ON public.athlete_checkins FOR SELECT
  USING (athlete_id = auth.uid() OR public.coach_has_active_link(athlete_id));

DROP POLICY IF EXISTS checkins_insert ON public.athlete_checkins;
CREATE POLICY checkins_insert ON public.athlete_checkins FOR INSERT
  WITH CHECK (athlete_id = auth.uid());

DROP POLICY IF EXISTS checkins_update ON public.athlete_checkins;
CREATE POLICY checkins_update ON public.athlete_checkins FOR UPDATE
  USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());

DROP POLICY IF EXISTS checkins_delete ON public.athlete_checkins;
CREATE POLICY checkins_delete ON public.athlete_checkins FOR DELETE
  USING (athlete_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_checkins TO authenticated;
REVOKE ALL ON public.athlete_checkins FROM anon;
