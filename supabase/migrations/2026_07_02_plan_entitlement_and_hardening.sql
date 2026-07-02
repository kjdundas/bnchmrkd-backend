-- 2026-07-02: Pro plan entitlement (AI Scanner paywall) + security hardening.
-- Applied to production via MCP on 2026-07-02; kept here for the migration record.

-- ── Pro plan entitlement ─────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists plan text not null default 'free';

alter table public.user_profiles
  drop constraint if exists user_profiles_plan_check;
alter table public.user_profiles
  add constraint user_profiles_plan_check check (plan in ('free','pro'));

-- Users must NOT be able to upgrade themselves through the REST API.
-- user_profiles has a self-update RLS policy, so without this trigger a user
-- could PATCH their own plan to 'pro'. Only privileged DB roles may change it.
create or replace function public.protect_plan_column()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.plan is distinct from old.plan
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    new.plan := old.plan;  -- silently keep the old value
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_plan on public.user_profiles;
create trigger trg_protect_plan
  before update on public.user_profiles
  for each row execute function public.protect_plan_column();

-- ── Hardening from the 2026-07-02 security audit ─────────────────────────
-- M2: anon should not be able to execute coach RPCs (defense-in-depth)
revoke execute on function public.get_coach_feed() from anon;
revoke execute on function public.get_linked_athletes() from anon;

-- M5: pin search_path on find_similar_athletes (both overloads)
alter function public.find_similar_athletes(character varying, numeric, integer, integer)
  set search_path = public, pg_temp;
alter function public.find_similar_athletes(character varying, numeric, integer, integer, numeric)
  set search_path = public, pg_temp;
