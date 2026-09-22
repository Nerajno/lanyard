-- H5: failed sends must not consume the daily nudge cap.
-- The sender inserts a row as 'pending' before the provider call (the act-link
-- needs the real nudge id), then marks 'sent' + provider id on success or
-- 'failed' on throw. The cron's double-send guard counts only 'sent' rows, so
-- a failed send is retried next pass instead of suppressing the user for 26h.
alter table public.nudges
  add column if not exists delivery_status text not null default 'sent'
    check (delivery_status in ('pending', 'sent', 'failed'));

comment on column public.nudges.delivery_status is 'pending (before provider call) | sent | failed. Only sent rows count toward the daily-cap guard.';