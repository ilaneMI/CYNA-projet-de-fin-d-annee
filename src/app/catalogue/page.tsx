import type { Metadata } from 'next';
import {
  getCategories,
  getProducts,
  type ProductSort,
  type StockFilter,
} from '@/lib/data';
import ProductCard from '@/components/ProductCard';
import CatalogueFilters from './CatalogueFilters';

export const metadata: Metadata = {
  title: 'Catalogue — Cyna',
  description:
    "Parcourez le catalogue complet des solutions de sécurité Cyna : SOC, EDR, XDR et plateformes de renseignement sur les menaces.",
};

const VALID_STOCK: StockFilter[] = ['all', 'En Stock', 'Limité', 'Rupture de Stock'];
const VALID_SORT: ProductSort[] = ['default', 'priority', 'availability', 'price_asc', 'price_desc', 'name'];

const readParam = (raw: string | string[] | undefined): string => {
  if (Array.isArray(raw)) return raw[0] ?? '';
  return raw ?? '';
};

const parseStock = (raw: string): StockFilter =>
  (VALID_STOCK as string[]).includes(raw) ? (raw as StockFilter) : 'all';

const parseSort = (raw: string): ProductSort =>
  (VALID_SORT as string[]).includes(raw) ? (raw as ProductSort) : 'default';

type SearchParams = {
  category?: string | string[];
  stock?: string | string[];
  sort?: string | string[];
  q?: string | string[];
};

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const rawCategory = readParam(searchParams.category);
  const stockStatus = parseStock(readParam(searchParams.stock));
  const sort = parseSort(readParam(searchParams.sort));
  const search = readParam(searchParams.q).trim();

  const categories = await getCategories();
  const validCategoryIds = new Set(categories.map((category) => category.id));
  const categoryId = validCategoryIds.has(rawCategory) ? rawCategory : 'all';

  const products = await getProducts({
    categoryId: categoryId === 'all' ? undefined : categoryId,
    stockStatus,
    sort,
    search: search || undefined,
  });

  const heading =
    categoryId === 'all'
      ? 'Catalogue des solutions'
      : `Catalogue — ${categories.find((category) => category.id === categoryId)?.name ?? ''}`;

  return (
    <div className="bg-background py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-10 max-w-3xl">
          <h1 className="mb-3 text-3xl font-bold text-foreground sm:text-4xl">{heading}</h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Explorez la gamme Cyna et filtrez par catégorie, disponibilité ou mots-clés. Les
            résultats sont triés par priorité puis par disponibilité par défaut.
          </p>
        </header>

        <CatalogueFilters
          categories={categories}
          selectedCategoryId={categoryId}
          selectedStock={stockStatus}
          selectedSort={sort}
          searchTerm={search}
          matchCount={products.length}
        />

        <section
          aria-label="Résultats du catalogue"
          className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>

        {products.length === 0 && (
          <div className="mt-10 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
            <h2 className="text-xl font-semibold text-foreground">Aucun résultat</h2>
            <p className="mt-2 text-muted-foreground">
              Ajustez vos filtres ou tentez une autre recherche pour découvrir nos solutions.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
