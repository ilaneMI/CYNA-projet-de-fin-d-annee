'use client';

import { useEffect, useState } from 'react';
import {
  CreditCard,
  Package,
  Repeat,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import SalesBarChart from './SalesBarChart';
import CategoryBasketChart from './CategoryBasketChart';
import CategoryPieChart from './CategoryPieChart';
import {
  formatEurosFromCents,
  loadCategoryAverageBaskets,
  loadCategoryShares,
  loadDailySales,
  loadDashboardKpis,
  type CategoryAverageBasket,
  type CategoryShare,
  type DailySales,
  type DashboardKpis,
} from './adminStats';
import { getCategories, getProducts, type Category, type Product } from '@/lib/data';

const WINDOW_DAYS = 7;

type DashboardData = {
  kpis: DashboardKpis;
  sales: DailySales[];
  shares: CategoryShare[];
  baskets: CategoryAverageBasket[];
  productsCount: number;
  categoriesCount: number;
};

type State =
  | { stage: 'loading' }
  | { stage: 'error'; message: string }
  | { stage: 'ready'; data: DashboardData };

export default function DashboardSection() {
  const [state, setState] = useState<State>({ stage: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [kpis, sales, shares, baskets, products, categories] = await Promise.all([
          loadDashboardKpis(WINDOW_DAYS),
          loadDailySales(WINDOW_DAYS),
          loadCategoryShares(WINDOW_DAYS),
          loadCategoryAverageBaskets(WINDOW_DAYS),
          getProducts() as Promise<Product[]>,
          getCategories() as Promise<Category[]>,
        ]);
        if (cancelled) return;
        setState({
          stage: 'ready',
          data: {
            kpis,
            sales,
            shares,
            baskets,
            productsCount: products.length,
            categoriesCount: categories.length,
          },
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        setState({ stage: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="dashboard" aria-labelledby="dashboard-heading" className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 id="dashboard-heading" className="text-xl font-bold text-foreground sm:text-2xl">
            Tableau de bord ventes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Agrégats sur les {WINDOW_DAYS} derniers jours, calculés côté Supabase à partir des
            commandes payées.
          </p>
        </div>
      </header>

      {state.stage === 'loading' && (
        <div
          aria-busy="true"
          aria-live="polite"
          className="rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground"
        >
          Chargement des statistiques…
        </div>
      )}

      {state.stage === 'error' && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p className="font-medium">Impossible de charger le tableau de bord.</p>
          <p className="mt-1 break-all">{state.message}</p>
          <p className="mt-2 text-muted-foreground">
            Si vous êtes connecté avec un compte non administrateur, les RPC d&apos;agrégation
            refusent par conception (code Postgres 42501).
          </p>
        </div>
      )}

      {state.stage === 'ready' && <ReadyView data={state.data} />}
    </section>
  );
}

function ReadyView({ data }: { data: DashboardData }) {
  const { kpis, sales, shares, baskets, productsCount, categoriesCount } = data;
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={<TrendingUp aria-hidden="true" className="h-4 w-4 text-primary" />} label={`Revenu ${WINDOW_DAYS} j.`}>
          {formatEurosFromCents(kpis.revenue_cents)}
        </Kpi>
        <Kpi icon={<Users aria-hidden="true" className="h-4 w-4 text-primary" />} label="Panier moyen">
          {formatEurosFromCents(kpis.average_basket_cents)}
        </Kpi>
        <Kpi icon={<CreditCard aria-hidden="true" className="h-4 w-4 text-primary" />} label="Commandes payées">
          {kpis.paid_orders_count.toLocaleString('fr-FR')}
        </Kpi>
        <Kpi icon={<Repeat aria-hidden="true" className="h-4 w-4 text-primary" />} label="Abonnements actifs">
          {kpis.active_subscriptions_count.toLocaleString('fr-FR')}
        </Kpi>
        <Kpi icon={<Package aria-hidden="true" className="h-4 w-4 text-primary" />} label="Produits actifs">
          {productsCount.toLocaleString('fr-FR')}
        </Kpi>
        <Kpi icon={<ShieldCheck aria-hidden="true" className="h-4 w-4 text-primary" />} label="Catégories">
          {categoriesCount.toLocaleString('fr-FR')}
        </Kpi>
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
    </>
  );
}

function Kpi({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <dt className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-xl font-bold text-foreground sm:text-2xl">{children}</dd>
    </div>
  );
}
