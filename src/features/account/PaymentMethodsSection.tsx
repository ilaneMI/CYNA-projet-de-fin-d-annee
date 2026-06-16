'use client';

import { CreditCard, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function PaymentMethodsSection() {
  const { toast } = useToast();

  // FIXME-SECURITY + TODO(stripe): real payment methods are managed entirely
  // by Stripe (Customer.payment_methods) — the front receives only a token
  // (pm_xxx) and never sees the PAN / CVC / expiry. The "Ajouter une carte"
  // button below must open a Stripe.js SetupIntent flow once integration
  // lands. Until then we keep a visible placeholder rather than risk
  // building any local card form.
  const handleAddPlaceholder = () => {
    toast({
      title: 'Tunnel Stripe à brancher',
      description:
        'Les cartes seront gérées par Stripe (PCI-DSS). Aucune donnée carte ne sera jamais stockée par Cyna.',
    });
  };

  return (
    <section
      id="payment-methods"
      aria-labelledby="payment-methods-heading"
      className="space-y-6"
      data-stripe="payment-methods-placeholder"
    >
      <header>
        <h2 id="payment-methods-heading" className="text-xl font-bold text-foreground sm:text-2xl">
          Méthodes de paiement
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vos cartes seront gérées par Stripe. Aucune donnée carte n&apos;est stockée par Cyna.
        </p>
      </header>

      <div className="rounded-lg border-2 border-dashed border-border bg-card/40 p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck aria-hidden="true" className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">
              Stockage sécurisé par Stripe (conformité PCI-DSS).
            </p>
            <p className="mt-1 text-muted-foreground">
              Lorsque Stripe sera branché, vous pourrez ajouter une carte via un formulaire fourni
              par Stripe Elements directement dans une iframe sécurisée. Les numéros de carte
              n&apos;arriveront jamais sur les serveurs Cyna.
            </p>
          </div>
        </div>
      </div>

      <Button type="button" onClick={handleAddPlaceholder} variant="outline">
        <CreditCard aria-hidden="true" className="mr-2 h-4 w-4" />
        Ajouter une carte (placeholder)
      </Button>
    </section>
  );
}
