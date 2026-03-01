-- ============================================================
-- RentCircle — Auto-create profile on user signup
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- This is a SAFETY NET — profiles are also written by the app
-- ============================================================

-- Function: called whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id,
    name,
    email,
    phone,
    city,
    plan,
    status,
    rentals,
    joined,
    email_verified,
    phone_verified
  ) values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'city', ''),
    'None',
    'active',
    0,
    to_char(now(), 'Mon YYYY'),
    false,
    false
  )
  on conflict (email) do update set
    email_verified = coalesce(excluded.email_verified, profiles.email_verified);

  return new;
end;
$$ language plpgsql security definer;

-- Trigger: fires after every new user in auth.users
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- ── Grant write access to profiles for anon key ──────────────
-- (skip if you already ran admin-write-policies.sql)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'profiles' and policyname = 'anon write profiles'
  ) then
    execute 'create policy "anon write profiles" on profiles for all using (true) with check (true)';
  end if;
end $$;
