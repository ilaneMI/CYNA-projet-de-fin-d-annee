-- Admin visibility on soft-deleted products.
--
-- Before this migration, the only SELECT policy on public.products was
-- `products_public_read using (is_active)`, which gates EVERY caller --
-- anon, client, admin -- to rows where is_active = true. That made the
-- admin /admin "Gestion des produits" view unable to display soft-
-- deleted rows, so an admin could not re-activate a product they had
-- just disabled.
--
-- Add a second SELECT policy conditioned on public.is_admin(). PG
-- OR-combines SELECT policies, so:
--   - non-admin -> still gated by products_public_read (is_active=true
--     only). No behavioural change for anon or client sessions.
--   - admin     -> matches the new admin policy too, so they see every
--     row regardless of is_active. The catalogue / catalogue listing
--     stays unchanged because it uses the same caller session -- the
--     filter is applied in JS by getProducts (no includeInactive).
--
-- The public policy is NOT modified. is_admin() already has
-- `set search_path = ''` so the new policy inherits a safe lookup.
-- No write policy is added -- admin mutations still go through the
-- admin_update_product / admin_delete_product RPCs.
--
-- KNOWN LIMIT: public.prices keeps its `prices_public_read using
-- (is_active)` policy. An admin looking at a soft-deleted product
-- whose prices were also marked inactive will see the product but
-- not the price rows. Acceptable here -- the goal is to let admin
-- re-activate the product. Inactive prices will be addressed in the
-- Stripe-aware price-edit lot.

drop policy if exists products_admin_read on public.products;

create policy products_admin_read
  on public.products
  for select to authenticated
  using (public.is_admin());
