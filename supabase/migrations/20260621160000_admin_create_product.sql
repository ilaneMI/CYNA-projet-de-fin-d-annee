-- Lot Admin CRUD — création de produit.
--
-- Pendant de admin_update_product / admin_delete_product (migration
-- 20260619230000) : ajoute l'INSERT manquant. Même hardening :
--   1. SECURITY DEFINER + `if not public.is_admin() raise 42501` en tête.
--   2. `set search_path = ''` pour fermer la classe d'attaques par
--      shadow de schéma.
--   3. EXECUTE révoqué de public/anon, accordé à authenticated +
--      service_role (le route handler appelle via la session admin).
--
-- IMPORTANT — l'UUID du produit ET les UUID des lignes prices DOIVENT
-- être passés par l'appelant (`p_id`, `(p_prices[i]).id`). Choix
-- assumé : la création se fait en deux temps depuis Node :
--   (a) Node pré-génère les uuids et CRÉE D'ABORD les objets Stripe
--       (Product + Prices), en embedant les uuids dans
--       `stripe_*.metadata.supabase_*_id`.
--   (b) seulement après succès Stripe, Node appelle CETTE RPC, qui
--       persiste atomiquement products + N×prices.
-- Cet ordre garantit l'invariant: aucune ligne `prices` n'apparaît
-- jamais avec un stripe_price_id NULL ou divergent. La RPC se contente
-- de persister — elle ne sait rien de Stripe, ne valide pas l'existence
-- des stripe_*_id chez Stripe (côté Node, c'est tout frais créé).
--
-- En cas d'échec de cette RPC (collision slug, contrainte, validation),
-- les objets Stripe sont orphelins et c'est au route handler de les
-- archiver en best-effort (active=false) puis de remonter l'erreur.
-- La DB reste cohérente quoi qu'il arrive.

create or replace function public.admin_create_product(
  p_id           uuid,
  p_slug         text,
  p_name         jsonb,
  p_description  jsonb,
  p_specs        jsonb,
  p_category_id  uuid,
  p_availability text,
  p_priority     integer,
  p_is_featured  boolean,
  p_is_active    boolean,
  -- Tableau JSON : [{ id uuid, billing_interval text, unit_type text,
  --                   unit_amount int, currency text, stripe_price_id text }, ...]
  -- L'ordre des entrées est conservé, mais aucune contrainte d'unicité
  -- (interval, unit_type) n'est imposée par la RPC : la table
  -- public.prices a déjà `unique (product_id, billing_interval, unit_type)`
  -- qui rejettera tout doublon en INSERT.
  p_prices       jsonb
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row   public.products;
  v_price jsonb;
begin
  -- ── 1. Gating admin ────────────────────────────────────────────────
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  -- ── 2. Validation des champs scalaires ─────────────────────────────
  if p_id is null then
    raise exception 'p_id is required' using errcode = '22023';
  end if;

  if p_slug is null or length(trim(p_slug)) = 0 then
    raise exception 'slug is required' using errcode = '22023';
  end if;
  -- Slug: lowercase, alnum + hyphen, pas de hyphen initial/final ni doublé.
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'slug must be lowercase kebab-case (a-z, 0-9, single hyphens)'
      using errcode = '22023';
  end if;

  if p_name is null or jsonb_typeof(p_name) <> 'object' then
    raise exception 'name must be a JSON object' using errcode = '22023';
  end if;
  if coalesce(p_name->>'fr', p_name->>'en', '') = '' then
    raise exception 'name must contain a non-empty fr or en key'
      using errcode = '22023';
  end if;

  if p_description is not null and jsonb_typeof(p_description) <> 'object' then
    raise exception 'description must be a JSON object' using errcode = '22023';
  end if;
  if p_specs is not null and jsonb_typeof(p_specs) <> 'object' then
    raise exception 'specs must be a JSON object' using errcode = '22023';
  end if;

  if p_category_id is null then
    raise exception 'category_id is required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'category % not found', p_category_id using errcode = 'P0002';
  end if;

  if p_availability is null
     or p_availability not in ('in_stock', 'limited', 'out_of_stock') then
    raise exception 'availability must be one of in_stock, limited, out_of_stock'
      using errcode = '22023';
  end if;

  if p_priority is null or p_priority < 0 or p_priority > 1000 then
    raise exception 'priority must be between 0 and 1000' using errcode = '22023';
  end if;

  -- ── 3. Validation des prix initiaux ────────────────────────────────
  if p_prices is null
     or jsonb_typeof(p_prices) <> 'array'
     or jsonb_array_length(p_prices) = 0 then
    raise exception 'prices must be a non-empty array' using errcode = '22023';
  end if;

  for v_price in select * from jsonb_array_elements(p_prices) loop
    if (v_price->>'id') is null
       or length(trim(v_price->>'id')) = 0 then
      raise exception 'each price must have an id (uuid)' using errcode = '22023';
    end if;
    if (v_price->>'billing_interval') is null
       or (v_price->>'billing_interval') not in ('monthly', 'annual') then
      raise exception 'invalid billing_interval: %', v_price->>'billing_interval'
        using errcode = '22023';
    end if;
    if (v_price->>'unit_type') is null
       or (v_price->>'unit_type') not in ('flat', 'per_user', 'per_device') then
      raise exception 'invalid unit_type: %', v_price->>'unit_type'
        using errcode = '22023';
    end if;
    if (v_price->>'unit_amount') is null
       or (v_price->>'unit_amount')::integer < 1 then
      raise exception 'unit_amount must be a positive integer (centimes)'
        using errcode = '22023';
    end if;
    if (v_price->>'currency') is null
       or length(v_price->>'currency') <> 3 then
      raise exception 'currency must be a 3-letter ISO code' using errcode = '22023';
    end if;
    if (v_price->>'stripe_price_id') is null
       or length(trim(v_price->>'stripe_price_id')) = 0 then
      raise exception 'stripe_price_id is required for every price'
        using errcode = '22023';
    end if;
  end loop;

  -- ── 4. Pré-check slug (message plus clair que la unique violation) ─
  -- Race possible avec un autre admin créant exactement le même slug
  -- en parallèle : le UNIQUE constraint sur products.slug rattrapera
  -- la 2e insertion (errcode 23505). Acceptable, le route handler
  -- mappe les deux codes vers 409.
  if exists (select 1 from public.products where slug = p_slug::public.citext) then
    raise exception 'slug % already exists', p_slug using errcode = '23505';
  end if;

  -- ── 5. INSERT atomique products + prices ───────────────────────────
  insert into public.products (
    id, category_id, slug, name, description, specs,
    availability, priority, is_featured, is_active
  ) values (
    p_id,
    p_category_id,
    p_slug::public.citext,
    p_name,
    coalesce(p_description, '{}'::jsonb),
    coalesce(p_specs,        '{}'::jsonb),
    p_availability::public.stock_status,
    p_priority,
    coalesce(p_is_featured, false),
    coalesce(p_is_active,   true)
  )
  returning * into v_row;

  insert into public.prices (
    id, product_id, billing_interval, unit_type,
    unit_amount, currency, stripe_price_id, is_active
  )
  select
    (price->>'id')::uuid,
    p_id,
    (price->>'billing_interval')::public.billing_interval,
    (price->>'unit_type')::public.price_unit,
    (price->>'unit_amount')::integer,
    price->>'currency',
    price->>'stripe_price_id',
    true
  from jsonb_array_elements(p_prices) as price;

  return v_row;
end;
$$;

revoke execute on function public.admin_create_product(
  uuid, text, jsonb, jsonb, jsonb, uuid, text, integer, boolean, boolean, jsonb
) from public, anon;

grant  execute on function public.admin_create_product(
  uuid, text, jsonb, jsonb, jsonb, uuid, text, integer, boolean, boolean, jsonb
) to authenticated, service_role;
