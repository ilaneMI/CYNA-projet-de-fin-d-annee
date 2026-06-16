import type { Metadata } from 'next';
import CheckoutFlow from '@/features/checkout/CheckoutFlow';

export const metadata: Metadata = {
  title: 'Paiement — Cyna',
  description: 'Finalisez votre commande Cyna en quelques étapes.',
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <div className="bg-background py-10 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-2xl font-bold text-foreground sm:text-3xl">Paiement</h1>
        <CheckoutFlow />
      </div>
    </div>
  );
}
