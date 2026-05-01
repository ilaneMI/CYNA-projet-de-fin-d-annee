'use client';

import { useMemo, type ChangeEvent } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useCart, type CartItem, type SubscriptionDuration } from '@/context/CartContext';

const DURATION_KEYS: readonly SubscriptionDuration[] = ['monthly', 'annual', 'per_user'];

const PageShell = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-background py-10 sm:py-16">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
  </div>
);

const CartSkeleton = () => {
  const t = useTranslations('cart');
  return (
    // The list is empty during SSR and the very first client paint (before the
    // localStorage read), so the page renders this neutral skeleton instead of
    // flashing an "empty cart" state when there might actually be items.
    <PageShell>
      <h1 className="mb-8 text-2xl font-bold text-foreground sm:text-3xl">{t('heading')}</h1>
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
        <span className="sr-only">{t('skeletonSr')}</span>
      </div>
    </PageShell>
  );
};

const EmptyCart = () => {
  const t = useTranslations('cart.empty');
  return (
    <PageShell>
      <div className="mx-auto max-w-md py-12 text-center">
        <ShoppingBag aria-hidden="true" className="mx-auto mb-6 h-20 w-20 text-muted-foreground" />
        <h1 className="mb-3 text-2xl font-bold text-foreground sm:text-3xl">{t('heading')}</h1>
        <p className="mb-8 text-muted-foreground">{t('hint')}</p>
        <Link href="/catalogue">
          <Button size="lg">{t('browse')}</Button>
        </Link>
      </div>
    </PageShell>
  );
};

type CartLineProps = {
  item: CartItem;
  unitPrice: number;
  lineTotal: number;
  onQuantityChange: (next: number) => void;
  onDurationChange: (next: SubscriptionDuration) => void;
  onRemove: () => void;
  formatPrice: (value: number) => string;
};

function CartLine({
  item,
  unitPrice,
  lineTotal,
  onQuantityChange,
  onDurationChange,
  onRemove,
  formatPrice,
}: CartLineProps) {
  const t = useTranslations('cart.line');
  const durationSelectId = `duration-${item.cartId}`;
  const quantityLabelId = `quantity-${item.cartId}`;

  return (
    <article
      aria-label={t('articleAria', { name: item.name })}
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
              aria-label={t('removeAria', { name: item.name })}
              className="rounded-md p-2 text-destructive hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              <Trash2 aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
            <div>
              <label htmlFor={durationSelectId} className="mb-1 block text-xs text-muted-foreground">
                {t('duration')}
              </label>
              <select
                id={durationSelectId}
                value={item.subscriptionDuration}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  onDurationChange(event.target.value as SubscriptionDuration)
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {DURATION_KEYS.map((duration) => (
                  <option key={duration} value={duration}>
                    {t(`durationLabel.${duration}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span id={quantityLabelId} className="mb-1 block text-xs text-muted-foreground">
                {t('quantity')}
              </span>
              <div className="flex items-center gap-1" role="group" aria-labelledby={quantityLabelId}>
                <button
                  type="button"
                  onClick={() => onQuantityChange(item.quantity - 1)}
                  aria-label={t('decreaseAria', { name: item.name })}
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
                  aria-label={t('increaseAria', { name: item.name })}
                  className="rounded-md border border-input p-2 text-foreground hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs text-muted-foreground">{t('lineSubtotal')}</p>
              <p className="text-lg font-bold text-primary">{formatPrice(lineTotal)}</p>
              <p className="text-xs text-muted-foreground">
                {formatPrice(unitPrice)}
                {t(`durationSuffix.${item.subscriptionDuration}`)} × {item.quantity}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function CartView() {
  const t = useTranslations('cart');
  const locale = useLocale();
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

  // Locale-aware currency formatter. Uses EUR because the SaaS is priced in
  // euros in Stripe; the locale drives the surrounding number formatting.
  const formatPrice = useMemo(() => {
    const nf = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    });
    return (value: number): string => nf.format(value);
  }, [locale]);

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
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('heading')}</h1>
        <button
          type="button"
          onClick={clearCart}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
        >
          {t('clear')}
        </button>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section aria-label={t('articlesAria')} className="space-y-4 lg:col-span-2">
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
                formatPrice={formatPrice}
              />
            );
          })}
        </section>

        <aside aria-label={t('summaryAria')} className="lg:col-span-1">
          <div className="sticky top-20 rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="mb-6 text-lg font-bold text-foreground">{t('summary')}</h2>

            <dl className="mb-6 space-y-3">
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">{t('subtotal')}</dt>
                <dd className="font-semibold text-foreground">{formatPrice(displayTotal)}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-muted-foreground">{t('taxes')}</dt>
                <dd className="text-foreground">{t('taxesValue')}</dd>
              </div>
              <div className="border-t border-border pt-3">
                <div
                  className="flex justify-between text-base font-bold"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <dt className="text-foreground">{t('totalEstimate')}</dt>
                  <dd className="text-primary">{formatPrice(displayTotal)}</dd>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t('totalHint')}</p>
              </div>
            </dl>

            {!isAuthenticated && (
              <div className="mb-4 rounded-md border border-primary/20 bg-primary/10 p-3 text-sm">
                <p className="mb-3 text-primary">{t('notSignedInMsg')}</p>
                <div className="flex gap-2">
                  <Link href="/login" className="flex-1">
                    <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10">
                      {t('signIn')}
                    </Button>
                  </Link>
                  <Link href="/register" className="flex-1">
                    <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10">
                      {t('signUp')}
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* ANO-007 : sans session, on redirige vers /login?from=/checkout
                (même pattern que l'accès à /orders ou /my-account). Au retour
                de connexion, l'utilisateur atterrit directement sur /checkout. */}
            <Link
              href={isAuthenticated ? '/checkout' : { pathname: '/login', query: { from: '/checkout' } }}
              className="block"
            >
              <Button type="button" size="lg" className="mb-3 w-full">
                {isAuthenticated ? t('checkoutCtaAuthed') : t('checkoutCtaGuest')}
              </Button>
            </Link>
            <Link href="/catalogue">
              <Button variant="outline" size="lg" className="w-full">
                {t('continueShopping')}
              </Button>
            </Link>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
