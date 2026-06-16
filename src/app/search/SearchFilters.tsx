'use client';

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import type { Category, ProductSort, StockStatus } from '@/lib/data';

const STOCK_VALUES: StockStatus[] = ['En Stock', 'Limité', 'Rupture de Stock'];

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'default', label: 'Pertinence' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'newest', label: 'Plus récents' },
  { value: 'name', label: 'Ordre alphabétique' },
];

type Props = {
  categories: Category[];
  selectedCategoryIds: string[];
  selectedStockStatuses: StockStatus[];
  selectedSort: ProductSort;
  searchTerm: string;
  minPrice: number;
  maxPrice: number;
  priceBoundary: { min: number; max: number };
  matchCount: number;
};

const buildHref = (params: URLSearchParams): string => {
  const query = params.toString();
  return query ? `/search?${query}` : '/search';
};

const setOrDelete = (params: URLSearchParams, key: string, value: string | null) => {
  if (value === null || value === '') {
    params.delete(key);
  } else {
    params.set(key, value);
  }
};

export default function SearchFilters({
  categories,
  selectedCategoryIds,
  selectedStockStatuses,
  selectedSort,
  searchTerm,
  minPrice,
  maxPrice,
  priceBoundary,
  matchCount,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchTerm);
  const [minInput, setMinInput] = useState(String(minPrice));
  const [maxInput, setMaxInput] = useState(String(maxPrice));

  useEffect(() => setSearchInput(searchTerm), [searchTerm]);
  useEffect(() => setMinInput(String(minPrice)), [minPrice]);
  useEffect(() => setMaxInput(String(maxPrice)), [maxPrice]);

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      router.push(buildHref(params), { scroll: false });
    },
    [router, searchParams],
  );

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    pushParams((params) => setOrDelete(params, 'q', searchInput.trim() || null));
  };

  const handleClearSearch = () => {
    setSearchInput('');
    pushParams((params) => params.delete('q'));
  };

  const toggleMulti = (key: 'category' | 'stock', value: string, checked: boolean) => {
    pushParams((params) => {
      const current = (params.get(key) ?? '').split(',').filter(Boolean);
      const next = checked
        ? Array.from(new Set([...current, value]))
        : current.filter((entry) => entry !== value);
      if (next.length === 0) params.delete(key);
      else params.set(key, next.join(','));
    });
  };

  const handleSortChange = (event: ChangeEvent<HTMLSelectElement>) => {
    pushParams((params) => setOrDelete(params, 'sort', event.target.value === 'default' ? null : event.target.value));
  };

  const commitPriceRange = () => {
    const minNumber = Number(minInput);
    const maxNumber = Number(maxInput);
    pushParams((params) => {
      if (Number.isFinite(minNumber) && minNumber > priceBoundary.min) {
        params.set('min', String(minNumber));
      } else {
        params.delete('min');
      }
      if (Number.isFinite(maxNumber) && maxNumber < priceBoundary.max) {
        params.set('max', String(maxNumber));
      } else {
        params.delete('max');
      }
    });
  };

  const hasActiveFilters =
    searchTerm.length > 0 ||
    selectedCategoryIds.length > 0 ||
    selectedStockStatuses.length > 0 ||
    selectedSort !== 'default' ||
    minPrice > priceBoundary.min ||
    maxPrice < priceBoundary.max;

  const handleReset = () => {
    setSearchInput('');
    setMinInput(String(priceBoundary.min));
    setMaxInput(String(priceBoundary.max));
    router.push('/search', { scroll: false });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearchSubmit} role="search" className="relative">
        <label htmlFor="search-input" className="sr-only">
          Rechercher dans le catalogue
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id="search-input"
          type="search"
          value={searchInput}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchInput(event.target.value)}
          placeholder="Rechercher un produit, une fonctionnalité…"
          className="w-full rounded-lg border border-input bg-card py-3 pl-12 pr-12 text-base text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary sm:text-lg"
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

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-foreground">Filtres</h2>

        <fieldset className="mb-5">
          <legend className="mb-2 text-sm font-medium text-foreground">Catégories</legend>
          <div className="space-y-2">
            {categories.map((category) => {
              const checked = selectedCategoryIds.includes(category.id);
              const inputId = `filter-category-${category.id}`;
              return (
                <div key={category.id} className="flex items-center gap-2">
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleMulti('category', category.id, event.target.checked)}
                    className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
                  />
                  <label htmlFor={inputId} className="cursor-pointer text-sm text-muted-foreground">
                    {category.name}
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mb-5">
          <legend className="mb-2 text-sm font-medium text-foreground">Disponibilité</legend>
          <div className="space-y-2">
            {STOCK_VALUES.map((status) => {
              const checked = selectedStockStatuses.includes(status);
              const inputId = `filter-stock-${status.replace(/\s+/g, '-')}`;
              return (
                <div key={status} className="flex items-center gap-2">
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleMulti('stock', status, event.target.checked)}
                    className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
                  />
                  <label htmlFor={inputId} className="cursor-pointer text-sm text-muted-foreground">
                    {status}
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mb-5">
          <legend className="mb-2 text-sm font-medium text-foreground">Prix mensuel ($)</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Minimum
              <input
                type="number"
                inputMode="numeric"
                min={priceBoundary.min}
                max={priceBoundary.max}
                value={minInput}
                onChange={(event) => setMinInput(event.target.value)}
                onBlur={commitPriceRange}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Maximum
              <input
                type="number"
                inputMode="numeric"
                min={priceBoundary.min}
                max={priceBoundary.max}
                value={maxInput}
                onChange={(event) => setMaxInput(event.target.value)}
                onBlur={commitPriceRange}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </div>
        </fieldset>

        <div>
          <label htmlFor="search-sort" className="mb-2 block text-sm font-medium text-foreground">
            Trier par
          </label>
          <select
            id="search-sort"
            value={selectedSort}
            onChange={handleSortChange}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="mt-5 w-full rounded-md border border-input px-3 py-2 text-sm text-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {matchCount === 0
          ? 'Aucun produit ne correspond à vos critères.'
          : `${matchCount} résultat${matchCount > 1 ? 's' : ''}.`}
      </p>
    </div>
  );
}
