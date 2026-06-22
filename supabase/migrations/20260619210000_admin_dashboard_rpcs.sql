-- Lot E — Admin dashboard aggregates.
--
-- Four SECURITY DEFINER read-only RPCs that aggregate ALL paid orders /
-- order_items / products / categories for the admin dashboard. They
-- bypass RLS so they can see every customer's data — that is exactly
-- the privilege we are gating.
--
-- Layered authorisation:
--
--   1. Inside each function, the FIRST statement is
--        `if not public.is_admin() then raise exception ... end if;`
--      which short-circuits and fails closed for any non-admin caller.
--      THIS IS THE ONLY LAYER THAT DISTINGUISHES ADMIN FROM CLIENT —
--      `authenticated` covers every logged-in user, admin or not, and
--      the grant below does NOT discriminate between them.
--   2. `revoke execute ... from public, anon` removes the default PG
--      grant; we then grant to `authenticated` and `service_role`.
--      This blocks only anonymous callers. Logged-in non-admin clients
--      WOULD reach the function body — they are stopped by (1), not
--      by this grant. The grant layer is necessary (no anon revenue
--      leak) but not sufficient on its own.
--
-- search_path = '' is therefore load-bearing: without it, a malicious
-- search_path could shadow `public.is_admin()` and bypass layer (1).
--
-- The RLS on public.orders / public.order_items is NOT touched: the
-- client-isolation policy `orders_owner_select` stays exactly as it
-- is. Admin reads now have two distinct paths:
--   - row-level: the existing `auth.uid() = user_id OR is_admin()`
--     SELECT policy (used by /admin orders list).
--   - aggregated: these RPCs (used by /admin dashboard).

-- ---------------------------------------------------------------------------
-- admin_daily_sales(p_days int)
--   Daily revenue in cents for the last `p_days` whole days (UTC),
--   counting only orders where status = 'paid'. Days with no sales
--   are returned with amount_cents = 0 so the bar chart has a
--   continuous x-axis.
-- ---------------------------------------------------------------------------
create or replace function public.admin_daily_sales(p_days int default 7)
returns table (day date, amount_cents bigint)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'p_days must be between 1 and 365' using errcode = '22023';
  end if;

  return query
  with span as (
    select generate_series(
      (current_date - (p_days - 1))::date,
      current_date,
      interval '1 day'
    )::date as day
  ),
  daily as (
    select (created_at at time zone 'UTC')::date as day,
           sum(total_amount)::bigint            as amount_cents
      from public.orders
     where status = 'paid'
       and created_at >= (current_date - (p_days - 1))::timestamptz
     group by 1
  )
  select s.day, coalesce(d.amount_cents, 0)::bigint
    from span s
    left join daily d on d.day = s.day
   order by s.day asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_category_shares(p_days int)
--   Sum of order_items.line_total per category over the last `p_days`,
--   joined to products and categories, with the share of the total. FR
--   name pulled from the i18n jsonb with EN / slug fallbacks. Orphaned
--   items (product_id is null because the product was deleted) and items
--   on orders that are not 'paid' are excluded.
-- ---------------------------------------------------------------------------
create or replace function public.admin_category_shares(p_days int default 7)
returns table (
  category_id   uuid,
  category_name text,
  amount_cents  bigint,
  share         numeric
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_total bigint;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'p_days must be between 1 and 365' using errcode = '22023';
  end if;

  select coalesce(sum(oi.line_total), 0)::bigint
    into v_total
    from public.order_items oi
    join public.orders      o on o.id = oi.order_id
   where o.status = 'paid'
     and o.created_at >= (current_date - (p_days - 1))::timestamptz;

  return query
  select
    c.id,
    coalesce(c.name->>'fr', c.name->>'en', c.slug::text) as category_name,
    sum(oi.line_total)::bigint                            as amount_cents,
    case
      when v_total = 0 then 0::numeric
      else round((sum(oi.line_total)::numeric / v_total::numeric), 4)
    end                                                   as share
    from public.order_items oi
    join public.orders      o on o.id = oi.order_id
    join public.products    p on p.id = oi.product_id
    join public.categories  c on c.id = p.category_id
   where o.status = 'paid'
     and o.created_at >= (current_date - (p_days - 1))::timestamptz
   group by c.id, c.name, c.slug
   order by amount_cents desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_category_average_baskets(p_days int)
--   AVG(unit_amount) per (category, billing_interval, unit_type) over
--   paid orders in the last `p_days`. Pivoted to one row per category
--   with monthly_cents / annual_cents / per_user_cents columns to match
--   the stacked-bar chart's expected shape. NULL when the bucket is empty.
-- ---------------------------------------------------------------------------
create or replace function public.admin_category_average_baskets(p_days int default 7)
returns table (
  category_id    uuid,
  category_name  text,
  monthly_cents  integer,
  annual_cents   integer,
  per_user_cents integer
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'p_days must be between 1 and 365' using errcode = '22023';
  end if;

  return query
  select
    c.id,
    coalesce(c.name->>'fr', c.name->>'en', c.slug::text)                                                  as category_name,
    avg(oi.unit_amount) filter (where oi.billing_interval = 'monthly' and oi.unit_type = 'flat')::integer as monthly_cents,
    avg(oi.unit_amount) filter (where oi.billing_interval = 'annual'  and oi.unit_type = 'flat')::integer as annual_cents,
    avg(oi.unit_amount) filter (where oi.unit_type = 'per_user')::integer                                 as per_user_cents
    from public.order_items oi
    join public.orders      o on o.id = oi.order_id
    join public.products    p on p.id = oi.product_id
    join public.categories  c on c.id = p.category_id
   where o.status = 'paid'
     and o.created_at >= (current_date - (p_days - 1))::timestamptz
   group by c.id, c.name, c.slug
   order by category_name asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_dashboard_kpis(p_days int)
--   Single-row KPI snapshot: total revenue, paid-orders count, active
--   subscriptions count (active + trialing — past_due is excluded
--   because Stripe is still retrying the charge and the revenue is NOT
--   booked), average basket (revenue / paid orders, NULL when no orders).
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_kpis(p_days int default 7)
returns table (
  revenue_cents              bigint,
  paid_orders_count          bigint,
  active_subscriptions_count bigint,
  average_basket_cents       bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'p_days must be between 1 and 365' using errcode = '22023';
  end if;

  return query
  with paid as (
    select count(*)::bigint                       as n,
           coalesce(sum(total_amount), 0)::bigint as revenue
      from public.orders
     where status = 'paid'
       and created_at >= (current_date - (p_days - 1))::timestamptz
  )
  select
    paid.revenue,
    paid.n,
    (select count(*)::bigint
       from public.subscriptions
      where status in ('active', 'trialing')),
    case when paid.n = 0 then null::bigint
         else (paid.revenue / paid.n)::bigint
    end
  from paid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants — fail-closed by default. The grant layer only revokes anon;
-- admin vs. authenticated-client distinction is enforced by is_admin()
-- inside each function (see file header).
-- ---------------------------------------------------------------------------
revoke execute on function public.admin_daily_sales(int)               from public, anon;
revoke execute on function public.admin_category_shares(int)           from public, anon;
revoke execute on function public.admin_category_average_baskets(int)  from public, anon;
revoke execute on function public.admin_dashboard_kpis(int)            from public, anon;

grant  execute on function public.admin_daily_sales(int)               to authenticated, service_role;
grant  execute on function public.admin_category_shares(int)           to authenticated, service_role;
grant  execute on function public.admin_category_average_baskets(int)  to authenticated, service_role;
grant  execute on function public.admin_dashboard_kpis(int)            to authenticated, service_role;
