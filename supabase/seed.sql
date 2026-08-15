-- E2E seed — runs only via `supabase db reset` against the local/CI stack.
-- Inserts one deterministic user so the sign-in e2e flow has a returning user.
-- Never runs against the hosted project (hosted uses remote migrations only).

-- test user: e2e@lanyard.test / e2epass123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_sent_at, recovery_sent_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated', 'e2e@lanyard.test',
  crypt('e2epass123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now(),
  -- token/change columns must be empty strings, not NULL: GoTrue v2.195
  -- errors scanning NULL into strings and the /otp magic-link request 500s
  '', '', '', '', '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  created_at, updated_at, last_sign_in_at
) values (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'e2e@lanyard.test', 'email',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"e2e@lanyard.test","email_verified":true}',
  now(), now(), now()
)
on conflict (id) do nothing;

-- Fully onboarded profile so /app/* middlewares pass.
-- The on_auth_user_created trigger already made a bare profile row (NULL
-- onboarded_at) when auth.users was inserted above; upgrade it in place so the
-- onboarding middleware doesn't bounce the e2e user to /app/onboarding.
insert into public.profiles (
  user_id, email, nudge_channel, timezone, onboarded_at
) values (
  '11111111-1111-1111-1111-111111111111',
  'e2e@lanyard.test', 'email', 'UTC', now()
)
on conflict (user_id) do update set
  email = excluded.email,
  nudge_channel = excluded.nudge_channel,
  timezone = excluded.timezone,
  onboarded_at = excluded.onboarded_at;

-- Password-change user: the change-password e2e mutates its password, so it
-- must not be the same identity the sign-in/add-contact flows rely on.
-- pw@lanyard.test / pwpass123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_sent_at, recovery_sent_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'authenticated', 'authenticated', 'pw@lanyard.test',
  crypt('pwpass123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now(),
  -- token/change columns must be empty strings, not NULL: GoTrue v2.195
  -- errors scanning NULL into strings and the /otp magic-link request 500s
  '', '', '', '', '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  created_at, updated_at, last_sign_in_at
) values (
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  'pw@lanyard.test', 'email',
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"pw@lanyard.test","email_verified":true}',
  now(), now(), now()
)
on conflict (id) do nothing;

insert into public.profiles (
  user_id, email, nudge_channel, timezone, onboarded_at
) values (
  '22222222-2222-2222-2222-222222222222',
  'pw@lanyard.test', 'email', 'UTC', now()
)
on conflict (user_id) do update set
  email = excluded.email,
  nudge_channel = excluded.nudge_channel,
  timezone = excluded.timezone,
  onboarded_at = excluded.onboarded_at;
