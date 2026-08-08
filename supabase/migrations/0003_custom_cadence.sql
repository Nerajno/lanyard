-- Custom cadence: rungs in minutes/hours/days + one-shot quick nudge.

-- Postgres forbids subqueries in ALTER COLUMN ... USING transform expressions,
-- so the int[] -> jsonb backfill runs through a temporary SQL function.

create function public._ladder_int_to_rungs(ladder int[])
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (select jsonb_agg(jsonb_build_object('value', v, 'unit', 'day') order by ord)
     from unnest(ladder) with ordinality as t(v, ord)),
    '[]'::jsonb
  );
$$;

-- cadence_ladder int[] -> jsonb (rung structs), preserving existing day data.
alter table public.contacts
  alter column cadence_ladder drop default;

-- Drop the int[]-specific CHECK before the type swing; re-add as jsonb below.
alter table public.contacts
  drop constraint if exists contacts_ladder_positive;

alter table public.contacts
  alter column cadence_ladder type jsonb
  using public._ladder_int_to_rungs(cadence_ladder);

drop function public._ladder_int_to_rungs(int[]);

alter table public.contacts
  alter column cadence_ladder set default
    '[{"value":2,"unit":"day"},{"value":14,"unit":"day"},{"value":45,"unit":"day"}]'::jsonb;

alter table public.contacts
  add constraint contacts_ladder_positive
  check (jsonb_array_length(cadence_ladder) > 0);

-- follow_up_by date -> timestamptz, preserving midnight-UTC semantics for old rows.
alter table public.contacts
  alter column follow_up_by type timestamptz
  using (follow_up_by::timestamp at time zone 'UTC');

-- One-shot quick nudge; cleared when it fires. Covered by existing RLS.
alter table public.contacts
  add column if not exists remind_at timestamptz;

create index if not exists contacts_user_active_remind
  on public.contacts (user_id, status, remind_at);

comment on column public.contacts.cadence_ladder is 'Rungs {value,unit} in min|hour|day.';
comment on column public.contacts.remind_at is 'One-shot quick nudge; cleared after it fires.';
