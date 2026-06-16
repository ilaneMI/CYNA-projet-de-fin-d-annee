'use client';

import { useEffect, useState } from 'react';

type StoredOrder = {
  orderNumber?: string;
  total?: number;
  createdAt?: string;
  email?: string;
  status?: string;
};

type AdminOrder = {
  orderNumber: string;
  createdAt: string;
  total: number;
  email: string;
  status: string;
};

const formatPrice = (value: number): string => `$${value.toLocaleString('fr-FR')}`;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

const readOrders = (): AdminOrder[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem('orders');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as StoredOrder[])
      .filter((entry): entry is StoredOrder & { orderNumber: string } => typeof entry.orderNumber === 'string')
      .map((entry) => ({
        orderNumber: entry.orderNumber,
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
        total: typeof entry.total === 'number' ? entry.total : 0,
        email: typeof entry.email === 'string' ? entry.email : '—',
        status: typeof entry.status === 'string' ? entry.status : 'completed',
      }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  } catch {
    return [];
  }
};

export default function OrdersAdminSection() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOrders(readOrders());
    setHydrated(true);
  }, []);

  return (
    <section id="orders" aria-labelledby="orders-heading" className="space-y-4">
      <header>
        <h2 id="orders-heading" className="text-xl font-bold text-foreground sm:text-2xl">
          Gestion des commandes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Lecture seule pour l&apos;instant. Les mises à jour de statut passeront par une Edge
          Function Supabase au branchement.
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Liste des commandes du localStorage, triées de la plus récente à la plus ancienne.
          </caption>
          <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3">
                Numéro
              </th>
              <th scope="col" className="px-4 py-3">
                Date
              </th>
              <th scope="col" className="px-4 py-3">
                Client
              </th>
              <th scope="col" className="px-4 py-3">
                Statut
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Total
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
            {hydrated && orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Aucune commande pour le moment.
                </td>
              </tr>
            )}
            {orders.map((order) => (
              <tr key={order.orderNumber}>
                <th scope="row" className="px-4 py-3 font-medium text-foreground">
                  {order.orderNumber}
                </th>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(order.createdAt)}</td>
                <td className="px-4 py-3 text-muted-foreground">{order.email}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-xs text-foreground">
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-primary">
                  {formatPrice(order.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
