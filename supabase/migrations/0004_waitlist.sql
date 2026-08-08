-- Early-access waitlist. Public marketing surface: emails land here via the
-- Nitro route, which writes with the service role. RLS is enabled with no
-- public policies (anon rows are never readable; writes go through the service
-- role, which bypasses RLS). Mirrors the "any new table gets RLS" rule.
create table if not exists public.waitlist (
  id         bigint generated always as identity primary key,
  email      text not null unique,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;