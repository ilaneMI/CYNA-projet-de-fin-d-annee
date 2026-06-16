'use client';

import { useState, type FormEvent } from 'react';
import { CreditCard, ShieldAlert, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';

const formatPrice = (value: number): string => `$${value.toLocaleString('fr-FR')}`;

type PaymentMethod = 'card' | 'paypal';

type Props = {
  /**
   * Indicative total displayed for UX feedback. FIXME-SECURITY: at the real
   * Stripe integration this number is reference-only — the chargeable amount
   * is the one Stripe Checkout / PaymentIntent receives from our server
   * after re-computing the cart against the catalogue.
   */
  indicativeTotal: number;
  onBack: () => void;
  onConfirmed: () => void;
};

const METHODS: { id: PaymentMethod; label: string; icon: typeof CreditCard }[] = [
  { id: 'card', label: 'Carte bancaire', icon: CreditCard },
  { id: 'paypal', label: 'PayPal', icon: Wallet },
];

export default function Step3Payment({ indicativeTotal, onBack, onConfirmed }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [processing, setProcessing] = useState(false);

  // FIXME-SECURITY + TODO(stripe): this handler must redirect to a Stripe
  // Checkout session created by /api/checkout on the server (which receives
  // only product ids + quantities, recomputes the price, calls
  // stripe.checkout.sessions.create and returns the URL). No card data, no
  // amount, no order is ever placed from the client.
  //
  // Until then we just simulate latency and advance to confirmation so the
  // tunnel is walkable end-to-end in the demo.
  const handleConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setProcessing(false);
    onConfirmed();
  };

  return (
    <form
      onSubmit={handleConfirm}
      className="space-y-6"
      aria-labelledby="step-3-heading"
      data-stripe="checkout-placeholder"
    >
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 id="step-3-heading" className="mb-1 text-lg font-semibold text-foreground">
          Méthode de paiement
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Choisissez un mode de paiement. Le traitement sera réalisé par notre prestataire
          certifié&nbsp;PCI-DSS.
        </p>

        <fieldset className="mb-6">
          <legend className="sr-only">Mode de paiement</legend>
          <div role="radiogroup" aria-label="Mode de paiement" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {METHODS.map((entry) => {
              const Icon = entry.icon;
              const selected = method === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMethod(entry.id)}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 px-4 py-5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    selected
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  <Icon aria-hidden="true" className="h-6 w-6" />
                  {entry.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div
          role="region"
          aria-label="Tunnel de paiement (placeholder)"
          className="space-y-4 rounded-lg border-2 border-dashed border-border bg-secondary/30 p-6"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert aria-hidden="true" className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">
                {method === 'card'
                  ? 'Stripe Elements montera ici le formulaire de carte.'
                  : 'PayPal redirigera ici vers son tunnel de paiement.'}
              </p>
              <p className="mt-1 text-muted-foreground">
                Aucune donnée carte ne transitera jamais par nos serveurs (règle PCI-DSS). Le
                tunnel sera branché à l&apos;étape suivante de la migration.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
          <span className="text-base font-semibold text-foreground">Montant indicatif</span>
          <span className="text-2xl font-bold text-primary" aria-live="polite">
            {formatPrice(indicativeTotal)}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Montant affiché à titre indicatif. Le total définitif sera recalculé et validé côté
          serveur au branchement Stripe (FIXME-SECURITY).
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          disabled={processing}
          className="sm:flex-1"
        >
          Retour
        </Button>
        <Button type="submit" size="lg" disabled={processing} className="sm:flex-1">
          {processing ? 'Traitement…' : 'Confirmer le paiement'}
        </Button>
      </div>
    </form>
  );
}
