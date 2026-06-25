-- Add program_compliance (active program + sessions done this calendar week)
-- to get_linked_athletes so the coach roster can show weekly adherence.
DROP FUNCTION IF EXISTS public.get_linked_athletes();

CREATE FUNCTION public.get_linked_athletes()
 RETURNS TABLE(link_id uuid, athlete_user_id uuid, name text, gender text, dob date, discipline text, disciplines text[], pb_value numeric, pb_display text, last_result_value numeric, last_result_display text, last_date date, race_count integer, races jsonb, disciplines_data jsonb, performances jsonb, height_cm numeric, sitting_height_cm numeric, weight_kg numeric, metrics jsonb, latest_checkin jsonb, program_compliance jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    l.id, l.athlete_user_id, up.full_name, up.gender::text, up.date_of_birth,
    ap.discipline, ap.disciplines, ap.pb_value, ap.pb_display,
    ap.last_result_value, ap.last_result_display, ap.last_result_date,
    COALESCE(jsonb_array_length(ap.races), 0),
    COALESCE(ap.races, '[]'::jsonb),
    COALESCE(ap.disciplines_data, '{}'::jsonb),
    COALESCE(perf.arr, '[]'::jsonb),
    ap.height_cm, ap.sitting_height_cm, ap.weight_kg,
    COALESCE(mx.arr, '[]'::jsonb),
    ck.row,
    CASE WHEN prog.id IS NULL THEN NULL ELSE jsonb_build_object(
      'program_id', prog.id, 'title', prog.title,
      'sessions_per_week', prog.spw, 'done_this_week', COALESCE(comp.done, 0)
    ) END
  FROM coach_athlete_links l
  JOIN user_profiles up ON up.id = l.athlete_user_id
  LEFT JOIN athlete_profiles ap ON ap.id = l.athlete_user_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'discipline', p.discipline, 'value', p.mark,
      'date', p.competition_date, 'competition', p.competition_name
    )) AS arr
    FROM performances p WHERE p.user_id = l.athlete_user_id
  ) perf ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'metric_key', m.metric_key, 'metric_label', m.metric_label,
      'unit', m.unit, 'value', m.value, 'recorded_at', m.recorded_at
    )) AS arr
    FROM athlete_metrics m WHERE m.athlete_id = l.athlete_user_id
  ) mx ON true
  LEFT JOIN LATERAL (
    SELECT to_jsonb(c) AS row
    FROM athlete_checkins c
    WHERE c.athlete_id = l.athlete_user_id
    ORDER BY c.checkin_date DESC LIMIT 1
  ) ck ON true
  LEFT JOIN LATERAL (
    SELECT pr.id, pr.title,
      GREATEST(1, COALESCE((pr.structure->>'sessions_per_week')::int,
                           jsonb_array_length(pr.structure->'sessions'), 1)) AS spw
    FROM programs pr
    WHERE pr.athlete_user_id = l.athlete_user_id AND pr.status = 'active'
    ORDER BY pr.created_at DESC LIMIT 1
  ) prog ON true
  LEFT JOIN LATERAL (
    SELECT count(DISTINCT sl.session_index) AS done
    FROM program_session_logs sl
    WHERE sl.program_id = prog.id
      AND sl.week_start = date_trunc('week', current_date)::date
  ) comp ON true
  WHERE l.coach_id = auth.uid() AND l.status = 'active';
$function$;

GRANT EXECUTE ON FUNCTION public.get_linked_athletes() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_linked_athletes() FROM anon;
