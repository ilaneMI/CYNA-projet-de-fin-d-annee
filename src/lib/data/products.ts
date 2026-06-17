import { supabase } from '@/lib/supabase';
import type { Product, ProductQuery, StockStatus } from './types';

type ProductRow = {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  price_per_user: number;
  category_id: string;
  image_url: string;
  stock_status: StockStatus;
  technical_specs: Record<string, string> | null;
  priority: number | null;
  created_at: string;
};

const toProduct = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  description: row.description,
  price_monthly: row.price_monthly,
  price_annual: row.price_annual,
  price_per_user: row.price_per_user,
  category_id: row.category_id,
  image_url: row.image_url,
  stock_status: row.stock_status,
  technical_specs: row.technical_specs ?? {},
  priority: row.priority ?? undefined,
  created_at: row.created_at,
});

const STOCK_ORDER: Record<StockStatus, number> = {
  'En Stock': 0,
  'Limité': 1,
  'Rupture de Stock': 2,
};

const matchesSearch = (product: Product, term: string): boolean => {
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

const PRODUCT_COLUMNS =
  'id, name, description, price_monthly, price_annual, price_per_user, category_id, image_url, stock_status, technical_specs, priority, created_at';

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  let request = supabase.from('products').select(PRODUCT_COLUMNS);

  if (query.categoryId) {
    request = request.eq('category_id', query.categoryId);
  }
  if (query.stockStatus && query.stockStatus !== 'all') {
    request = request.eq('stock_status', query.stockStatus);
  }

  const { data, error } = await request;
  if (error) {
    throw new Error(`Supabase getProducts failed: ${error.message}`);
  }

  let products = (data ?? []).map(toProduct);

  // Multi-token AND search on name + description. Pushing this into
  // Postgres cleanly needs full-text or pg_trgm; staying in JS for now
  // preserves the legacy behaviour exactly.
  if (query.search) {
    const term = query.search;
    products = products.filter((product) => matchesSearch(product, term));
  }

  return [...products].sort(compareProducts(query.sort));
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new Error(`Supabase getProductById failed: ${error.message}`);
  }
  return data ? toProduct(data) : null;
}

export async function getTopProducts(limit = 6): Promise<Product[]> {
  const products = await getProducts();
  return products.slice(0, limit);
}

export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  return getProducts({ categoryId });
}
