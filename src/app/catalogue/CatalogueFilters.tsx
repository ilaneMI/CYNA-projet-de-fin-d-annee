'use client';

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import type { Category, ProductSort, StockFilter } from '@/lib/data';

const STOCK_OPTIONS: { value: StockFilter; label: string }[] = [
  { value: 'all', label: 'Toutes disponibilités' },
  { value: 'En Stock', label: 'En Stock' },
  { value: 'Limité', label: 'Limité' },
  { value: 'Rupture de Stock', label: 'Rupture de Stock' },
];

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'default', label: 'Priorité puis disponibilité' },
  { value: 'availability', label: 'Disponibilité' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'name', label: 'Ordre alphabétique' },
];

type Props = {
  categories: Category[];
  selectedCategoryId: string;
  selectedStock: StockFilter;
  selectedSort: ProductSort;
  searchTerm: string;
  matchCount: number;
};

const buildHref = (params: URLSearchParams): string => {
  const query = params.toString();
  return query ? `/catalogue?${query}` : '/catalogue';
};

export default function CatalogueFilters({
  categories,
  selectedCategoryId,
  selectedStock,
  selectedSort,
  searchTerm,
  matchCount,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchTerm);

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      router.push(buildHref(params), { scroll: false });
    },
    [router, searchParams],
  );

  const setParam = (key: string, value: string, fallback: string) => {
    pushParams((params) => {
      if (!value || value === fallback) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setParam('q', searchInput.trim(), '');
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setParam('q', '', '');
  };

  const hasActiveFilters =
    selectedCategoryId !== 'all' ||
    selectedStock !== 'all' ||
    selectedSort !== 'default' ||
    searchTerm.length > 0;

  const handleReset = () => {
    setSearchInput('');
    router.push('/catalogue', { scroll: false });
  };

  return (
    <section aria-label="Filtres du catalogue" className="space-y-4">
      <form onSubmit={handleSearchSubmit} role="search" className="relative">
        <label htmlFor="catalogue-search" className="sr-only">
          Rechercher un produit
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id="catalogue-search"
          type="search"
          value={searchInput}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchInput(event.target.value)}
          placeholder="Rechercher un produit, une fonctionnalité..."
          className="w-full rounded-lg border border-input bg-secondary/40 py-3 pl-11 pr-12 text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {searchInput.length > 0 && (
          <button
            type="button"
            onClick={handleClearSearch}
            aria-label="Effacer la recherche"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </form>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="catalogue-category" className="mb-1 block text-sm font-medium text-muted-foreground">
            Catégorie
          </label>
          <select
            id="catalogue-category"
            value={selectedCategoryId}
            onChange={(event) => setParam('category', event.target.value, 'all')}
            className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Toutes les catégories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="catalogue-stock" className="mb-1 block text-sm font-medium text-muted-foreground">
            Disponibilité
          </label>
          <select
            id="catalogue-stock"
            value={selectedStock}
            onChange={(event) => setParam('stock', event.target.value, 'all')}
            className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {STOCK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="catalogue-sort" className="mb-1 block text-sm font-medium text-muted-foreground">
            Trier par
          </label>
          <select
            id="catalogue-sort"
            value={selectedSort}
            onChange={(event) => setParam('sort', event.target.value, 'default')}
            className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {matchCount === 0
            ? 'Aucun produit ne correspond à votre recherche.'
            : `${matchCount} produit${matchCount > 1 ? 's' : ''} affiché${matchCount > 1 ? 's' : ''}.`}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="self-start rounded-md border border-input px-3 py-1.5 text-sm text-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary sm:self-auto"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>
    </section>
  );
}
