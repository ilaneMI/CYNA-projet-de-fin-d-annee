'use client';

import { useEffect, useMemo, useState } from 'react';
import { Package, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import SalesBarChart from './SalesBarChart';
import CategoryBasketChart from './CategoryBasketChart';
import CategoryPieChart from './CategoryPieChart';
import { demoAverageBaskets, demoCategoryShares, demoSalesSeries } from './demoStats';
import { getCategories, getProducts, type Category, type Product } from '@/lib/data';

type Counters = {
  products: number;
  categories: number;
};

const formatPrice = (value: number): string => `$${value.toLocaleString('fr-FR')}`;

export default function DashboardSection() {
  const [counters, setCounters] = useState<Counters>({ products: 0, categories: 0 });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getProducts(), getCategories()]).then(([products, categories]: [Product[], Category[]]) => {
      if (cancelled) return;
      setCounters({ products: products.length, categories: categories.length });
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sales = useMemo(() => demoSalesSeries(), []);
  const baskets = useMemo(() => demoAverageBaskets(), []);
  const shares = useMemo(() => demoCategoryShares(), []);
  const weeklyRevenue = useMemo(() => sales.reduce((sum, entry) => sum + entry.amount, 0), [sales]);

  return (
    <section id="dashboard" aria-labelledby="dashboard-heading" className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 id="dashboard-heading" className="text-xl font-bold text-foreground sm:text-2xl">
            Tableau de bord ventes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Données démo : les chiffres ci-dessous sont simulés et seront remplacés par les
            agrégations Supabase au branchement.
          </p>
        </div>
        <span
          role="note"
          className="self-start rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
        >
          Données démo
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <dt className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp aria-hidden="true" className="h-4 w-4 text-primary" />
            Revenu 7 j.
          </dt>
          <dd className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
            {formatPrice(weeklyRevenue)}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <dt className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users aria-hidden="true" className="h-4 w-4 text-primary" />
            Panier moyen
          </dt>
          <dd className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
            {formatPrice(Math.round(weeklyRevenue / 32))}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <dt className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package aria-hidden="true" className="h-4 w-4 text-primary" />
            Produits actifs
          </dt>
          <dd className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
            {hydrated ? counters.products : '—'}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <dt className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-primary" />
            Catégories
          </dt>
          <dd className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
            {hydrated ? counters.categories : '—'}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-3 text-base font-semibold text-foreground">Ventes par jour</h3>
          <SalesBarChart data={sales} />
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-base font-semibold text-foreground">Part par catégorie</h3>
          <CategoryPieChart data={shares} />
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm lg:col-span-3">
          <h3 className="mb-3 text-base font-semibold text-foreground">Panier moyen par catégorie</h3>
          <CategoryBasketChart data={baskets} />
        </div>
      </div>
    </section>
  );
}
