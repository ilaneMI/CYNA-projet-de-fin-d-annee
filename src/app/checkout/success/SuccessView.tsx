'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Hourglass, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';

/**
 * Stripe success landing page.
 *
 * Lifecycle:
 *   1. Stripe redirects here after the user pays. URL :
 *        /checkout/success?session_id=cs_test_xxx
 *   2. Clear the cart on mount — the user has paid; whatever items were
 *      in the local cart are now reflected in their order on Stripe.
 *   3. Poll public.orders for a row matching this session_id (the row is
 *      created server-side by the webhook on `checkout.session.completed`).
 *      Up to 10 attempts at 1s interval; if the webhook is slow we show
 *      a "paiement en cours de confirmation" state with a manual refresh.
 *   4. RLS lets the authenticated user read their own row (auth.uid() =
 *      user_id) — no service-role plumbing client-side.
 */

type OrderRow = {
  order_number: string;
  total_amount: number;
  currency: string;
  email: string;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  created_at: string;
};

const MAX_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 1000;

const formatPrice = (cents: number, currency: string): string => {
  const value = cents / 100;
  const code = (currency || 'eur').toUpperCase();
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
};

export default function SuccessView() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { currentUser, loading } = useAuth();
  const { clearCart } = useCart();

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const cartCleared = useRef(false);

  // Clear the cart once — the payment is done at Stripe's side regardless
  // of whether the local DB row has been written yet by the webhook.
  useEffect(() => {
    if (sessionId && !cartCleared.current) {
      clearCart();
      cartCleared.current = true;
    }
  }, [sessionId, clearCart]);

  useEffect(() => {
    if (!sessionId || loading || !currentUser) return;
    let cancelled = false;
    let attempts = 0;

    const fetchOrder = async (): Promise<boolean> => {
      const { data } = await supabase
        .from('orders')
        .select('order_number, total_amount, currency, email, status, created_at')
        .eq('user_id', currentUser.id)
        .eq('stripe_checkout_session_id', sessionId)
        .maybeSingle();
      if (cancelled) return true;
      if (data) {
        setOrder(data as OrderRow);
        return true;
      }
      return false;
    };

    void (async () => {
      while (attempts < MAX_ATTEMPTS) {
        const found = await fetchOrder();
        if (found || cancelled) return;
        attempts++;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      if (!cancelled) setTimedOut(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, loading, currentUser]);

  const handleManualRefresh = async () => {
    if (!sessionId || !currentUser) return;
    setRefreshing(true);
    const { data } = await supabase
      .from('orders')
      .select('order_number, total_amount, currency, email, status, created_at')
      .eq('user_id', currentUser.id)
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle();
    if (data) {
      setOrder(data as OrderRow);
      setTimedOut(false);
    }
    setRefreshing(false);
  };

  if (!sessionId) {
    return (
      <section
        aria-labelledby="success-missing-heading"
        className="rounded-lg border border-border bg-card p-8 text-center shadow-sm"
      >
        <h1 id="success-missing-heading" className="text-2xl font-bold text-foreground">
          Aucune session de paiement
        </h1>
        <p className="mt-2 text-muted-foreground">
          Cette page se charge à la fin d’un paiement Stripe. Si vous y êtes arrivé directement,
          retournez au catalogue.
        </p>
        <Link href="/catalogue" className="mt-6 inline-block">
          <Button size="lg">Parcourir le catalogue</Button>
        </Link>
      </section>
    );
  }

  if (order) {
    return (
      <section
        aria-labelledby="success-heading"
        className="rounded-lg border border-border bg-card p-8 text-center shadow-sm"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15"
        >
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <h1 id="success-heading" className="mb-2 text-2xl font-bold text-foreground">
          Commande confirmée
        </h1>
        <p className="mx-auto mb-6 max-w-md text-muted-foreground">
          Merci pour votre achat. Un email de confirmation a été envoyé à{' '}
          <span className="font-medium text-foreground">{order.email}</span> avec le récapitulatif.
        </p>
        <dl className="mx-auto mb-8 max-w-sm rounded-md border border-input bg-secondary/40 p-4 text-left">
          <div className="mb-2 flex items-center justify-between text-sm">
            <dt className="text-muted-foreground">Numéro de commande</dt>
            <dd className="font-mono font-bold text-primary">{order.order_number}</dd>
          </div>
          <div className="flex items-center justify-between text-sm">
            <dt className="text-muted-foreground">Montant débité</dt>
            <dd className="font-semibold text-foreground">
              {formatPrice(order.total_amount, order.currency)}
            </dd>
          </div>
        </dl>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/orders" className="sm:flex-1">
            <Button type="button" variant="outline" size="lg" className="w-full">
              Voir mes commandes
            </Button>
          </Link>
          <Link href="/catalogue" className="sm:flex-1">
            <Button type="button" size="lg" className="w-full">
              Continuer mes achats
            </Button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="pending-heading"
      aria-live="polite"
      className="rounded-lg border border-border bg-card p-8 text-center shadow-sm"
    >
      <div
        aria-hidden="true"
        className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-secondary"
      >
        <Hourglass className="h-10 w-10 text-primary" />
      </div>
      <h1 id="pending-heading" className="mb-2 text-2xl font-bold text-foreground">
        Paiement en cours de confirmation
      </h1>
      <p className="mx-auto mb-6 max-w-md text-muted-foreground">
        Stripe a confirmé votre paiement. Nous attendons la notification serveur pour finaliser
        votre commande. Cela prend généralement quelques secondes.
      </p>
      {timedOut && (
        <p className="mb-6 text-sm text-muted-foreground">
          La notification n’est pas encore arrivée. Vous pouvez actualiser ci-dessous, ou consulter
          votre historique de commandes — elle apparaîtra dès la réception du webhook.
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => void handleManualRefresh()}
          disabled={refreshing}
        >
          <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
          {refreshing ? 'Actualisation…' : 'Actualiser'}
        </Button>
        <Link href="/orders">
          <Button type="button" size="lg">
            Voir mes commandes
          </Button>
        </Link>
      </div>
    </section>
  );
}
