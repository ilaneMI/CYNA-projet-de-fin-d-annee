/**
 * Canonical data model exposed by the `@/lib/data` access layer.
 *
 * Pages and components MUST import these types from here (never from
 * `@/lib/demoData` directly). When Supabase lands, the implementations
 * in `products.ts` / `categories.ts` / `carousel.ts` change but the
 * types stay stable.
 */

export type StockStatus = 'En Stock' | 'Limité' | 'Rupture de Stock';

export type Category = {
  id: string;
  name: string;
  description: string;
  image_url: string;
  created_at: string;
};

export type Product = {
  /** Public-facing slug used in routes (/product/{id}). */
  id: string;
  /** Postgres UUID primary key. Needed by admin RPCs which only key by uuid. */
  pk_id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  price_per_user: number;
  category_id: string;
  image_url: string;
  stock_status: StockStatus;
  technical_specs: Record<string, string>;
  /** Higher first. Defaults to 0 when absent. */
  priority?: number;
  /** Soft-delete flag. Public listings filter to true; admin sees both. */
  is_active: boolean;
  created_at: string;
};

export type CarouselItem = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  cta_text?: string;
  cta_link?: string;
  order_index: number;
  created_at: string;
};

export type ProductSort =
  | 'default'
  | 'priority'
  | 'availability'
  | 'price_asc'
  | 'price_desc'
  | 'name'
  | 'newest';

export type StockFilter = StockStatus | 'all';

export type ProductQuery = {
  /** Single category id. Mutually inclusive with `categoryIds`. */
  categoryId?: string;
  /** Multi-select category filter; supersedes `categoryId` when non-empty. */
  categoryIds?: string[];
  /** Single stock filter (with the implicit "all" escape hatch). */
  stockStatus?: StockFilter;
  /** Multi-select stock filter; supersedes `stockStatus` when non-empty. */
  stockStatuses?: StockStatus[];
  search?: string;
  /** Filter by monthly price (inclusive). Skipped if undefined. */
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  /** Admin-only escape hatch: include soft-deleted (is_active=false) rows. */
  includeInactive?: boolean;
};
