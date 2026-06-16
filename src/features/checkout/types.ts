/**
 * Domain types for the checkout tunnel.
 *
 * Anything that touches money or order placement is provisional: when the
 * Stripe + Supabase integration lands, the order is created and validated
 * server-side. The shapes below describe the client-side intent only.
 */

export type CheckoutStep = 1 | 2 | 3 | 4;

export type BillingAddress = {
  firstName: string;
  lastName: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
};

export type BillingErrors = Partial<Record<keyof BillingAddress, string>>;

export type CheckoutOrder = {
  orderNumber: string;
  /** Total displayed at confirmation. FIXME-SECURITY: indicative only. */
  total: number;
  email: string;
  createdAt: string;
};
