'use client';

import { useMemo, type ChangeEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useCart, type CartItem, type SubscriptionDuration } from '@/context/CartContext';

const DURATION_LABEL: Record<SubscriptionDuration, string> = {
  monthly: 'Mensuel',
  annual: 'Annuel',
  per_user: 'Par utilisateur',
};

const DURATION_SUFFIX: Record<SubscriptionDuration, string> = {
  monthly: '/mois',
  annual: '/an',
  per_user: '/utilisateur/mois',
};

const formatPrice = (value: number): string => `$${value.toLocaleString('fr-FR')}`;

const PageShell = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background py-10 sm:py-16">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
  </div>
);

const CartSkeleton = () => (
  // The list is empty during SSR and the very first client paint (before the
  // localStorage read), so the page renders this neutral skeleton instead of
  // flashing an "empty cart" state when there might actually be items.
  <PageShell>
    <h1 className="mb-8 text-2xl font-bold text-foreground sm:text-3xl">Panier</h1>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" aria-busy="true" aria-live="polite">
      <div className="space-y-4 lg:col-span-2">
        {[0, 1].map((row) => (
          <div
            key={row}
            className="h-32 animate-pulse rounded-lg border border-border bg-card/40"
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-border bg-card/40 lg:col-span-1" aria-hidden="true" />
      <span className="sr-only">Chargement du panier…</span>
    </div>
  </PageShell>
);

const EmptyCart = () => (
  <PageShell>
    <div className="mx-auto max-w-md py-12 text-center">
      <ShoppingBag aria-hidden="true" className="mx-auto mb-6 h-20 w-20 text-muted-foreground" />
      <h1 className="mb-3 text-2xl font-bold text-foreground sm:text-3xl">Votre panier est vide</h1>
      <p className="mb-8 text-muted-foreground">
        Commencez à explorer le catalogue Cyna pour ajouter une solution à votre panier.
      </p>
      <Link href="/catalogue">
        <Button size="lg">Parcourir le catalogue</Button>
      </Link>
    </div>
  </PageShell>
);

type CartLineProps = {
  item: CartItem;
  unitPrice: number;
  lineTotal: number;
  onQuantityChange: (next: number) => void;
  onDurationChange: (next: SubscriptionDuration) => void;
  onRemove: () => void;
};

function CartLine({
  item,
  unitPrice,
  lineTotal,
  onQuantityChange,
  onDurationChange,
  onRemove,
}: CartLineProps) {
  const durationSelectId = `duration-${item.cartId}`;
  const quantityLabelId = `quantity-${item.cartId}`;

  return (
    <article
      aria-label={`Article : ${item.name}`}
      className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative h-28 w-full overflow-hidden rounded-md bg-secondary/40 sm:h-24 sm:w-24 sm:flex-shrink-0">
          <Image
            src={item.image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 96px"
            className="object-cover"
          />
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">
                <Link
                  href={`/product/${item.id}`}
                  className="hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {item.name}
                </Link>
              </h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
            </div>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Retirer ${item.name} du panier`}
              className="rounded-md p-2 text-destructive hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              <Trash2 aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <div>
              <label htmlFor={durationSelectId} className="mb-1 block text-xs text-muted-foreground">
                Durée
              </label>
              <select
                id={durationSelectId}
                value={item.subscriptionDuration}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  onDurationChange(event.target.value as SubscriptionDuration)
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {(Object.keys(DURATION_LABEL) as SubscriptionDuration[]).map((duration) => (
                  <option key={duration} value={duration}>
                    {DURATION_LABEL[duration]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span id={quantityLabelId} className="mb-1 block text-xs text-muted-foreground">
                Quantité
              </span>
              <div className="flex items-center gap-1" role="group" aria-labelledby={quantityLabelId}>
                <button
                  type="button"
                  onClick={() => onQuantityChange(item.quantity - 1)}
                  aria-label={`Diminuer la quantité de ${item.name}`}
                  className="rounded-md border border-input p-2 text-foreground hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Minus aria-hidden="true" className="h-4 w-4" />
                </button>
                <span
                  aria-live="polite"
                  aria-atomic="true"
                  className="min-w-[2.5rem] rounded-md border border-input bg-background py-1.5 text-center text-sm text-foreground"
                >
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => onQuantityChange(item.quantity + 1)}
                  aria-label={`Augmenter la quantité de ${item.name}`}
                  className="rounded-md border border-input p-2 text-foreground hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs text-muted-foreground">Sous-total ligne</p>
              <p className="text-lg font-bold text-primary">{formatPrice(lineTotal)}</p>
              <p className="text-xs text-muted-foreground">
                {formatPrice(unitPrice)}
                {DURATION_SUFFIX[item.subscriptionDuration]} × {item.quantity}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function CartView() {
  const {
    cartItems,
    hydrated,
    removeFromCart,
    updateQuantity,
    updateSubscriptionDuration,
    getItemPrice,
    getCartTotal,
    clearCart,
  } = useCart();
  const { isAuthenticated } = useAuth();

  // Display only. The authoritative amount is recomputed server-side in
  // /api/checkout/session from the product catalogue; never trust a price
  // coming from the client.
  const displayTotal = useMemo(() => getCartTotal(), [getCartTotal]);

  if (!hydrated) {
    return <CartSkeleton />;
  }

  if (cartItems.length === 0) {
    return <EmptyCart />;
  }

  return (
    <PageShell>
      <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Panier</h1>
        <button
          type="button"
          onClick={clearCart}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
        >
          Vider le panier
        </button>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section aria-label="Articles du panier" className="space-y-4 lg:col-span-2">
          {cartItems.map((item) => {
            const unitPrice = getItemPrice(item);
            return (
              <CartLine
                key={item.cartId}
                item={item}
                unitPrice={unitPrice}
                lineTotal={unitPrice * item.quantity}
                onQuantityChange={(next) => updateQuantity(item.cartId, next)}
                onDurationChange={(next) => updateSubscriptionDuration(item.cartId, next)}
                onRemove={() => removeFromCart(item.cartId)}
              />
            );
          })}
        </section>

        <aside aria-label="Récapitulatif de commande" className="lg:col-span-1">
          <div className="sticky top-20 rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-6 text-lg font-bold text-foreground">Récapitulatif</h2>

            <dl className="mb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Sous-total</dt>
                <dd className="font-semibold text-foreground">{formatPrice(displayTotal)}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">Taxes</dt>
                <dd className="text-foreground">Calculées au paiement</dd>
              </div>
              <div className="border-t border-border pt-3">
                <div
                  className="flex justify-between text-base font-bold"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <dt className="text-foreground">Total estimé</dt>
                  <dd className="text-primary">{formatPrice(displayTotal)}</dd>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Montant indicatif. Le total définitif sera confirmé à l&apos;étape de paiement.
                </p>
              </div>
            </dl>

            {!isAuthenticated && (
              <div className="mb-4 rounded-md border border-primary/20 bg-primary/10 p-3 text-sm">
                <p className="mb-3 text-primary">Connectez-vous pour sauvegarder votre panier.</p>
                <div className="flex gap-2">
                  <Link href="/login" className="flex-1">
                    <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10">
                      Connexion
                    </Button>
                  </Link>
                  <Link href="/register" className="flex-1">
                    <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10">
                      Inscription
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            <Link href="/checkout" className="block">
              <Button type="button" size="lg" className="mb-3 w-full">
                Passer au paiement
              </Button>
            </Link>
            <Link href="/catalogue">
              <Button variant="outline" size="lg" className="w-full">
                Continuer mes achats
              </Button>
            </Link>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
