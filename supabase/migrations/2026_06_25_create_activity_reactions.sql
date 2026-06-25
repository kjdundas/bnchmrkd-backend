-- Closed feed reactions (M1). A coach reacts to a linked athlete's activity
-- event (a result, test score, or completed session). Denormalised athlete +
-- reactor name + event title so the athlete can see "Coach 👏 your 100m" with
-- one read. event_key identifies the derived event (e.g. 'perf:123').
CREATE TABLE IF NOT EXISTS public.activity_reactions (
  id              bigint generated always as identity primary key,
  event_key       text not null,
  athlete_user_id uuid not null references auth.users(id) on delete cascade,
  reactor_id      uuid not null references auth.users(id) on delete cascade,
  reactor_name    text,
  event_title     text,
  emoji           text not null,
  created_at      timestamptz not null default now(),
  unique (event_key, reactor_id, emoji)
);

CREATE INDEX IF NOT EXISTS activity_reactions_athlete_idx
  ON public.activity_reactions (athlete_user_id, created_at desc);
CREATE INDEX IF NOT EXISTS activity_reactions_event_idx
  ON public.activity_reactions (event_key);

ALTER TABLE public.activity_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reactions_select ON public.activity_reactions;
CREATE POLICY reactions_select ON public.activity_reactions FOR SELECT
  USING (reactor_id = auth.uid() OR athlete_user_id = auth.uid());

DROP POLICY IF EXISTS reactions_insert ON public.activity_reactions;
CREATE POLICY reactions_insert ON public.activity_reactions FOR INSERT
  WITH CHECK (reactor_id = auth.uid() AND public.coach_has_active_link(athlete_user_id));

DROP POLICY IF EXISTS reactions_delete ON public.activity_reactions;
CREATE POLICY reactions_delete ON public.activity_reactions FOR DELETE
  USING (reactor_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.activity_reactions TO authenticated;
REVOKE ALL ON public.activity_reactions FROM anon;
