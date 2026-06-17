-- Lot B sub-step 1 — Auth profiles + trigger + RLS.
-- Mirrors modele-donnees-CYNA.md Domaine 1 (profiles) + §4 (RLS) +
-- §1 décision #2: Supabase Auth owns the password, no hash maison.
--
-- Strict scope: profiles table, new-user trigger, is_admin helper, RLS
-- on profiles, anti-privilege-escalation column grants. NO touch on the
-- application code (AuthContext, gardes, auth.ts) — that lands in
-- sub-step 2.

-- ---------------------------------------------------------------------------
-- user_role enum
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('client', 'admin');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- profiles — extends auth.users with app-level metadata only.
-- The email and the password live in auth.users; we never duplicate them.
-- stripe_customer_id arrives with the Stripe lot.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid             primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       public.user_role not null default 'client',
  is_active  boolean          not null default true,
  created_at timestamptz      not null default now(),
  updated_at timestamptz      not null default now()
);

comment on table public.profiles is
  'Per-user profile rolled out alongside auth.users. Email and password
   stay in auth.users; profiles only carries app-level metadata (role,
   full_name, is_active).';

-- public.set_updated_at() is already defined by the Lot A migration.
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- handle_new_user() — auto-create a profile row on signUp.
--
-- SECURITY DEFINER because the trigger fires on auth.users (writable only
-- by the auth-admin role) and must write to public.profiles. We lock
-- search_path to '' and fully qualify every reference with `public.*` to
-- close the schema-hijack class of attacks against SECURITY DEFINER
-- functions.
--
-- If the profile insert fails, the auth.users insert rolls back too
-- (same transaction) — we want signUp to surface the error rather than
-- leaving an auth account orphaned with no profile.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- is_admin() — fast role check usable inside RLS policies WITHOUT
-- triggering recursive evaluation on profiles.
--
-- STABLE so Postgres can cache the result within a statement.
-- SECURITY DEFINER lets the function read profiles while RLS is enforcing
-- the caller's policies on the same table — owned by the migration role
-- (postgres / supabase_admin, both BYPASSRLS), so the inner SELECT is
-- not subject to recursion.
-- search_path locked, same reasoning as handle_new_user.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security on profiles
--
--   SELECT  : owner sees self; admin sees all.
--   UPDATE  : owner can update their own row, subject to the column grants
--             below (which prevent role / is_active self-mutation).
--
--   No INSERT policy: profiles are created exclusively by
--   handle_new_user(); admin-side tooling writes via service_role which
--   bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_self_or_admin_read on public.profiles;
drop policy if exists profiles_self_update        on public.profiles;

create policy profiles_self_or_admin_read
  on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.is_admin());

create policy profiles_self_update
  on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Anti-privilege-escalation column grants.
--
-- RLS is row-level only — without column-level grants, a user passing the
-- (auth.uid() = id) predicate could still set role = 'admin' on their
-- own row. Revoking table-wide UPDATE and granting it back only on
-- full_name closes that gap at the SQL grant layer, independent of any
-- future policy mistake.
--
-- INSERT and DELETE are also explicitly revoked from authenticated —
-- profiles are created by the trigger and never deleted by the user
-- (auth.users ON DELETE CASCADE handles cleanup when the auth account
-- is removed via service_role / admin tooling).
-- ---------------------------------------------------------------------------
revoke update on public.profiles from authenticated;
revoke insert, delete on public.profiles from authenticated;

grant update (full_name) on public.profiles to authenticated;
