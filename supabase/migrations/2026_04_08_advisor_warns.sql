-- ══════════════════════════════════════════════════════════════════════
-- ADVISOR WARN CLEANUP — function search_path + orphaned MV
-- ──────────────────────────────────────────────────────────────────────
-- Closes the following Supabase Security Advisor findings:
--   • function_search_path_mutable  (8 functions)
--   • materialized_view_in_api      (user_personal_bests)
--
-- Does NOT handle:
--   • extension_in_public (pg_trgm)   — see optional block at bottom
--   • auth_leaked_password_protection — dashboard toggle only
--
-- Idempotent. Safe to re-run.
-- ══════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────
-- 1. Pin search_path on all flagged functions.
--
-- A mutable search_path lets a hostile role with CREATE on another schema
-- shadow objects (tables, operators) that the function references
-- unqualified. Pinning it to `public, pg_temp` prevents that while still
-- letting the functions resolve everything they were written against.
--
-- We iterate by function NAME only (no argument signature) because some
-- functions may have been created with unknown arg lists. ALTER FUNCTION
-- by OID handles any signature.
-- ──────────────────────────────────────────────────────────────────────
do $$
declare
  fn text;
  targets text[] := array[
    'update_updated_at',
    'touch_athlete_profiles_updated_at',
    'check_and_set_pr',
    'refresh_user_pbs',
    'search_athletes',
    'get_career_trajectory',
    'find_similar_athletes',
    'populate_season_bests'
  ];
  proc_oid oid;
begin
  foreach fn in array targets loop
    for proc_oid in
      select p.oid
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname = fn
    loop
      execute format(
        'alter function %s set search_path = public, pg_temp;',
        proc_oid::regprocedure
      );
    end loop;
  end loop;
end $$;

-- ──────────────────────────────────────────────────────────────────────
-- 2. Orphaned materialized view — revoke API access.
--
-- `user_personal_bests` is not referenced anywhere in the frontend or the
-- backend code. Revoking SELECT from anon + authenticated stops it being
-- reachable via PostgREST / the Data API. If a future feature needs it,
-- prefer a regular view or a SECURITY INVOKER function so RLS can gate it.
-- ──────────────────────────────────────────────────────────────────────
revoke all on public.user_personal_bests from anon;
revoke all on public.user_personal_bests from authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ══════════════════════════════════════════════════════════════════════

-- a) Confirm every flagged function now has a pinned search_path.
--    Expected: 8 rows, config showing `search_path=public, pg_temp`.
select
  p.proname                          as function_name,
  p.proconfig                        as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'update_updated_at','touch_athlete_profiles_updated_at','check_and_set_pr',
    'refresh_user_pbs','search_athletes','get_career_trajectory',
    'find_similar_athletes','populate_season_bests'
  )
order by p.proname;

-- b) Confirm the orphaned MV can no longer be read by anon/authenticated.
--    Expected: 0 rows for each role.
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name   = 'user_personal_bests'
   and grantee      in ('anon','authenticated');

-- ══════════════════════════════════════════════════════════════════════
-- OPTIONAL — extension_in_public (pg_trgm)
-- ──────────────────────────────────────────────────────────────────────
-- Moving pg_trgm out of `public` is Supabase's recommended posture, but
-- any database function or query that uses trigram operators (`%`, `<->`,
-- `similarity(...)`) without qualification will break. The backend API
-- code in this repo uses only plain ILIKE and does not reference pg_trgm
-- directly, BUT the `search_athletes` SQL function might.
--
-- To move it safely:
--   1. Run the block below.
--   2. Smoke-test the athlete search flow on the live site.
--   3. If search breaks, roll back by moving pg_trgm back to public.
--
-- Uncomment to apply:
--
-- create schema if not exists extensions;
-- grant usage on schema extensions to anon, authenticated, service_role;
-- alter extension pg_trgm set schema extensions;
-- ══════════════════════════════════════════════════════════════════════
