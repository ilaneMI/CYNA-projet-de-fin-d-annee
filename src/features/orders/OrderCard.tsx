'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileDown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { Order } from './types';
import { DURATION_LABEL, ORDER_STATUS_LABEL } from './filtering';

const STATUS_CLASS: Record<Order['status'], string> = {
  completed: 'border-green-800 bg-green-900/40 text-green-200',
  pending: 'border-yellow-800 bg-yellow-900/40 text-yellow-200',
  cancelled: 'border-red-800 bg-red-900/40 text-red-200',
};

const formatPrice = (value: number): string => `$${value.toLocaleString('fr-FR')}`;

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

type Props = { order: Order };

export default function OrderCard({ order }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const detailId = `order-detail-${order.orderNumber}`;
  const itemsLabel = order.items.length === 1 ? '1 service' : `${order.items.length} services`;

  // FIXME-SECURITY + TODO(supabase): invoice generation must move to a
  // Supabase Edge Function that fetches the order server-side (RLS) and
  // returns a signed PDF URL. Letting the client compose the invoice would
  // make it forgeable.
  const handleDownload = () => {
    toast({
      title: 'Génération de la facture',
      description: 'Le PDF sera fourni par une Edge Function Supabase au branchement.',
    });
  };

  return (
    <article
      aria-labelledby={`${detailId}-heading`}
      className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id={`${detailId}-heading`} className="text-base font-semibold text-foreground">
            Commande {order.orderNumber}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatDate(order.createdAt)} · {itemsLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_CLASS[order.status]}`}
            aria-label={`Statut : ${ORDER_STATUS_LABEL[order.status]}`}
          >
            {ORDER_STATUS_LABEL[order.status]}
          </span>
          <span className="text-lg font-bold text-primary">{formatPrice(order.total)}</span>
        </div>
      </header>

      <ul role="list" className="mt-4 space-y-1 text-sm text-muted-foreground">
        {order.items.slice(0, 3).map((item, index) => (
          <li key={`${order.orderNumber}-${index}`}>
            <span className="text-foreground">{item.name}</span>
            <span> — {DURATION_LABEL[item.subscriptionDuration]} × {item.quantity}</span>
          </li>
        ))}
        {order.items.length > 3 && (
          <li className="text-xs italic">+ {order.items.length - 3} autres services</li>
        )}
        {order.items.length === 0 && (
          <li className="text-xs italic">Détails des services indisponibles pour cette commande.</li>
        )}
      </ul>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls={detailId}
          className="inline-flex items-center gap-1 self-start text-sm text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {expanded ? (
            <>
              <ChevronUp aria-hidden="true" className="h-4 w-4" />
              Masquer le détail
            </>
          ) : (
            <>
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
              Voir le détail
            </>
          )}
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          data-invoice="placeholder"
        >
          <FileDown aria-hidden="true" className="mr-2 h-4 w-4" />
          Télécharger la facture
        </Button>
      </div>

      {expanded && (
        <div id={detailId} className="mt-5 space-y-5 rounded-md border border-border bg-background/40 p-4">
          <section aria-label="Récapitulatif des services">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Services commandés</h4>
            <ul role="list" className="space-y-2">
              {order.items.map((item, index) => (
                <li
                  key={`${order.orderNumber}-detail-${index}`}
                  className="flex flex-col gap-1 rounded-md border border-border bg-card/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {DURATION_LABEL[item.subscriptionDuration]} · Quantité {item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {formatPrice(item.unitPrice * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Total indicatif. Le montant débité par Stripe est recalculé serveur-side au paiement.
            </p>
          </section>

          {/* FIXME-SECURITY: payment method shown as a static placeholder so
              no fake PAN or last4 ever reaches the DOM. Once Stripe lands,
              this will show the masked card (e.g. "Visa •••• 4242") served
              by stripe.paymentMethods.retrieve on the server. */}
          <section aria-label="Moyen de paiement">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Moyen de paiement</h4>
            <div className="flex items-start gap-3 rounded-md border border-border bg-card/40 p-3 text-sm">
              <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <div>
                <p className="text-foreground">{order.paymentMethodMasked}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Les informations carte sont stockées chez Stripe (PCI-DSS). Cyna ne reçoit
                  qu&apos;un identifiant tokenisé.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </article>
  );
}
