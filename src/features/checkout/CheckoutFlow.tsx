'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { emptyBilling } from './validation';
import StepIndicator from './StepIndicator';
import Step1Authentication from './Step1Authentication';
import Step2Billing from './Step2Billing';
import Step3Payment from './Step3Payment';
import Step4Confirmation from './Step4Confirmation';
import type { BillingAddress, CheckoutOrder, CheckoutStep } from './types';

const generateOrderNumber = (): string => `ORD-${Date.now().toString(36).toUpperCase()}`;

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
  const { cartItems, hydrated, getCartTotal, clearCart } = useCart();
  const { isAuthenticated, currentUser } = useAuth();

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

  // FIXME-SECURITY + TODO(supabase): order persistence lives in localStorage
  // for the demo. When Supabase lands, an Edge Function will receive
  // {productIds, quantities, stripeSessionId}, recompute the amount against
  // the catalogue, and create the order row server-side with RLS — no
  // client-supplied amount, no client-supplied user id.
  const handlePaymentConfirmed = () => {
    const total = getCartTotal();
    const placedOrder: CheckoutOrder = {
      orderNumber: generateOrderNumber(),
      total,
      email: billing.email,
      createdAt: new Date().toISOString(),
    };

    try {
      const stored = JSON.parse(localStorage.getItem('orders') ?? '[]') as CheckoutOrder[];
      stored.push(placedOrder);
      localStorage.setItem('orders', JSON.stringify(stored));
    } catch {
      // localStorage may be unavailable (private mode, quota); the order
      // still shows on the confirmation screen, persistence will move to
      // Supabase soon anyway.
    }

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
            onConfirmed={handlePaymentConfirmed}
          />
        )}
        {currentStep === 4 && order && <Step4Confirmation order={order} />}
      </div>
    </div>
  );
}
