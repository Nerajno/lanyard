-- Lanyard — Phase 1 schema
-- Creates tables, types, RLS. Mirrors project_docs/Architecture.md §Data model.
-- RLS is enabled and defined in the same migration as each table (never a follow-up commit).

-- Extensions
create extension if not exists pgcrypto; -- gen_random_uuid()

-- =============================================================================
-- PROFILES — where the nudge goes. Without this the loop has no recipient.
-- =============================================================================
create table if not exists public.profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  phone            text,                                  -- E.164, nullable until verified
  phone_verified_at timestamptz,
  email            text,                                  -- mirrored from auth.users
  nudge_channel    text not null default 'email'
                   check (nudge_channel in ('sms', 'email', 'both')),
  timezone         text not null default 'UTC',           -- IANA name
  quiet_hours_start smallint not null default 21,         -- local hour (0-23) quiet window starts
  quiet_hours_end   smallint not null default 9,          -- local hour (0-23) quiet window ends (wrap = next day)
  check (quiet_hours_start between 0 and 23),
  check (quiet_hours_end between 0 and 23),
  sms_opt_in_at    timestamptz,                            -- required before any SMS
  sms_opted_out_at timestamptz,                            -- set by STOP; hard block sends
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is 'User preferences and the destination for the nudge loop.';
comment on column public.profiles.nudge_channel is 'sms | email | both';
comment on column public.profiles.sms_opt_in_at is 'Required before any SMS is sent.';
comment on column public.profiles.sms_opted_out_at is 'Set by STOP webhook; hard block on all sends.';

-- =========================================================================
-- contacts
-- =========================================================================
create table if not exists public.contacts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null,
  how_met          text not null,           -- used verbatim in the nudge
  email            text,
  phone            text,                    -- E.164
  cadence_ladder   int[] not null default '{2,14,45}',  -- the three coffees
  touchpoints_done int  not null default 0 check (touchpoints_done >= 0),
  follow_up_by     date not null,           -- created_at + cadence_ladder[touchpoints_done + 1]
  status           text not null default 'active'
                   check (status in ('active', 'graduated', 'archived')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Every contact must be reachable or its nudge is dead on arrival.
  constraint contacts_one_reachable_channel check (email is not null or phone is not null),
  constraint contacts_ladder_positive check (cardinality(cadence_ladder) > 0)
);

comment on column public.contacts.how_met is 'Used verbatim in the nudge.';
comment on column public.contacts.cadence_ladder is 'Recurring rungs in days; 3 = graduated.';
comment on column public.contacts.status is 'active | graduated | archived';

-- =========================================================================
-- nudges — instrumentation for the one metric that matters (nudge→act latency)
-- =========================================================================
create table if not exists public.nudges (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  contact_ids         uuid[] not null,     -- length 1 = direct, >1 = digest
  channel             text not null check (channel in ('sms', 'email')),
  sent_at             timestamptz not null default now(),
  opened_at           timestamptz,          -- act-link clicked
  acted_at            timestamptz,          -- touchpoint marked done
  provider_message_id text,                 -- Twilio SID / email id, for debugging
  created_at          timestamptz not null default now()
);

comment on table public.nudges is 'Instrumentation: latency = acted_at - sent_at. Cannot be backfilled.';
comment on column public.nudges.contact_ids is 'Length 1 = direct nudge; >1 = digest.';

-- =========================================================================
-- Indexes
-- =========================================================================
create index if not exists contacts_user_active_due
  on public.contacts (user_id, status, follow_up_by);
create index if not exists nudges_user_sent
  on public.nudges (user_id, sent_at);
create index if not exists nudges_contact
  on public.nudges using gin (contact_ids);

-- =========================================================================
-- RLS — user_id = auth.uid() on all CRUD, all three tables
-- =========================================================================
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.nudges  enable row level security;

-- profiles
create policy "profiles_select_own" on public.profiles for select using (user_id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles for insert with check (user_id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- contacts
create policy "contacts_select_own" on public.contacts for select using (user_id = (select auth.uid()));
create policy "contacts_insert_own" on public.contacts for insert with check (user_id = (select auth.uid()));
create policy "contacts_update_own" on public.contacts for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "contacts_delete_own" on public.contacts for delete using (user_id = (select auth.uid()));

-- nudges
create policy "nudges_select_own" on public.nudges for select using (user_id = (select auth.uid()));
create policy "nudges_insert_own"  on public.nudges for insert with check (user_id = (select auth.uid()));
create policy "nudges_update_own"  on public.nudges for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- No delete policy on nudges: they are permanent instrumentation.

-- =========================================================================
-- Trigger: mirror profiles.email from auth.users.email on insert/update,
-- and auto-create a profile row when a user signs up.
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at helper for the three tables
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute procedure public.touch_updated_at();

drop trigger if exists contacts_touch on public.contacts;
create trigger contacts_touch before update on public.contacts
  for each row execute procedure public.touch_updated_at();

drop trigger if exists nudges_touch on public.nudges;
create trigger nudges_touch before update on public.nudges
  for each row execute procedure public.touch_updated_at();