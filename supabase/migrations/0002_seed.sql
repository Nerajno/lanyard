-- Lanyard — seed data for local testing.
-- IDs reference a fixed auth uuid so feels authentic locally. Safe to delete; not used in prod.

insert into public.profiles (user_id, email, nudge_channel, timezone)
values
  ('00000000-0000-0000-0000-000000000001', 'ted@example.com', 'email', 'America/New_York')
on conflict (user_id) do nothing;

insert into public.contacts
  (id, user_id, name, how_met, email, cadence_ladder, follow_up_by, status)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Ada Lovelace', 'Met at the analytics track after her lightning talk.', 'ada@example.com',
   '{2,14,45}', (now()::date + 2), 'active'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Grace Hopper', 'Compiler author; shared a demo on Fortran.',                   'grace@example.com',
   '{2,14,45}', (now()::date - 1), 'active'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'Alan Turing', 'Discussed the session on computability.',                      'alan@example.com',
   '{2,14,45}', (now()::date - 5), 'graduated')
on conflict (id) do nothing;