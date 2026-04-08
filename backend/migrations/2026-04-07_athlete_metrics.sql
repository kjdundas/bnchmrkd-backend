-- Athlete metrics table — strength / speed / power / mobility / endurance / anthropometrics
-- Run in the Supabase SQL editor. Idempotent.

create table if not exists public.athlete_metrics (
  id            bigserial primary key,
  athlete_id    uuid        not null references auth.users(id) on delete cascade,
  category      text        not null check (category in
                              ('strength','speed','power','mobility','endurance','anthropometrics')),
  metric_key    text        not null,
  metric_label  text        not null,
  unit          text        not null,
  value         numeric     not null,
  recorded_at   date        not null,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists athlete_metrics_athlete_idx
  on public.athlete_metrics (athlete_id, recorded_at desc);

create index if not exists athlete_metrics_metric_idx
  on public.athlete_metrics (athlete_id, category, metric_key, recorded_at desc);

-- Row-level security: athletes can only see/write their own rows
alter table public.athlete_metrics enable row level security;

drop policy if exists "athlete_metrics_select_own" on public.athlete_metrics;
create policy "athlete_metrics_select_own"
  on public.athlete_metrics for select
  using (auth.uid() = athlete_id);

drop policy if exists "athlete_metrics_insert_own" on public.athlete_metrics;
create policy "athlete_metrics_insert_own"
  on public.athlete_metrics for insert
  with check (auth.uid() = athlete_id);

drop policy if exists "athlete_metrics_update_own" on public.athlete_metrics;
create policy "athlete_metrics_update_own"
  on public.athlete_metrics for update
  using (auth.uid() = athlete_id);

drop policy if exists "athlete_metrics_delete_own" on public.athlete_metrics;
create policy "athlete_metrics_delete_own"
  on public.athlete_metrics for delete
  using (auth.uid() = athlete_id);
