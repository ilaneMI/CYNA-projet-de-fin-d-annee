import type { Order, OrderItem, OrderItemDuration, OrderStatus } from './types';

/**
 * localStorage adapter for orders.
 *
 * Phase 1 (current): single shared `orders` key written by the Checkout
 *   tunnel. Each user filters by `email` since the legacy shape did not
 *   carry a user id.
 * Phase 2 (Supabase): replaced by a typed query against the `orders` table
 *   with RLS (`auth.uid() = orders.user_id`). The Order shape stays stable.
 */

const STORAGE_KEY = 'orders';

type StoredOrder = {
  orderNumber?: unknown;
  total?: unknown;
  createdAt?: unknown;
  email?: unknown;
  status?: unknown;
  items?: unknown;
  paymentMethod?: unknown;
  billingInfo?: { email?: unknown } & Record<string, unknown>;
};

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const normaliseStatus = (raw: unknown): OrderStatus => {
  if (!isString(raw)) return 'completed';
  const lower = raw.trim().toLowerCase();
  if (lower === 'pending' || lower === 'en attente') return 'pending';
  if (lower === 'cancelled' || lower === 'annulée' || lower === 'annulee') return 'cancelled';
  return 'completed';
};

const normaliseDuration = (raw: unknown): OrderItemDuration => {
  if (raw === 'annual' || raw === 'per_user') return raw;
  return 'monthly';
};

const normaliseItem = (raw: unknown): OrderItem | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  const name = isString(candidate.name) ? candidate.name : '';
  if (!name) return null;
  const quantity = isNumber(candidate.quantity) ? candidate.quantity : 1;
  const subscriptionDuration = normaliseDuration(candidate.subscriptionDuration);
  const unitPriceCandidate =
    candidate.unitPrice ?? candidate.price_monthly ?? candidate.price_annual ?? candidate.price_per_user ?? 0;
  const unitPrice = isNumber(unitPriceCandidate) ? unitPriceCandidate : 0;
  return { name, quantity, subscriptionDuration, unitPrice };
};

const normaliseOrder = (raw: StoredOrder): Order | null => {
  if (!isString(raw.orderNumber)) return null;
  const createdAt = isString(raw.createdAt) ? raw.createdAt : new Date().toISOString();
  const parsedDate = new Date(createdAt);
  if (Number.isNaN(parsedDate.getTime())) return null;
  const year = parsedDate.getFullYear();
  const total = isNumber(raw.total) ? raw.total : 0;
  const email = isString(raw.email)
    ? raw.email
    : isString(raw.billingInfo?.email)
      ? (raw.billingInfo!.email as string)
      : '';
  const status = normaliseStatus(raw.status);
  const items = Array.isArray(raw.items)
    ? raw.items.map(normaliseItem).filter((item): item is OrderItem => item !== null)
    : [];
  const paymentMethodMasked = isString(raw.paymentMethod)
    ? raw.paymentMethod
    : 'Carte bancaire — gérée par Stripe';

  return {
    orderNumber: raw.orderNumber,
    createdAt,
    year,
    total,
    email,
    status,
    items,
    paymentMethodMasked,
  };
};

const safeRead = (): StoredOrder[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredOrder[]) : [];
  } catch {
    return [];
  }
};

export const listOrders = (userEmail: string | null | undefined): Order[] => {
  const stored = safeRead();
  const normalised = stored
    .map(normaliseOrder)
    .filter((order): order is Order => order !== null);
  if (!userEmail) return normalised;
  // Phase 1: scope by email since the legacy storage shape lacks user_id.
  // Orders with no email still surface (they were placed in guest mode
  // before email capture landed).
  return normalised.filter((order) => order.email === '' || order.email === userEmail);
};

export const getOrderById = (
  userEmail: string | null | undefined,
  orderNumber: string,
): Order | null => listOrders(userEmail).find((order) => order.orderNumber === orderNumber) ?? null;
