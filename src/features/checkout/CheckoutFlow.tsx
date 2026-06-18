'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/components/ui/use-toast';
import { placeOrder } from '@/lib/data/orders';
import { emptyBilling } from './validation';
import StepIndicator from './StepIndicator';
import Step1Authentication from './Step1Authentication';
import Step2Billing from './Step2Billing';
import Step3Payment from './Step3Payment';
import Step4Confirmation from './Step4Confirmation';
import type { BillingAddress, CheckoutOrder, CheckoutStep } from './types';

/** Fallback order number for the guest demo path (no DB persist). */
const generateLocalOrderNumber = (): string => `ORD-${Date.now().toString(36).toUpperCase()}`;

const splitFullName = (fullName?: string): { firstName: string; lastName: string } => {
  if (!fullName) return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  const [firstName, ...rest] = parts;
  return { firstName: firstName ?? '', lastName: rest.join(' ') };
};

const FlowSkeleton = () => (
  <div className="space-y-6" aria-busy="true" aria-live="polite">
    <div className="h-12 animate-pulse rounded-md border border-border bg-card/40" aria-hidden="true" />
    <div className="h-64 animate-pulse rounded-md border border-border bg-card/40" aria-hidden="true" />
    <span className="sr-only">Chargement du tunnel de paiement…</span>
  </div>
);

export default function CheckoutFlow() {
  const router = useRouter();
  const { cartItems, hydrated, getCartTotal, getItemPrice, clearCart } = useCart();
  const { isAuthenticated, currentUser } = useAuth();
  const { toast } = useToast();
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const [currentStep, setCurrentStep] = useState<CheckoutStep>(1);
  const [billing, setBilling] = useState<BillingAddress>(() => emptyBilling());
  const [order, setOrder] = useState<CheckoutOrder | null>(null);

  // Prefill billing from auth or guest email whenever upstream identity
  // changes and we are still on the early steps.
  useEffect(() => {
    if (currentStep > 2) return;
    if (isAuthenticated && currentUser) {
      const { firstName, lastName } = splitFullName(currentUser.full_name);
      setBilling((prev) => ({
        ...prev,
        firstName: prev.firstName || firstName,
        lastName: prev.lastName || lastName,
        email: prev.email || currentUser.email,
      }));
    }
  }, [isAuthenticated, currentUser, currentStep]);

  // Guard against direct access with an empty cart. Wait for hydration so we
  // don't redirect away before localStorage has finished loading.
  useEffect(() => {
    if (!hydrated) return;
    if (currentStep === 4) return;
    if (cartItems.length === 0) {
      router.replace('/cart');
    }
  }, [hydrated, cartItems.length, currentStep, router]);

  if (!hydrated) {
    return <FlowSkeleton />;
  }

  // The redirect effect above will fire on the next tick — render nothing so
  // the empty checkout shell does not flash for a frame.
  if (cartItems.length === 0 && currentStep < 4) {
    return <FlowSkeleton />;
  }

  const handleAuthChosen = () => setCurrentStep(2);
  const handleGuestChosen = (email: string) => {
    setBilling((prev) => ({ ...prev, email: prev.email || email }));
    setCurrentStep(2);
  };

  const handleBillingDone = (data: BillingAddress) => {
    setBilling(data);
    setCurrentStep(3);
  };

  // Persistence path:
  //   - Authenticated → place_order() RPC writes the order + items atomically
  //     and forces user_id = auth.uid() server-side. Status defaults to
  //     'paid' because the real payment is still a UI placeholder; at Lot D
  //     this handler will hand off to Stripe Checkout and the Stripe webhook
  //     will create/update the order on `checkout.session.completed`, not
  //     this click.
  //   - Guest → no DB persist. The order number is generated client-side so
  //     the confirmation screen still renders, but it will not appear in
  //     /orders. Guest checkout will be re-evaluated at Lot D (Stripe needs
  //     a customer; we may force account creation at that point).
  const handlePaymentConfirmed = async () => {
    if (submittingOrder) return;
    const total = getCartTotal();
    const createdAt = new Date().toISOString();
    let orderNumber = generateLocalOrderNumber();

    if (isAuthenticated && currentUser) {
      setSubmittingOrder(true);
      try {
        const result = await placeOrder({
          status: 'paid',
          email: billing.email,
          billing: {
            first_name: billing.firstName,
            last_name: billing.lastName,
            line1: billing.address1,
            line2: billing.address2,
            city: billing.city,
            region: billing.region,
            postal_code: billing.postalCode,
            country: billing.country,
            phone: billing.phone,
          },
          items: cartItems.map((item) => ({
            productSlug: item.id,
            name: item.name,
            subscriptionDuration: item.subscriptionDuration,
            unitPriceEur: getItemPrice(item),
            quantity: item.quantity,
          })),
        });
        orderNumber = result.orderNumber;
      } catch (err) {
        toast({
          title: "Échec de l'enregistrement de la commande",
          description: err instanceof Error ? err.message : 'Erreur inconnue',
          variant: 'destructive',
        });
        setSubmittingOrder(false);
        return;
      }
      setSubmittingOrder(false);
    }

    const placedOrder: CheckoutOrder = {
      orderNumber,
      total,
      email: billing.email,
      createdAt,
    };

    setOrder(placedOrder);
    clearCart();
    setCurrentStep(4);
  };

  return (
    <div className="space-y-10">
      <StepIndicator current={currentStep} />

      <div>
        {currentStep === 1 && (
          <Step1Authentication
            guestEmail={billing.email}
            onContinueAsAuth={handleAuthChosen}
            onContinueAsGuest={handleGuestChosen}
          />
        )}
        {currentStep === 2 && (
          <Step2Billing
            initial={billing}
            onBack={() => setCurrentStep(1)}
            onContinue={handleBillingDone}
          />
        )}
        {currentStep === 3 && (
          <Step3Payment
            indicativeTotal={getCartTotal()}
            onBack={() => setCurrentStep(2)}
            onConfirmed={() => void handlePaymentConfirmed()}
          />
        )}
        {currentStep === 4 && order && <Step4Confirmation order={order} />}
      </div>
    </div>
  );
}
