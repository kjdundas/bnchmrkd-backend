-- Derived activity feed for a coach: recent results, test scores, and completed
-- training sessions across all consented (active-link) athletes, with the
-- emojis THIS coach has already left per event. No write-site instrumentation —
-- the feed is computed on read from existing tables.
CREATE OR REPLACE FUNCTION public.get_coach_feed()
 RETURNS TABLE(event_key text, athlete_user_id uuid, athlete_name text, kind text, detail text, occurred_at timestamptz, my_reactions text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH feed AS (
    SELECT 'perf:' || p.id AS event_key, l.athlete_user_id, up.full_name AS athlete_name,
           'result' AS kind,
           COALESCE(NULLIF(trim(p.discipline), ''), 'Result') || ' · ' || trim(to_char(p.mark, 'FM999990.00')) AS detail,
           (p.competition_date)::timestamptz AS occurred_at
    FROM performances p
    JOIN coach_athlete_links l ON l.athlete_user_id = p.user_id AND l.coach_id = auth.uid() AND l.status = 'active'
    JOIN user_profiles up ON up.id = l.athlete_user_id
    WHERE p.competition_date IS NOT NULL AND p.mark IS NOT NULL

    UNION ALL
    SELECT 'metric:' || m.id, l.athlete_user_id, up.full_name, 'test',
           m.metric_label || ' · ' || trim(to_char(m.value, 'FM999990.00')) || COALESCE(' ' || m.unit, ''),
           (m.recorded_at)::timestamptz
    FROM athlete_metrics m
    JOIN coach_athlete_links l ON l.athlete_user_id = m.athlete_id AND l.coach_id = auth.uid() AND l.status = 'active'
    JOIN user_profiles up ON up.id = l.athlete_user_id

    UNION ALL
    SELECT 'session:' || sl.id, l.athlete_user_id, up.full_name, 'session',
           'Completed a training session', sl.completed_at
    FROM program_session_logs sl
    JOIN coach_athlete_links l ON l.athlete_user_id = sl.athlete_id AND l.coach_id = auth.uid() AND l.status = 'active'
    JOIN user_profiles up ON up.id = l.athlete_user_id
  )
  SELECT f.event_key, f.athlete_user_id, f.athlete_name, f.kind, f.detail, f.occurred_at,
         COALESCE(array_agg(r.emoji) FILTER (WHERE r.emoji IS NOT NULL), '{}') AS my_reactions
  FROM feed f
  LEFT JOIN activity_reactions r ON r.event_key = f.event_key AND r.reactor_id = auth.uid()
  GROUP BY f.event_key, f.athlete_user_id, f.athlete_name, f.kind, f.detail, f.occurred_at
  ORDER BY f.occurred_at DESC NULLS LAST
  LIMIT 50;
$function$;

GRANT EXECUTE ON FUNCTION public.get_coach_feed() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_coach_feed() FROM anon;
