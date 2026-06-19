'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Pencil,
  Power,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getCategories, getProducts, type Category, type Product, type StockStatus } from '@/lib/data';

type SortKey = 'name' | 'category' | 'price' | 'stock' | 'status';
type SortDirection = 'asc' | 'desc';
type AvailabilityCode = 'in_stock' | 'limited' | 'out_of_stock';

const STOCK_TO_CODE: Record<StockStatus, AvailabilityCode> = {
  'En Stock': 'in_stock',
  'Limité': 'limited',
  'Rupture de Stock': 'out_of_stock',
};

const STOCK_LABEL: Record<AvailabilityCode, string> = {
  in_stock: 'En Stock',
  limited: 'Limité',
  out_of_stock: 'Rupture de Stock',
};

const formatPrice = (value: number): string => `$${value.toLocaleString('fr-FR')}`;

type RowError = { code?: string; message: string };

async function patchProduct(pk_id: string, body: Record<string, unknown>): Promise<RowError | null> {
  const res = await fetch(`/api/admin/products/${pk_id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  return { code: payload.code, message: payload.error ?? `HTTP ${res.status}` };
}

async function deleteProduct(pk_id: string): Promise<RowError | null> {
  const res = await fetch(`/api/admin/products/${pk_id}`, { method: 'DELETE' });
  if (res.ok) return null;
  const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  return { code: payload.code, message: payload.error ?? `HTTP ${res.status}` };
}

export default function ProductsAdminSection() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Admin view shows ALL products, including is_active=false, so soft-deleted
  // rows can be re-activated or hard-deleted from here. Public consumers
  // (catalogue, /search, /category, /product) still hide them.
  const reload = useCallback(async () => {
    const [fetchedProducts, fetchedCategories] = await Promise.all([
      getProducts({ includeInactive: true }),
      getCategories(),
    ]);
    setProducts(fetchedProducts);
    setCategories(fetchedCategories);
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await reload();
      } catch (err) {
        if (cancelled) return;
        toast({
          title: 'Chargement impossible',
          description: err instanceof Error ? err.message : 'Erreur inconnue',
          variant: 'destructive',
        });
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, toast]);

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
        case 'status':
          return (Number(b.is_active) - Number(a.is_active)) * direction;
        case 'name':
        default:
          return a.name.localeCompare(b.name, 'fr') * direction;
      }
    });
    return copy;
  }, [products, sortKey, sortDirection, categoryNameById]);

  const handleToggleActive = async (product: Product) => {
    setPendingId(product.pk_id);
    const err = await patchProduct(product.pk_id, { is_active: !product.is_active });
    setPendingId(null);
    if (err) {
      toast({
        title: product.is_active ? 'Désactivation impossible' : 'Réactivation impossible',
        description: err.message,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: product.is_active ? 'Produit désactivé' : 'Produit réactivé',
      description: `${product.name} ${product.is_active ? 'masqué du catalogue.' : 'visible du catalogue.'}`,
    });
    await reload();
  };

  const handleDelete = async (product: Product) => {
    const ok = window.confirm(
      `Supprimer définitivement « ${product.name} » ? Cette action est irréversible.\n\n` +
        `(Les commandes passées sont préservées avec un libellé figé. Les prix Stripe associés ` +
        `resteront orphelins côté Stripe — à nettoyer dans le dashboard si besoin.)`,
    );
    if (!ok) return;
    setPendingId(product.pk_id);
    const err = await deleteProduct(product.pk_id);
    setPendingId(null);
    if (err) {
      toast({
        title: 'Suppression impossible',
        description: err.message,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Produit supprimé',
      description: `${product.name} retiré du catalogue.`,
    });
    if (expandedId === product.pk_id) setExpandedId(null);
    await reload();
  };

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
            Modifier, désactiver ou supprimer un produit. La modification de prix se fera dans
            un lot séparé (Stripe-aware).
          </p>
        </div>
      </header>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Liste de tous les produits (y compris désactivés). Cliquez sur une colonne pour trier
            ou sur une ligne pour modifier.
          </caption>
          <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="w-8 px-2 py-3" aria-hidden="true" />
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
              <th scope="col" aria-sort={ariaSort('status')} className="px-4 py-3">
                {headerButton('status', 'Statut')}
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!hydrated && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Chargement…
                </td>
              </tr>
            )}
            {hydrated && sortedProducts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Aucun produit dans le catalogue.
                </td>
              </tr>
            )}
            {sortedProducts.map((product) => {
              const expanded = expandedId === product.pk_id;
              return (
                <Row
                  key={product.pk_id}
                  product={product}
                  categoryName={categoryNameById.get(product.category_id) ?? '—'}
                  categories={categories}
                  expanded={expanded}
                  pending={pendingId === product.pk_id}
                  onToggleExpand={() => setExpandedId(expanded ? null : product.pk_id)}
                  onToggleActive={() => void handleToggleActive(product)}
                  onDelete={() => void handleDelete(product)}
                  onSaved={async () => {
                    setExpandedId(null);
                    await reload();
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type RowProps = {
  product: Product;
  categoryName: string;
  categories: Category[];
  expanded: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onSaved: () => Promise<void>;
};

function Row({
  product,
  categoryName,
  categories,
  expanded,
  pending,
  onToggleExpand,
  onToggleActive,
  onDelete,
  onSaved,
}: RowProps) {
  return (
    <>
      <tr className={pending ? 'opacity-50' : ''}>
        <td className="w-8 px-2 py-3 text-muted-foreground">
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-controls={`product-detail-${product.pk_id}`}
            aria-label={expanded ? `Replier ${product.name}` : `Déplier ${product.name}`}
            className="rounded p-1 hover:bg-secondary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {expanded ? (
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            ) : (
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </td>
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
          {product.is_active ? (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
              Actif
            </span>
          ) : (
            <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-700 dark:text-yellow-300">
              Désactivé
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleExpand}
              aria-label={`Modifier ${product.name}`}
              disabled={pending}
            >
              <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleActive}
              aria-label={
                product.is_active ? `Désactiver ${product.name}` : `Réactiver ${product.name}`
              }
              title={product.is_active ? 'Désactiver (soft delete)' : 'Réactiver'}
              disabled={pending}
            >
              <Power aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDelete}
              aria-label={`Supprimer ${product.name}`}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={pending}
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr id={`product-detail-${product.pk_id}`} className="bg-secondary/20">
          <td colSpan={7} className="px-4 py-4">
            <EditForm product={product} categories={categories} onSaved={onSaved} />
          </td>
        </tr>
      )}
    </>
  );
}

type EditFormProps = {
  product: Product;
  categories: Category[];
  onSaved: () => Promise<void>;
};

function EditForm({ product, categories, onSaved }: EditFormProps) {
  const { toast } = useToast();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [availability, setAvailability] = useState<AvailabilityCode>(
    STOCK_TO_CODE[product.stock_status],
  );
  const [priority, setPriority] = useState<number>(product.priority ?? 0);
  const [isActive, setIsActive] = useState<boolean>(product.is_active);
  const [categoryId, setCategoryId] = useState<string>(product.category_id);
  const [submitting, setSubmitting] = useState(false);

  // category_id on Product is the SLUG (set by toProduct from row.category.slug).
  // The RPC needs the UUID, so we resolve it from the loaded `categories` list.
  const resolveCategoryUuid = (slug: string): string | undefined =>
    categories.find((c) => c.id === slug)?.id;
  // Bug catcher: getCategories returns Category with `id` = slug too (same
  // convention as Product). The actual UUID is NOT exposed in Category
  // today. So we cannot change category from this form without first
  // surfacing the UUID. For this lot we keep the select read-only — the
  // RPC supports p_category_id but the front cannot send a UUID safely.
  // TODO(admin): surface category UUID in lib/data/categories.ts and
  // re-enable category re-assignment here.

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!name.trim()) {
      toast({ title: 'Nom requis', description: 'Le nom ne peut pas être vide.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const body: Record<string, unknown> = {
      // Send only fields the user could have changed. JSONB i18n: front
      // is single-language for now; we patch the `fr` key in name +
      // description and let the RPC merge by replacing the whole jsonb.
      // A more granular per-locale patch is out of scope for this lot.
      name: { fr: name.trim() },
      description: { fr: description.trim() },
      availability,
      priority,
      is_active: isActive,
    };
    const err = await patchProduct(product.pk_id, body);
    setSubmitting(false);
    if (err) {
      toast({
        title: 'Sauvegarde impossible',
        description: err.message + (err.code ? ` (${err.code})` : ''),
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Produit mis à jour',
      description: `${name.trim()} sauvegardé. Le catalogue public sera revalidé.`,
    });
    await onSaved();
  };

  // resolveCategoryUuid is unused for now (category select is read-only); we
  // reference it once here so TS/ESLint do not complain about the helper
  // staying around for the future re-enable described above.
  void resolveCategoryUuid;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-1">
        <label htmlFor={`name-${product.pk_id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Nom (FR)
        </label>
        <input
          id={`name-${product.pk_id}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={`category-${product.pk_id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Catégorie (lecture seule pour l&apos;instant)
        </label>
        <select
          id={`category-${product.pk_id}`}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1 lg:col-span-2">
        <label htmlFor={`description-${product.pk_id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Description (FR)
        </label>
        <textarea
          id={`description-${product.pk_id}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={`availability-${product.pk_id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Disponibilité
        </label>
        <select
          id={`availability-${product.pk_id}`}
          value={availability}
          onChange={(e) => setAvailability(e.target.value as AvailabilityCode)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {(Object.keys(STOCK_LABEL) as AvailabilityCode[]).map((code) => (
            <option key={code} value={code}>
              {STOCK_LABEL[code]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor={`priority-${product.pk_id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Priorité (0–1000, plus grand = plus haut)
        </label>
        <input
          id={`priority-${product.pk_id}`}
          type="number"
          min={0}
          max={1000}
          value={priority}
          onChange={(e) => setPriority(Number.parseInt(e.target.value, 10) || 0)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id={`active-${product.pk_id}`}
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <label htmlFor={`active-${product.pk_id}`} className="text-sm text-foreground">
          Produit actif (visible du catalogue public)
        </label>
      </div>

      <div className="lg:col-span-2 flex justify-end gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}
