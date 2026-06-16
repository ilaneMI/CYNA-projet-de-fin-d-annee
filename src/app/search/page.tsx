import type { Metadata } from 'next';
import {
  getCategories,
  getProducts,
  type ProductSort,
  type StockStatus,
} from '@/lib/data';
import ProductCard from '@/components/ProductCard';
import SearchFilters from './SearchFilters';

export const metadata: Metadata = {
  title: 'Recherche — Cyna',
  description: 'Recherchez parmi les solutions Cyna : SOC, EDR, XDR et renseignement sur les menaces.',
};

const PRICE_BOUNDARY = { min: 0, max: 10000 } as const;
const VALID_STOCK: StockStatus[] = ['En Stock', 'Limité', 'Rupture de Stock'];
const VALID_SORT: ProductSort[] = ['default', 'priority', 'availability', 'price_asc', 'price_desc', 'name', 'newest'];

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
  // Number('') === 0 in JS, which would conflate "no param" with "explicit 0".
  // Guard against that before parsing.
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
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const search = readParam(searchParams.q).trim();
  const requestedCategoryIds = parseMulti(readParam(searchParams.category));
  const requestedStockStatuses = parseMulti(readParam(searchParams.stock));
  const sort = parseSort(readParam(searchParams.sort));
  const minPrice = parsePositiveInt(readParam(searchParams.min), PRICE_BOUNDARY.min);
  const maxPrice = parsePositiveInt(readParam(searchParams.max), PRICE_BOUNDARY.max);

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

  const headingSuffix = search ? ` pour « ${search} »` : '';

  return (
    <div className="bg-background py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {products.length} résultat{products.length !== 1 ? 's' : ''}
            {headingSuffix}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Affinez votre recherche avec les filtres ci-après. Les paramètres sont conservés dans
            l&apos;URL pour partage et navigation.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <aside className="lg:col-span-1" aria-label="Filtres de recherche">
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

          <section className="lg:col-span-3" aria-label="Résultats de la recherche">
            {products.length > 0 ? (
              <ul role="list" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <li key={product.id}>
                    <ProductCard product={product} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
                <h2 className="text-xl font-semibold text-foreground">Aucun résultat</h2>
                <p className="mt-2 text-muted-foreground">
                  Élargissez vos filtres ou tentez une autre recherche pour trouver une solution Cyna.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
