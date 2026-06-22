-- Tighten public.set_updated_at: lock search_path to '' and qualify the
-- now() call as pg_catalog.now() so a malicious schema cannot shadow the
-- built-in. Same hardening that is_admin(), handle_new_user(), and the
-- admin_* RPCs already apply.
--
-- CREATE OR REPLACE keeps the existing triggers (categories, products,
-- carousel_slides, profiles, addresses, orders, subscriptions) attached
-- and valid -- they reference the function by name, not by oid. Behaviour
-- on UPDATE is byte-identical: new.updated_at = now() (transaction-start
-- timestamp from pg_catalog).
--
-- Linter target: Supabase Advisor warning 0011 (function_search_path_mutable).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;
