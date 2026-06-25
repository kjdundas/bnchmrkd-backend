-- Program completion loop (M2). One row per (program, session, week) marks a
-- session done that week. Athlete owns their logs; a linked coach can read
-- them to see weekly adherence. week_start = Monday of the completed week.
CREATE TABLE IF NOT EXISTS public.program_session_logs (
  id            bigint generated always as identity primary key,
  program_id    uuid not null references public.programs(id) on delete cascade,
  athlete_id    uuid not null references auth.users(id) on delete cascade,
  session_index smallint not null,
  week_start    date not null,
  completed_at  timestamptz not null default now(),
  unique (program_id, session_index, week_start)
);

CREATE INDEX IF NOT EXISTS program_session_logs_prog_week_idx
  ON public.program_session_logs (program_id, week_start);
CREATE INDEX IF NOT EXISTS program_session_logs_athlete_idx
  ON public.program_session_logs (athlete_id, week_start);

ALTER TABLE public.program_session_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS psl_select ON public.program_session_logs;
CREATE POLICY psl_select ON public.program_session_logs FOR SELECT
  USING (athlete_id = auth.uid() OR public.coach_has_active_link(athlete_id));

DROP POLICY IF EXISTS psl_insert ON public.program_session_logs;
CREATE POLICY psl_insert ON public.program_session_logs FOR INSERT
  WITH CHECK (athlete_id = auth.uid());

DROP POLICY IF EXISTS psl_delete ON public.program_session_logs;
CREATE POLICY psl_delete ON public.program_session_logs FOR DELETE
  USING (athlete_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.program_session_logs TO authenticated;
REVOKE ALL ON public.program_session_logs FROM anon;
