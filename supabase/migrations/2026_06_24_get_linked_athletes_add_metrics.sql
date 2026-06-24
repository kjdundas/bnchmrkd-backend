-- Extend get_linked_athletes to also return the athlete's test-score metrics
-- (athlete_metrics) so a linked coach can compute the athlete's DNA profile and
-- generate diagnostic, weakness-targeted training programs. SECURITY DEFINER +
-- the active-link WHERE clause keep this consent-gated.
DROP FUNCTION IF EXISTS public.get_linked_athletes();

CREATE FUNCTION public.get_linked_athletes()
 RETURNS TABLE(link_id uuid, athlete_user_id uuid, name text, gender text, dob date, discipline text, disciplines text[], pb_value numeric, pb_display text, last_result_value numeric, last_result_display text, last_date date, race_count integer, races jsonb, disciplines_data jsonb, performances jsonb, height_cm numeric, sitting_height_cm numeric, weight_kg numeric, metrics jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    l.id,
    l.athlete_user_id,
    up.full_name,
    up.gender::text,
    up.date_of_birth,
    ap.discipline,
    ap.disciplines,
    ap.pb_value,
    ap.pb_display,
    ap.last_result_value,
    ap.last_result_display,
    ap.last_result_date,
    COALESCE(jsonb_array_length(ap.races), 0),
    COALESCE(ap.races, '[]'::jsonb),
    COALESCE(ap.disciplines_data, '{}'::jsonb),
    COALESCE(perf.arr, '[]'::jsonb),
    ap.height_cm,
    ap.sitting_height_cm,
    ap.weight_kg,
    COALESCE(mx.arr, '[]'::jsonb)
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
  WHERE l.coach_id = auth.uid() AND l.status = 'active';
$function$;

GRANT EXECUTE ON FUNCTION public.get_linked_athletes() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_linked_athletes() FROM anon;
