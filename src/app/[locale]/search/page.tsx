import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  getCategories,
  getProducts,
  type ProductSort,
  type StockStatus,
} from '@/lib/data';
import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/Pagination';
import SearchFilters from './SearchFilters';

export const metadata: Metadata = {
  title: 'Recherche — Cyna',
  description: 'Recherchez parmi les solutions Cyna : SOC, EDR, XDR et renseignement sur les menaces.',
};

const PRICE_BOUNDARY = { min: 0, max: 10000 } as const;
const VALID_STOCK: StockStatus[] = ['En Stock', 'Limité', 'Rupture de Stock'];
const VALID_SORT: ProductSort[] = ['default', 'priority', 'availability', 'price_asc', 'price_desc', 'name', 'newest'];

const PAGE_SIZE = 12;

const parsePage = (raw: string): number => {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) return 1;
  return value;
};

const readParam = (raw: string | string[] | undefined): string => {
  if (Array.isArray(raw)) return raw[0] ?? '';
  return raw ?? '';
};

const parseMulti = (raw: string): string[] =>
  raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const parsePositiveInt = (raw: string, fallback: number): number => {
  if (raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.round(value);
};

const parseSort = (raw: string): ProductSort =>
  (VALID_SORT as string[]).includes(raw) ? (raw as ProductSort) : 'default';

type SearchParams = {
  q?: string | string[];
  category?: string | string[];
  stock?: string | string[];
  sort?: string | string[];
  min?: string | string[];
  max?: string | string[];
  page?: string | string[];
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations('search');

  const search = readParam(searchParams.q).trim();
  const requestedCategoryIds = parseMulti(readParam(searchParams.category));
  const requestedStockStatuses = parseMulti(readParam(searchParams.stock));
  const sort = parseSort(readParam(searchParams.sort));
  const minPrice = parsePositiveInt(readParam(searchParams.min), PRICE_BOUNDARY.min);
  const maxPrice = parsePositiveInt(readParam(searchParams.max), PRICE_BOUNDARY.max);
  const requestedPage = parsePage(readParam(searchParams.page));

  const categories = await getCategories();
  const validCategoryIds = new Set(categories.map((category) => category.id));
  const categoryIds = requestedCategoryIds.filter((id) => validCategoryIds.has(id));
  const stockStatuses = requestedStockStatuses.filter((status): status is StockStatus =>
    (VALID_STOCK as string[]).includes(status),
  );

  const products = await getProducts({
    search: search || undefined,
    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    stockStatuses: stockStatuses.length > 0 ? stockStatuses : undefined,
    minPrice: minPrice > PRICE_BOUNDARY.min ? minPrice : undefined,
    maxPrice: maxPrice < PRICE_BOUNDARY.max ? maxPrice : undefined,
    sort,
  });

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleProducts = products.slice(start, start + PAGE_SIZE);

  const buildPageHref = (page: number): string => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (categoryIds.length > 0) params.set('category', categoryIds.join(','));
    if (stockStatuses.length > 0) params.set('stock', stockStatuses.join(','));
    if (sort !== 'default') params.set('sort', sort);
    if (minPrice > PRICE_BOUNDARY.min) params.set('min', String(minPrice));
    if (maxPrice < PRICE_BOUNDARY.max) params.set('max', String(maxPrice));
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return query ? `/search?${query}` : '/search';
  };

  const heading = search
    ? t('resultCountWithQuery', { count: products.length, query: search })
    : t('resultCount', { count: products.length });

  return (
    <div className="bg-background py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{heading}</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">{t('subtitle')}</p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <aside className="lg:col-span-1" aria-label={t('filtersAriaLabel')}>
            <SearchFilters
              categories={categories}
              selectedCategoryIds={categoryIds}
              selectedStockStatuses={stockStatuses}
              selectedSort={sort}
              searchTerm={search}
              minPrice={minPrice}
              maxPrice={maxPrice}
              priceBoundary={PRICE_BOUNDARY}
              matchCount={products.length}
            />
          </aside>

          <section className="lg:col-span-3" aria-label={t('resultsAriaLabel')}>
            {products.length > 0 ? (
              <>
                <ul role="list" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleProducts.map((product) => (
                    <li key={product.id}>
                      <ProductCard product={product} />
                    </li>
                  ))}
                </ul>
                {totalPages > 1 && (
                  <div className="mt-8 flex flex-col items-center gap-2">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      hrefForPage={buildPageHref}
                      ariaLabel={t('paginationAriaLabel')}
                    />
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                      {t('pageStatus', {
                        current: currentPage,
                        total: totalPages,
                        count: products.length,
                      })}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
                <h2 className="text-xl font-semibold text-foreground">{t('noResults.title')}</h2>
                <p className="mt-2 text-muted-foreground">{t('noResults.helper')}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
