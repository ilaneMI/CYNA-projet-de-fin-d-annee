import { supabase } from '@/lib/supabase';
import type { Product, ProductQuery, StockStatus } from './types';

/**
 * Flattens the normalized catalogue (products + product_images + prices +
 * categories) back into the legacy `Product` shape consumed by every page.
 *
 * Key remappings:
 * - `id` exposed = the slug, so `<Link href={`/product/${p.id}`}>` keeps
 *   producing slug URLs without touching any page.
 * - `category_id` exposed = the parent category's slug, same reason.
 * - `image_url` = the lowest-`position` row in `product_images`.
 * - `price_*` reconstituted in EUR (÷100) from the matching rows in
 *   `prices` (monthly+flat, annual+flat, monthly+per_user).
 * - `stock_status` decoded from the `availability` enum to the French
 *   label the existing UI switches on.
 * - `name` / `description` resolved against the `fr` jsonb key (en/ar/he
 *   will be added by the i18n lot).
 */

type AvailabilityCode = 'in_stock' | 'limited' | 'out_of_stock';
type BillingInterval = 'monthly' | 'annual';
type PriceUnit = 'flat' | 'per_user' | 'per_device';

type PriceRow = {
  billing_interval: BillingInterval;
  unit_type: PriceUnit;
  unit_amount: number;
  currency: string;
  is_active: boolean;
};

type ImageRow = {
  url: string;
  position: number;
};

type ProductRow = {
  id: string;
  slug: string;
  name: Record<string, string> | null;
  description: Record<string, string> | null;
  specs: Record<string, string> | null;
  availability: AvailabilityCode;
  priority: number;
  created_at: string;
  category: { id: string; slug: string };
  product_images: ImageRow[];
  prices: PriceRow[];
};

const AVAILABILITY_LABEL: Record<AvailabilityCode, StockStatus> = {
  in_stock: 'En Stock',
  limited: 'Limité',
  out_of_stock: 'Rupture de Stock',
};

const AVAILABILITY_CODE: Record<StockStatus, AvailabilityCode> = {
  'En Stock': 'in_stock',
  'Limité': 'limited',
  'Rupture de Stock': 'out_of_stock',
};

const STOCK_ORDER: Record<StockStatus, number> = {
  'En Stock': 0,
  'Limité': 1,
  'Rupture de Stock': 2,
};

const PRODUCT_SELECT = `
  id, slug, name, description, specs, availability, priority, created_at,
  category:categories!inner ( id, slug ),
  product_images ( url, position ),
  prices ( billing_interval, unit_type, unit_amount, currency, is_active )
`;

const findPriceCents = (
  prices: PriceRow[],
  interval: BillingInterval,
  unit: PriceUnit,
): number => {
  const match = prices.find(
    (p) => p.is_active && p.billing_interval === interval && p.unit_type === unit,
  );
  return match?.unit_amount ?? 0;
};

const firstImageUrl = (images: ImageRow[]): string => {
  if (images.length === 0) return '';
  const sorted = [...images].sort((a, b) => a.position - b.position);
  return sorted[0]?.url ?? '';
};

const toProduct = (row: ProductRow): Product => ({
  id: row.slug,
  name: row.name?.fr ?? '',
  description: row.description?.fr ?? '',
  price_monthly: findPriceCents(row.prices, 'monthly', 'flat') / 100,
  price_annual: findPriceCents(row.prices, 'annual', 'flat') / 100,
  price_per_user: findPriceCents(row.prices, 'monthly', 'per_user') / 100,
  category_id: row.category.slug,
  image_url: firstImageUrl(row.product_images),
  stock_status: AVAILABILITY_LABEL[row.availability],
  technical_specs: row.specs ?? {},
  priority: row.priority,
  created_at: row.created_at,
});

const matchesSearchClient = (product: Product, term: string): boolean => {
  const haystack = `${product.name} ${product.description}`.toLowerCase();
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
};

const compareByDefault = (a: Product, b: Product): number => {
  const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
  if (priorityDiff !== 0) return priorityDiff;
  return STOCK_ORDER[a.stock_status] - STOCK_ORDER[b.stock_status];
};

const compareProducts = (sort: ProductQuery['sort']) => (a: Product, b: Product): number => {
  switch (sort) {
    case 'price_asc':
      return a.price_monthly - b.price_monthly;
    case 'price_desc':
      return b.price_monthly - a.price_monthly;
    case 'name':
      return a.name.localeCompare(b.name, 'fr');
    case 'availability':
      return STOCK_ORDER[a.stock_status] - STOCK_ORDER[b.stock_status];
    case 'priority':
    case 'default':
    case undefined:
    default:
      return compareByDefault(a, b);
  }
};

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  // Category filter: the public API takes a slug. We resolve it to a UUID
  // in a tiny lookup and then filter on the indexed `category_id` column —
  // simpler and more predictable than chained embedded filters.
  let categoryUuid: string | null = null;
  if (query.categoryId) {
    const { data: cat, error: catErr } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', query.categoryId)
      .maybeSingle();
    if (catErr) {
      throw new Error(`Supabase getProducts (category lookup) failed: ${catErr.message}`);
    }
    if (!cat) return [];
    categoryUuid = (cat as { id: string }).id;
  }

  let request = supabase.from('products').select(PRODUCT_SELECT);

  if (categoryUuid) {
    request = request.eq('category_id', categoryUuid);
  }

  if (query.stockStatus && query.stockStatus !== 'all') {
    const code = AVAILABILITY_CODE[query.stockStatus];
    if (code) {
      request = request.eq('availability', code);
    }
  }

  let usedServerSearch = false;
  if (query.search) {
    // Postgres FTS through the stored generated tsvector — sub-100ms even
    // with a real catalogue, per modele-donnees-CYNA.md §5.
    request = request.textSearch('search_fr', query.search, {
      type: 'plain',
      config: 'french',
    });
    usedServerSearch = true;
  }

  const { data, error } = await request;
  if (error) {
    throw new Error(`Supabase getProducts failed: ${error.message}`);
  }

  let products = ((data ?? []) as unknown as ProductRow[]).map(toProduct);

  // FTS handles whole-token matching; the legacy multi-token AND falls
  // back to a client-side filter so partial-word queries still narrow the
  // result set in the same way the old stub did.
  if (query.search && !usedServerSearch) {
    const term = query.search;
    products = products.filter((p) => matchesSearchClient(p, term));
  }

  return [...products].sort(compareProducts(query.sort));
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', id)
    .maybeSingle();
  if (error) {
    throw new Error(`Supabase getProductById failed: ${error.message}`);
  }
  return data ? toProduct(data as unknown as ProductRow) : null;
}

export async function getTopProducts(limit = 6): Promise<Product[]> {
  const products = await getProducts();
  return products.slice(0, limit);
}

export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  return getProducts({ categoryId });
}
