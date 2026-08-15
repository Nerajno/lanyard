-- Base table privileges for the API roles.
-- RLS policies decide WHICH rows each role may touch; without these GRANTs
-- PostgREST 403s every query ("permission denied for table ...") regardless
-- of policy. The dashboard adds grants automatically for UI-created tables;
-- tables created via raw SQL migrations must grant them explicitly.

-- authenticated — client-side, every read/write is RLS-scoped to auth.uid().
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update on public.nudges to authenticated;
grant select, insert, delete on public.shares to authenticated;

-- service_role — server-side admin client (useSupabaseAdmin); bypasses RLS.
grant all on public.profiles, public.contacts, public.nudges, public.shares,
  public.waitlist, public.sms_suppressions, public.account_deletions
  to service_role;

-- Identity sequences back the generated-always columns; the inserting role
-- still needs usage so the server-side writes don't fail.
grant usage, select on sequence public.waitlist_id_seq to service_role;
grant usage, select on sequence public.sms_suppressions_id_seq to service_role;