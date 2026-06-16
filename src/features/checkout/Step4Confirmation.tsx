'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CheckoutOrder } from './types';

const formatPrice = (value: number): string => `$${value.toLocaleString('fr-FR')}`;

type Props = { order: CheckoutOrder };

export default function Step4Confirmation({ order }: Props) {
  return (
    <section
      aria-labelledby="step-4-heading"
      className="rounded-lg border border-border bg-card p-8 text-center shadow-sm"
    >
      <div
        aria-hidden="true"
        className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15"
      >
        <CheckCircle2 className="h-10 w-10 text-primary" />
      </div>

      <h2 id="step-4-heading" className="mb-2 text-2xl font-bold text-foreground">
        Commande enregistrée
      </h2>
      <p className="mx-auto mb-6 max-w-md text-muted-foreground">
        Merci pour votre achat. Un email de confirmation a été envoyé à{' '}
        <span className="font-medium text-foreground">{order.email}</span> avec le récapitulatif et
        le reçu.
      </p>

      <dl className="mx-auto mb-8 max-w-sm rounded-md border border-input bg-secondary/40 p-4 text-left">
        <div className="mb-2 flex items-center justify-between text-sm">
          <dt className="text-muted-foreground">Numéro de commande</dt>
          <dd className="font-mono font-bold text-primary">{order.orderNumber}</dd>
        </div>
        <div className="flex items-center justify-between text-sm">
          <dt className="text-muted-foreground">Montant indicatif</dt>
          <dd className="font-semibold text-foreground">{formatPrice(order.total)}</dd>
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
