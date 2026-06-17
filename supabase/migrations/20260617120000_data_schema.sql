-- Catalogue data schema for CYNA — categories, products, carousel items.
-- Shape mirrors src/lib/data/types.ts exactly. Public read only; no write
-- policies for now (the admin lot will add role-gated writes).

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id           text        primary key,
  name         text        not null,
  description  text        not null,
  image_url    text        not null,
  created_at   timestamptz not null default now()
);

comment on table public.categories is
  'Product categories shown on the public catalogue (SOC, EDR, XDR, …).';

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id              text        primary key,
  name            text        not null,
  description     text        not null,
  price_monthly   integer     not null check (price_monthly   >= 0),
  price_annual    integer     not null check (price_annual    >= 0),
  price_per_user  integer     not null check (price_per_user  >= 0),
  category_id     text        not null references public.categories(id) on delete restrict,
  image_url       text        not null,
  stock_status    text        not null check (stock_status in ('En Stock', 'Limité', 'Rupture de Stock')),
  technical_specs jsonb       not null default '{}'::jsonb,
  priority        integer,
  created_at      timestamptz not null default now()
);

comment on table public.products is
  'Catalogue items. Prices are in EUR (whole units, no cents).';

create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_stock_status_idx on public.products (stock_status);
create index if not exists products_price_monthly_idx on public.products (price_monthly);

-- ---------------------------------------------------------------------------
-- carousel_items
-- ---------------------------------------------------------------------------
create table if not exists public.carousel_items (
  id           text        primary key,
  title        text        not null,
  description  text        not null,
  image_url    text        not null,
  cta_text     text,
  cta_link     text,
  order_index  integer     not null,
  created_at   timestamptz not null default now()
);

comment on table public.carousel_items is
  'Home page hero carousel slides; ordered ascending by order_index.';

create index if not exists carousel_items_order_index_idx on public.carousel_items (order_index);

-- ---------------------------------------------------------------------------
-- Row Level Security — public read, no write
-- ---------------------------------------------------------------------------
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.carousel_items enable row level security;

drop policy if exists categories_public_read     on public.categories;
drop policy if exists products_public_read       on public.products;
drop policy if exists carousel_items_public_read on public.carousel_items;

create policy categories_public_read
  on public.categories
  for select
  to anon, authenticated
  using (true);

create policy products_public_read
  on public.products
  for select
  to anon, authenticated
  using (true);

create policy carousel_items_public_read
  on public.carousel_items
  for select
  to anon, authenticated
  using (true);
