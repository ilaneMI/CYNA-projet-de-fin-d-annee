import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe-server';
import { getServiceSupabase } from '@/lib/supabase-service';

export const runtime = 'nodejs';        // Stripe SDK uses Node crypto
export const dynamic = 'force-dynamic'; // never cached

/**
 * Stripe webhook handler.
 *
 * Security invariants:
 *
 * 1. SIGNATURE — verified against the RAW request body (request.text()).
 *    Reading via request.json() and re-stringifying would reorder keys /
 *    re-space and the HMAC would not match. The signature is the ONLY
 *    proof the call came from Stripe.
 *
 * 2. IDEMPOTENCE — every event id is inserted into public.stripe_events on
 *    a UNIQUE primary key. A replay short-circuits to 200 without
 *    re-processing. Defense in depth: orders has a partial unique index on
 *    stripe_checkout_session_id, and place_order_for_user early-returns
 *    the existing row.
 *
 * 3. AUTHORISATION — all DB writes go through SECURITY DEFINER RPCs
 *    granted to service_role only (cf. migration 20260619100100). No raw
 *    inserts on orders/order_items/subscriptions from here.
 *
 * 4. USER ID PROVENANCE — extracted from session.client_reference_id
 *    (set by /api/checkout/session). Never trusted from request body.
 *
 * 5. STATUS — derived from session.payment_status, not hard-coded:
 *      'paid' / 'no_payment_required' → orders.status = 'paid'
 *      'unpaid'                        → orders.status = 'pending'
 *    Avoids marking a deferred-pay session as paid.
 *
 * 6. TOTAL SANITY CHECK — after the server-side sum(unit_amount × qty),
 *    compare to session.amount_total and console.warn on mismatch (no
 *    block). The recompute is exact today (no VAT, no coupons, no
 *    proration); if any of these ever land we will need to store
 *    amount_total directly and stop recomputing.
 *
 * Response contract:
 *   - signature missing or invalid       → 400 (Stripe stops retrying)
 *   - env misconfigured                  → 500 (so we notice)
 *   - already-processed event            → 200 { idempotent: true }
 *   - unhandled event type               → 200 (audit row kept)
 *   - handler crash                      → 500 + delete stripe_events row
 *                                          so the next retry re-processes
 *
 * Mode SUBSCRIPTION: session.payment_intent is typically null (the PI
 * lives on the first invoice). We read it defensively.
 */

type DbSubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

type DbBillingInterval = 'monthly' | 'annual';
type DbPriceUnit = 'flat' | 'per_user' | 'per_device';
type DbOrderStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';

const SUB_STATUS_VALUES: ReadonlyArray<DbSubscriptionStatus> = [
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
];

function mapSubscriptionStatus(raw: string): DbSubscriptionStatus | null {
  return (SUB_STATUS_VALUES as ReadonlyArray<string>).includes(raw)
    ? (raw as DbSubscriptionStatus)
    : null;
}

function mapOrderStatusFromSession(
  payment_status: Stripe.Checkout.Session['payment_status'],
): DbOrderStatus {
  // 'paid' = card charged. 'no_payment_required' = trial / coupon-only.
  // 'unpaid' = async payment method still pending (e.g. SEPA/iDEAL flows).
  if (payment_status === 'paid' || payment_status === 'no_payment_required') {
    return 'paid';
  }
  return 'pending';
}

function toIso(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET is not configured.');
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error(
      '[stripe webhook] signature verification failed:',
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Idempotence : insert the event id; PK unique violation = replay.
  const { error: eventInsertErr } = await supabase
    .from('stripe_events')
    .insert({ id: event.id, type: event.type, livemode: event.livemode });
  if (eventInsertErr) {
    if ((eventInsertErr as { code?: string }).code === '23505') {
      return NextResponse.json({ received: true, idempotent: true });
    }
    console.error('[stripe webhook] failed to record event:', eventInsertErr.message);
    return NextResponse.json({ error: 'persist event failed' }, { status: 500 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(stripe, supabase, event);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionUpsert(supabase, event);
        break;

      default:
        // Unhandled type → no-op, 200. Audit row stays in stripe_events.
        break;
    }
  } catch (err) {
    console.error(`[stripe webhook] handler for ${event.type} failed:`, err);
    // Roll back the idempotency row so Stripe's next retry can actually
    // re-run the handler. Without this delete, the next retry would be
    // 200 idempotent and the event silently dropped.
    await supabase.from('stripe_events').delete().eq('id', event.id);
    return NextResponse.json({ error: 'handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutSessionCompleted(
  stripe: Stripe,
  supabase: ReturnType<typeof getServiceSupabase>,
  event: Stripe.Event,
): Promise<void> {
  const baseSession = event.data.object as Stripe.Checkout.Session;
  // Re-fetch with line_items + product expanded; the event payload omits them.
  const session = await stripe.checkout.sessions.retrieve(baseSession.id, {
    expand: ['line_items.data.price.product'],
  });

  const userId = session.client_reference_id;
  if (!userId) {
    // Cannot bind to a user. Logged + traced. Do NOT throw — that would
    // make Stripe retry forever on a fundamentally bad payload.
    console.error(
      `[stripe webhook] checkout.session.completed ${session.id}: ` +
        'client_reference_id is null, no order created. Investigate.',
    );
    return;
  }

  const email =
    session.customer_details?.email ??
    session.customer_email ??
    (typeof session.metadata?.email === 'string' ? session.metadata.email : '');

  const currency = (session.currency ?? 'eur').toLowerCase();
  const status = mapOrderStatusFromSession(session.payment_status);

  const md = session.metadata ?? {};
  const billing = {
    label: md.billing_label ?? null,
    first_name: md.billing_first_name ?? '',
    last_name: md.billing_last_name ?? '',
    line1: md.billing_line1 ?? '',
    line2: md.billing_line2 ?? null,
    city: md.billing_city ?? '',
    region: md.billing_region ?? null,
    postal_code: md.billing_postal_code ?? '',
    country: md.billing_country ?? '',
    phone: md.billing_phone ?? null,
  };

  const lineItems = session.line_items?.data ?? [];
  const items = lineItems.map((li) => {
    const price = li.price;
    if (!price) {
      throw new Error(`line_item without price on session ${session.id}`);
    }
    const stripeProduct =
      typeof price.product === 'string' ? null : (price.product as Stripe.Product | null);
    const supabaseProductId =
      typeof stripeProduct?.metadata?.supabase_product_id === 'string'
        ? stripeProduct.metadata.supabase_product_id
        : null;
    const unitType: DbPriceUnit =
      (price.metadata?.unit_type as DbPriceUnit | undefined) ?? 'flat';
    const interval: DbBillingInterval =
      price.recurring?.interval === 'year' ? 'annual' : 'monthly';
    return {
      product_id: supabaseProductId,
      name: stripeProduct?.name ?? li.description ?? '',
      billing_interval: interval,
      unit_type: unitType,
      unit_amount: price.unit_amount ?? 0,
      quantity: li.quantity ?? 1,
    };
  });

  // Sanity check — total Stripe charged vs. what we are about to store.
  // The RPC recomputes total = sum(unit_amount × quantity) just like this.
  // Exact today (no VAT, no coupons, no proration). When any of those land
  // we will need to persist session.amount_total directly and STOP
  // recomputing, since the recompute would diverge.
  const recomputedTotal = items.reduce(
    (acc, it) => acc + it.unit_amount * it.quantity,
    0,
  );
  if (
    typeof session.amount_total === 'number' &&
    recomputedTotal !== session.amount_total
  ) {
    console.warn(
      `[stripe webhook] total mismatch on session ${session.id}: ` +
        `recomputed=${recomputedTotal}, stripe=${session.amount_total}. ` +
        'Stripe is authoritative; investigate (probably VAT/coupon/proration ' +
        'landed and we need to switch to storing amount_total directly).',
    );
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const { error } = await supabase.rpc('place_order_for_user', {
    p_user_id: userId,
    p_status: status,
    p_email: email,
    p_currency: currency,
    p_billing: billing,
    p_items: items,
    p_stripe_checkout_session_id: session.id,
    p_stripe_payment_intent_id: paymentIntentId,
  });
  if (error) {
    throw new Error(`place_order_for_user RPC failed: ${error.message}`);
  }
}

async function handleSubscriptionUpsert(
  supabase: ReturnType<typeof getServiceSupabase>,
  event: Stripe.Event,
): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const status = mapSubscriptionStatus(sub.status);
  if (!status) {
    throw new Error(`unknown subscription status: ${sub.status}`);
  }

  const stripeCustomerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  // Resolve user_id : metadata first (set via subscription_data.metadata
  // on the Checkout Session creation), fallback to profiles lookup by
  // stripe_customer_id (covers events triggered outside our Checkout flow
  // such as a Dashboard cancel).
  let userId: string | null =
    typeof sub.metadata?.user_id === 'string' ? sub.metadata.user_id : null;
  if (!userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();
    userId = (profile as { id?: string } | null)?.id ?? null;
  }
  if (!userId) {
    console.error(
      `[stripe webhook] subscription event ${event.type} for unknown customer ` +
        `${stripeCustomerId}; no row to upsert.`,
    );
    return;
  }

  const firstItem = sub.items.data[0];
  const stripePrice = firstItem?.price;
  let productId: string | null = null;
  let priceId: string | null = null;
  if (stripePrice) {
    const { data: priceRow } = await supabase
      .from('prices')
      .select('id, product_id')
      .eq('stripe_price_id', stripePrice.id)
      .maybeSingle();
    productId = (priceRow as { product_id?: string } | null)?.product_id ?? null;
    priceId = (priceRow as { id?: string } | null)?.id ?? null;
  }

  // Stripe API >= 2024-12-18: current_period_* live on subscription items,
  // not on the top-level subscription. SDK 22 types match that.
  const periodStart = toIso(firstItem?.current_period_start);
  const periodEnd = toIso(firstItem?.current_period_end);

  const { error } = await supabase.rpc('upsert_subscription_from_stripe', {
    p_user_id: userId,
    p_stripe_subscription_id: sub.id,
    p_stripe_customer_id: stripeCustomerId,
    p_product_id: productId,
    p_price_id: priceId,
    p_status: status,
    p_quantity: firstItem?.quantity ?? 1,
    p_current_period_start: periodStart,
    p_current_period_end: periodEnd,
    p_cancel_at: toIso(sub.cancel_at),
    p_cancel_at_period_end: sub.cancel_at_period_end ?? false,
  });
  if (error) {
    throw new Error(`upsert_subscription_from_stripe RPC failed: ${error.message}`);
  }
}
