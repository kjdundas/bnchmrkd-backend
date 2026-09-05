-- ═══════════════════════════════════════════════════════════════════════
-- ATHLETE LEADERBOARDS — a rank and a shape, never a list of people.
--
-- Applied to the live project as migration `athlete_leaderboard_position`
-- (version 20260902044128). This file is the repo's copy of it.
--
-- The athlete side gets to ask "where do I sit?" without any other
-- athlete's identity or mark ever reaching a device. That is not a UI
-- decision: the device is only ever ANSWERED with an ordinal, a field
-- size and its own value, so there is no row of somebody else's data on
-- the phone to screenshot, inspect or leak.
--
-- These are SECURITY DEFINER and therefore bypass RLS entirely. Every
-- rule has to be enforced HERE. A policy-only version would look correct
-- in a policy listing and leak in the app — the trap get_linked_athletes
-- fell into.
--
-- Enforced below, in order:
--   1. Signed in.
--   2. The caller has not opted out of boards.
--   3. Only athletes with an ACCOUNT — a coach-created roster athlete has
--      never been asked and cannot opt out, so they never appear.
--   4. Only athletes who have not opted out of boards.
--   5. Only approved rows (absent approval means approved).
--   6. Physical tests honour the athlete's own `metrics` sharing switch.
--   7. Body measurements are never rankable, for anyone.
--   8. Fewer than five qualifying athletes returns no position: a rank
--      out of four plus your own mark reconstructs other people's numbers.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.athlete_sharing
  add column if not exists boards boolean not null default true;

comment on column public.athlete_sharing.boards is
  'Appear on peer leaderboards. Absent row means true, as with every other column here.';

alter table public.user_profiles
  add column if not exists region text;

comment on column public.user_profiles.region is
  'Area wider than a city and narrower than a country (e.g. GCC, North West). Free text for now.';

-- Mirrors getAgeGroup in mobile/src/lib/performanceLevels.js
create or replace function public.bm_age_group(p_dob date)
returns text language sql immutable as $$
  select case
    when p_dob is null then null
    else (
      select case
        when a < 13 then 'U13' when a < 15 then 'U15'
        when a < 17 then 'U17' when a < 20 then 'U20'
        else 'Senior' end
      from (select extract(year from age(current_date, p_dob))::int as a) s
    )
  end
$$;

-- Mirrors NEVER_RANKED in mobile/src/lib/leaderboard.ts. A leaderboard of
-- who is heaviest is not a leaderboard. This is a privacy control, so it
-- lives here and not only in the client.
create or replace function public.bm_rankable_metric(p_key text)
returns boolean language sql immutable as $$
  select p_key is not null and p_key not in (
    'body_mass','standing_height','sitting_height','wingspan','lean_mass',
    'body_fat','body_fat_pct','sum_7_skinfolds','fat_mass'
  )
$$;

create or replace function public.bm_population(p_me uuid, p_scope text)
returns table (athlete_id uuid)
language sql stable security definer set search_path = public as $$
  with mine as (select city, region, country from public.user_profiles where id = p_me)
  select u.id
  from public.user_profiles u
  left join public.athlete_sharing s on s.athlete_id = u.id
  where coalesce(s.boards, true)
    and case lower(p_scope)
      when 'squad' then u.id in (
        select m2.athlete_user_id
        from public.squad_members m1
        join public.squad_members m2 on m2.squad_id = m1.squad_id
        where m1.athlete_user_id = p_me and m2.athlete_user_id is not null
      )
      when 'city'   then u.city   is not null and u.city   is not distinct from (select city   from mine)
      when 'region' then u.region is not null and u.region is not distinct from (select region from mine)
      when 'world'  then true
      else false
    end
$$;

create or replace function public.board_position(
  p_scope        text,
  p_kind         text,
  p_key          text,
  p_lower_better boolean default true,
  p_age_groups   text[] default null,
  p_genders      text[] default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me         uuid := auth.uid();
  min_field  constant int := 5;
  opted_in   boolean;
  my_value   numeric;
  n_field    int;
  n_rank     int;
begin
  if me is null then
    return jsonb_build_object('reason', 'signed_out');
  end if;

  if lower(p_kind) = 'metric' and not public.bm_rankable_metric(p_key) then
    return jsonb_build_object('reason', 'not_rankable');
  end if;

  select coalesce(s.boards, true) into opted_in
  from public.user_profiles u
  left join public.athlete_sharing s on s.athlete_id = u.id
  where u.id = me;

  if not coalesce(opted_in, true) then
    return jsonb_build_object('reason', 'opted_out');
  end if;

  with pop as (
    select p.athlete_id from public.bm_population(me, p_scope) p
  ),
  who as (
    select u.id
    from public.user_profiles u
    join pop on pop.athlete_id = u.id
    where (p_age_groups is null or cardinality(p_age_groups) = 0
           or public.bm_age_group(u.date_of_birth) = any(p_age_groups))
      and (p_genders is null or cardinality(p_genders) = 0
           or upper(left(coalesce(u.gender, ''), 1)) = any (
                select upper(left(g, 1)) from unnest(p_genders) g))
  ),
  vals as (
    select w.id,
           case when p_lower_better then min(v.value) else max(v.value) end as value
    from who w
    join lateral (
      select r.mark as value
      from public.performances r
      where lower(p_kind) = 'performance'
        and r.user_id = w.id
        and r.mark is not null
        and coalesce(r.approval, 'accepted') = 'accepted'
        and lower(trim(r.discipline)) = lower(trim(p_key))
      union all
      select m.value
      from public.athlete_metrics m
      left join public.athlete_sharing ms on ms.athlete_id = m.athlete_id
      where lower(p_kind) = 'metric'
        and m.athlete_id = w.id
        and coalesce(m.approval, 'accepted') = 'accepted'
        and m.metric_key = p_key
        and (m.athlete_id = me or coalesce(ms.metrics, true))
    ) v on true
    group by w.id
  ),
  ranked as (
    select id, value,
           rank() over (order by case when p_lower_better then value end asc nulls last,
                                 case when p_lower_better then null else value end desc nulls last) as rk
    from vals
  )
  select (select count(*) from vals),
         (select value from ranked where id = me),
         (select rk    from ranked where id = me)
    into n_field, my_value, n_rank;

  if coalesce(n_field, 0) < min_field then
    return jsonb_build_object(
      'reason', 'too_few', 'field', coalesce(n_field, 0),
      'min_field', min_field, 'value', my_value);
  end if;

  if n_rank is null then
    return jsonb_build_object(
      'reason', 'no_result_of_your_own', 'field', n_field, 'min_field', min_field);
  end if;

  return jsonb_build_object(
    'rank', n_rank,
    'field', n_field,
    'value', my_value,
    'min_field', min_field,
    'band', case
      when n_rank::numeric / n_field <= 0.25 then 'top_quarter'
      when n_rank::numeric / n_field <= 0.50 then 'upper_half'
      when n_rank::numeric / n_field <= 0.75 then 'lower_half'
      else 'bottom_quarter' end
  );
end $$;

create or replace function public.board_scope_counts(
  p_kind       text,
  p_key        text,
  p_age_groups text[] default null,
  p_genders    text[] default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  out jsonb := '{}'::jsonb;
  s   text;
  n   int;
begin
  if me is null then return jsonb_build_object('reason', 'signed_out'); end if;
  if lower(p_kind) = 'metric' and not public.bm_rankable_metric(p_key) then
    return jsonb_build_object('reason', 'not_rankable');
  end if;

  foreach s in array array['squad','city','region','world'] loop
    select count(*) into n
    from public.bm_population(me, s) p
    join public.user_profiles u on u.id = p.athlete_id
    where (p_age_groups is null or cardinality(p_age_groups) = 0
           or public.bm_age_group(u.date_of_birth) = any(p_age_groups))
      and (p_genders is null or cardinality(p_genders) = 0
           or upper(left(coalesce(u.gender, ''), 1)) = any (
                select upper(left(g, 1)) from unnest(p_genders) g))
      and exists (
        select 1 from public.performances r
        where lower(p_kind) = 'performance' and r.user_id = u.id and r.mark is not null
          and coalesce(r.approval,'accepted') = 'accepted'
          and lower(trim(r.discipline)) = lower(trim(p_key))
        union all
        select 1 from public.athlete_metrics m
        left join public.athlete_sharing ms on ms.athlete_id = m.athlete_id
        where lower(p_kind) = 'metric' and m.athlete_id = u.id
          and coalesce(m.approval,'accepted') = 'accepted' and m.metric_key = p_key
          and (m.athlete_id = me or coalesce(ms.metrics, true))
      );
    out := out || jsonb_build_object(s, n);
  end loop;

  return out || jsonb_build_object('min_field', 5);
end $$;

revoke all on function public.board_position(text,text,text,boolean,text[],text[]) from public;
revoke all on function public.board_scope_counts(text,text,text[],text[]) from public;
grant execute on function public.board_position(text,text,text,boolean,text[],text[]) to authenticated;
grant execute on function public.board_scope_counts(text,text,text[],text[]) to authenticated;
