-- Lot E.2 — Admin product CRUD RPCs (no price modification).
--
-- Two SECURITY DEFINER RPCs that let an admin patch a product row or hard-
-- delete it. Same hardening pattern as the dashboard RPCs (see migration
-- 20260619210000):
--
--   1. `if not public.is_admin() then raise 42501` first thing in the body.
--   2. `set search_path = ''` so a session-scoped path cannot shadow
--      is_admin() / the products table.
--   3. Default PG `EXECUTE` grant revoked from `public, anon`; granted
--      to `authenticated, service_role`. The grant blocks anon only; the
--      admin/client split is enforced by (1) inside the function.
--
-- The existing `products_public_read` policy is NOT touched — the
-- catalogue stays world-readable. No write policy is ever added on
-- `public.products` for `authenticated`, so a direct UPDATE / DELETE
-- from a logged-in client is rejected by RLS. Admins can only mutate
-- via these RPCs.
--
-- Prices are deliberately out of scope: changing `public.prices.unit_amount`
-- requires creating a NEW Stripe Price (Stripe Price objects are immutable)
-- and rotating `prices.stripe_price_id`, which needs the Stripe SDK in a
-- Next.js route handler. A dedicated lot will cover it.

create or replace function public.admin_update_product(
  p_id           uuid,
  p_name         jsonb   default null,
  p_description  jsonb   default null,
  p_specs        jsonb   default null,
  p_availability text    default null,
  p_priority     integer default null,
  p_is_featured  boolean default null,
  p_is_active    boolean default null,
  p_category_id  uuid    default null
) returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.products;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  if p_name is not null then
    if jsonb_typeof(p_name) <> 'object' then
      raise exception 'name must be a JSON object' using errcode = '22023';
    end if;
    if coalesce(p_name->>'fr', p_name->>'en', '') = '' then
      raise exception 'name must contain a non-empty fr or en key'
        using errcode = '22023';
    end if;
  end if;

  if p_description is not null and jsonb_typeof(p_description) <> 'object' then
    raise exception 'description must be a JSON object' using errcode = '22023';
  end if;

  if p_specs is not null and jsonb_typeof(p_specs) <> 'object' then
    raise exception 'specs must be a JSON object' using errcode = '22023';
  end if;

  if p_availability is not null
     and p_availability not in ('in_stock', 'limited', 'out_of_stock') then
    raise exception 'availability must be one of in_stock, limited, out_of_stock'
      using errcode = '22023';
  end if;

  if p_priority is not null and (p_priority < 0 or p_priority > 1000) then
    raise exception 'priority must be between 0 and 1000' using errcode = '22023';
  end if;

  update public.products
     set name         = coalesce(p_name,                                   name),
         description  = coalesce(p_description,                            description),
         specs        = coalesce(p_specs,                                  specs),
         availability = coalesce(p_availability::public.stock_status,      availability),
         priority     = coalesce(p_priority,                               priority),
         is_featured  = coalesce(p_is_featured,                            is_featured),
         is_active    = coalesce(p_is_active,                              is_active),
         category_id  = coalesce(p_category_id,                            category_id)
   where id = p_id
   returning * into v_row;

  if not found then
    raise exception 'product % not found', p_id using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

create or replace function public.admin_delete_product(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  delete from public.products where id = p_id;

  if not found then
    raise exception 'product % not found', p_id using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.admin_update_product(
  uuid, jsonb, jsonb, jsonb, text, integer, boolean, boolean, uuid
) from public, anon;
revoke execute on function public.admin_delete_product(uuid) from public, anon;

grant  execute on function public.admin_update_product(
  uuid, jsonb, jsonb, jsonb, text, integer, boolean, boolean, uuid
) to authenticated, service_role;
grant  execute on function public.admin_delete_product(uuid) to authenticated, service_role;
