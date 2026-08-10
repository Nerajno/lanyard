-- Shares: per-capture, one-time, expiring tokens for /share/:token.
-- Claim happens only in server routes with the service-role client (RLS intact).

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

create table if not exists public.shares (
  id               text primary key,                      -- the /share/:token value
  user_id          uuid not null references auth.users (id) on delete cascade,
  how_met_default  text,
  expires_at       timestamptz not null,
  used_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists shares_user on public.shares (user_id);
create index if not exists shares_expires on public.shares (expires_at);

alter table public.shares enable row level security;

create policy "shares_select_own" on public.shares
  for select using (user_id = (select auth.uid()));
create policy "shares_insert_own" on public.shares
  for insert with check (user_id = (select auth.uid()));
create policy "shares_delete_own" on public.shares
  for delete using (user_id = (select auth.uid()));

comment on column public.profiles.onboarded_at is 'Set by onboarding save; null = not onboarded.';
comment on column public.shares.used_at is 'Null until a stranger claims the link (one-time use).';