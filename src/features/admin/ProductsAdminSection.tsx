'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getCategories, getProducts, type Category, type Product } from '@/lib/data';

type SortKey = 'name' | 'category' | 'price' | 'stock';
type SortDirection = 'asc' | 'desc';

const formatPrice = (value: number): string => `$${value.toLocaleString('fr-FR')}`;

export default function ProductsAdminSection() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getProducts(), getCategories()]).then(([fetchedProducts, fetchedCategories]) => {
      if (cancelled) return;
      setProducts(fetchedProducts);
      setCategories(fetchedCategories);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) map.set(category.id, category.name);
    return map;
  }, [categories]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedProducts = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    const copy = [...products];
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'price':
          return (a.price_monthly - b.price_monthly) * direction;
        case 'category': {
          const aName = categoryNameById.get(a.category_id) ?? '';
          const bName = categoryNameById.get(b.category_id) ?? '';
          return aName.localeCompare(bName, 'fr') * direction;
        }
        case 'stock':
          return a.stock_status.localeCompare(b.stock_status, 'fr') * direction;
        case 'name':
        default:
          return a.name.localeCompare(b.name, 'fr') * direction;
      }
    });
    return copy;
  }, [products, sortKey, sortDirection, categoryNameById]);

  // TODO(supabase): the CRUD handlers below must POST/PATCH/DELETE through
  // Supabase Edge Functions that enforce RLS (admin role only) and write
  // to the `admin_audit_log` table. The page-level guard is for UX; the
  // actual permission check lives server-side. Right now these are pure
  // placeholders that only fire a toast.
  const showPlaceholder = (action: string, target: string) =>
    toast({
      title: `Action « ${action} » à brancher`,
      description: `Cible : ${target}. La mutation passera par une Edge Function Supabase.`,
    });

  const ariaSort = (key: SortKey): 'ascending' | 'descending' | 'none' => {
    if (sortKey !== key) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const headerButton = (key: SortKey, label: string) => {
    const active = sortKey === key;
    const Icon = !active ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {label}
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    );
  };

  return (
    <section id="products" aria-labelledby="products-heading" className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="products-heading" className="text-xl font-bold text-foreground sm:text-2xl">
            Gestion des produits
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tableau triable. Les actions sont des placeholders en attendant le branchement
            Supabase.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => showPlaceholder('Créer un produit', 'Nouveau produit')}
          data-admin="placeholder"
        >
          <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
          Ajouter un produit
        </Button>
      </header>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-left text-sm" data-admin="placeholder">
          <caption className="sr-only">
            Liste des produits avec catégorie, prix mensuel et statut de stock. Cliquez sur
            une colonne pour trier.
          </caption>
          <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" aria-sort={ariaSort('name')} className="px-4 py-3">
                {headerButton('name', 'Nom')}
              </th>
              <th scope="col" aria-sort={ariaSort('category')} className="px-4 py-3">
                {headerButton('category', 'Catégorie')}
              </th>
              <th scope="col" aria-sort={ariaSort('price')} className="px-4 py-3">
                {headerButton('price', 'Prix mensuel')}
              </th>
              <th scope="col" aria-sort={ariaSort('stock')} className="px-4 py-3">
                {headerButton('stock', 'Stock')}
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!hydrated && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Chargement…
                </td>
              </tr>
            )}
            {hydrated && sortedProducts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Aucun produit dans le catalogue.
                </td>
              </tr>
            )}
            {sortedProducts.map((product) => {
              const categoryName = categoryNameById.get(product.category_id) ?? '—';
              return (
                <tr key={product.id}>
                  <th scope="row" className="px-4 py-3 font-medium text-foreground">
                    {product.name}
                  </th>
                  <td className="px-4 py-3 text-muted-foreground">{categoryName}</td>
                  <td className="px-4 py-3 text-foreground">{formatPrice(product.price_monthly)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-xs text-foreground">
                      {product.stock_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => showPlaceholder('Modifier', product.name)}
                        aria-label={`Modifier ${product.name}`}
                        data-admin="placeholder"
                      >
                        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => showPlaceholder('Supprimer', product.name)}
                        aria-label={`Supprimer ${product.name}`}
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        data-admin="placeholder"
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
