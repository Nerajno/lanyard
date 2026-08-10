-- Account deletion: SMS suppression + grace-window ledger.
-- RLS enabled with NO public policies; only the server-side service-role client
-- (useSupabaseAdmin) reads/writes these tables. Mirrors the waitlist pattern.

-- ---------------------------------------------------------------------
-- sms_suppressions — numbers to never text again, retained indefinitely.
-- Holds only a SHA-256 of the normalized E.164, never the raw number.
-- Never cascade-deleted and deliberately has NO FK: it must outlive
-- auth.users so a recycled number is never texted after the account dies.
-- ---------------------------------------------------------------------
create table if not exists public.sms_suppressions (
  id          bigint generated always as identity primary key,
  phone_hash  text not null unique,
  reason      text not null default 'opted_out',
  created_at  timestamptz not null default now()
);

comment on table public.sms_suppressions is 'Hashed numbers to never text again (indefinite retention).';

alter table public.sms_suppressions enable row level security;

-- ---------------------------------------------------------------------
-- account_deletions — grace-window ledger.
-- Keyed on the REAL (normalized) email because GoTrue obfuscates
-- auth.users.email on soft delete; this is the only place undo/purge can
-- find the account. No FK to auth.users on purpose: the row is the audit
-- record and must outlive the purge.
-- ---------------------------------------------------------------------
create table if not exists public.account_deletions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  email         text not null,
  requested_at  timestamptz not null default now(),
  purge_at      timestamptz not null,      -- requested_at + 14 days
  purged_at     timestamptz,               -- set by the purge job (hard delete done)
  superseded_at timestamptz                -- set by undo (restoration won)
);

create index if not exists account_deletions_email on public.account_deletions (email);
create index if not exists account_deletions_purge on public.account_deletions (purge_at)
  where purged_at is null and superseded_at is null;

comment on table public.account_deletions is 'Grace-window ledger for account deletion; rows outlive the auth user.';
comment on column public.account_deletions.purge_at is 'Hard-purge time = requested_at + 14 days.';

alter table public.account_deletions enable row level security;