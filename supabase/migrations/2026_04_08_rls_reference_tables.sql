-- ══════════════════════════════════════════════════════════════════════
-- RLS HARDENING — REFERENCE / HISTORICAL TABLES
-- ──────────────────────────────────────────────────────────────────────
-- Closes the Supabase Security Advisor finding `rls_disabled_in_public`
-- for the historical Olympic / benchmarks corpus.
--
-- All 12 tables below are READ-ONLY reference data that the frontend
-- reads at runtime to compute percentiles, projections, and Olympic
-- comparisons. They contain NO user PII — only historical athlete
-- performances, lookup tables, and model coefficients.
--
-- Strategy:
--   1. Enable RLS on every table
--   2. Add a single SELECT policy for anon + authenticated
--   3. Do NOT create any INSERT / UPDATE / DELETE policies — so writes
--      from the client are blocked entirely. Only the service_role
--      (which bypasses RLS) can modify these tables, which is correct:
--      they are populated by backend scripts, not by users.
--
-- Idempotent: safe to re-run. Uses DROP POLICY IF EXISTS + CREATE POLICY
-- and ENABLE ROW LEVEL SECURITY (which is a no-op if already enabled).
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  targets text[] := array[
    'age_percentile_benchmarks',
    'athletes',
    'disciplines',
    'improvement_norms',
    'model_calibration',
    'model_coefficients',
    'olympic_results',
    'personal_bests',
    'race_results',
    'roc_thresholds',
    'season_bests',
    'trajectory_clusters'
  ];
begin
  foreach t in array targets loop
    -- 1. Enable RLS
    execute format('alter table public.%I enable row level security;', t);

    -- 2. Drop any prior public-read policy so this block is idempotent
    execute format('drop policy if exists %I on public.%I;',
                   'public_read_' || t, t);

    -- 3. Recreate a single SELECT-only policy for anon + authenticated
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true);',
      'public_read_' || t, t
    );
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════════════
-- VERIFICATION — run this to confirm every target now has RLS on
-- and exactly one SELECT policy. Expected: 12 rows, rls_enabled = true,
-- policy_count = 1.
-- ══════════════════════════════════════════════════════════════════════
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*)
     from pg_policies p
    where p.schemaname = 'public'
      and p.tablename  = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'age_percentile_benchmarks','athletes','disciplines','improvement_norms',
    'model_calibration','model_coefficients','olympic_results','personal_bests',
    'race_results','roc_thresholds','season_bests','trajectory_clusters'
  )
order by c.relname;
