import { NextResponse, type NextRequest } from 'next/server';
import { getStripe } from '@/lib/stripe-server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/checkout/session
 *
 * Creates a Stripe Checkout Session (mode: subscription) and returns the
 * hosted-checkout URL. The client navigates to it; no card data ever
 * touches our origin (PCI-DSS = SAQ A scope).
 *
 * Critical invariants:
 *
 * 1. The client sends { items: [{ productSlug, subscriptionDuration,
 *    quantity }], billing }. The client NEVER sends a price, an amount,
 *    or a stripe_price_id. The server resolves the slug + duration to
 *    the public.prices row and reads its stripe_price_id.
 *
 * 2. The session is bound to a Stripe Customer pinned on
 *    profiles.stripe_customer_id. Lookup-or-create, with race protection
 *    on the UNIQUE constraint (a concurrent request from the same user
 *    in another tab could have written a customer id in the meantime —
 *    we re-fetch and use whichever id is canonical).
 *
 * 3. session.client_reference_id = user.id (mirrored in metadata and
 *    subscription_data.metadata). The webhook treats this as the user
 *    identity, NEVER what the browser claims.
 *
 * 4. Billing snapshot in metadata as SEPARATE KEYS (Stripe limit 500
 *    chars per value), assembled into a jsonb by the webhook handler.
 */

type SubscriptionDuration = 'monthly' | 'annual' | 'per_user';

const VALID_DURATIONS: ReadonlySet<SubscriptionDuration> = new Set([
  'monthly',
  'annual',
  'per_user',
]);

type CartItemIn = {
  productSlug: string;
  subscriptionDuration: SubscriptionDuration;
  quantity: number;
};

type BillingIn = {
  firstName: string;
  lastName: string;
  email: string;
  address1: string;
  address2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string;
  phone?: string;
};

type Body = {
  items: CartItemIn[];
  billing: BillingIn;
};

function fromDuration(d: SubscriptionDuration): {
  billing_interval: 'monthly' | 'annual';
  unit_type: 'flat' | 'per_user';
} {
  if (d === 'per_user') return { billing_interval: 'monthly', unit_type: 'per_user' };
  if (d === 'annual') return { billing_interval: 'annual', unit_type: 'flat' };
  return { billing_interval: 'monthly', unit_type: 'flat' };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabaseUser = getServerSupabase();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'authentication required' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'empty cart' }, { status: 400 });
  }
  if (!body.billing) {
    return NextResponse.json({ error: 'billing required' }, { status: 400 });
  }
  for (const item of body.items) {
    if (!VALID_DURATIONS.has(item.subscriptionDuration)) {
      return NextResponse.json(
        { error: `invalid subscriptionDuration: ${item.subscriptionDuration}` },
        { status: 400 },
      );
    }
    if (!item.productSlug || typeof item.productSlug !== 'string') {
      return NextResponse.json({ error: 'item missing productSlug' }, { status: 400 });
    }
    if (!Number.isFinite(item.quantity) || item.quantity < 1) {
      return NextResponse.json({ error: 'item quantity must be >= 1' }, { status: 400 });
    }
  }

  // Resolve { slug × duration } → stripe_price_id server-side ONLY.
  const supabaseAdmin = getServiceSupabase();
  const lineItems: Array<{ price: string; quantity: number }> = [];
  for (const item of body.items) {
    const { billing_interval, unit_type } = fromDuration(item.subscriptionDuration);

    const { data: product, error: productErr } = await supabaseAdmin
      .from('products')
      .select('id, slug')
      .eq('slug', item.productSlug)
      .maybeSingle();
    if (productErr) {
      return NextResponse.json(
        { error: `product lookup failed: ${productErr.message}` },
        { status: 500 },
      );
    }
    if (!product) {
      return NextResponse.json(
        { error: `unknown product: ${item.productSlug}` },
        { status: 404 },
      );
    }

    const { data: priceRow, error: priceErr } = await supabaseAdmin
      .from('prices')
      .select('stripe_price_id')
      .eq('product_id', (product as { id: string }).id)
      .eq('billing_interval', billing_interval)
      .eq('unit_type', unit_type)
      .eq('is_active', true)
      .maybeSingle();
    if (priceErr) {
      return NextResponse.json(
        { error: `price lookup failed: ${priceErr.message}` },
        { status: 500 },
      );
    }
    if (!priceRow) {
      return NextResponse.json(
        {
          error: `no active price for ${item.productSlug} ${item.subscriptionDuration}`,
        },
        { status: 404 },
      );
    }
    const stripePriceId = (priceRow as { stripe_price_id: string | null }).stripe_price_id;
    if (!stripePriceId) {
      return NextResponse.json(
        {
          error:
            `${item.productSlug} (${item.subscriptionDuration}) is not yet seeded in Stripe — ` +
            'run `node tools/seed-stripe-prices.mjs` and retry.',
        },
        { status: 500 },
      );
    }

    lineItems.push({
      price: stripePriceId,
      quantity: Math.max(1, Math.floor(item.quantity)),
    });
  }

  // Get-or-create Stripe Customer pinned on the profile.
  const { data: existingProfile } = await supabaseUser
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();
  let stripeCustomerId =
    (existingProfile as { stripe_customer_id: string | null } | null)?.stripe_customer_id ??
    null;

  const stripe = getStripe();
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: body.billing.email || user.email || undefined,
      name: `${body.billing.firstName} ${body.billing.lastName}`.trim() || undefined,
      metadata: { user_id: user.id },
    });
    const newCustomerId = customer.id;

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ stripe_customer_id: newCustomerId })
      .eq('id', user.id);

    if (updateErr) {
      // 23505 = unique violation. Can happen when a concurrent request
      // (double-click, second tab) wrote a customer id in the meantime
      // OR — extremely unlikely — Stripe returned a customer id we
      // already had on another profile. Either way: re-fetch the
      // canonical id and use it; the freshly-created customer is
      // orphaned in Stripe but harmless (Stripe test mode is cheap).
      if ((updateErr as { code?: string }).code === '23505') {
        const { data: refreshed } = await supabaseUser
          .from('profiles')
          .select('stripe_customer_id')
          .eq('id', user.id)
          .maybeSingle();
        const refreshedId =
          (refreshed as { stripe_customer_id: string | null } | null)?.stripe_customer_id ??
          null;
        if (refreshedId) {
          stripeCustomerId = refreshedId;
        } else {
          // Fallback: nothing we can do — use the one we just created.
          // The next request will overwrite. Log for visibility.
          console.error(
            `[checkout] 23505 on stripe_customer_id but no row returned for user ${user.id}; ` +
              `using freshly-created ${newCustomerId}`,
          );
          stripeCustomerId = newCustomerId;
        }
      } else {
        console.error(
          '[checkout] failed to persist stripe_customer_id:',
          updateErr.message,
        );
        // Use the freshly-created id anyway; the next request will create
        // and overwrite. Not great but not blocking the checkout.
        stripeCustomerId = newCustomerId;
      }
    } else {
      stripeCustomerId = newCustomerId;
    }
  }

  // Origin for redirect URLs. NEXT_PUBLIC_SITE_URL preferred for prod
  // behind a proxy; fall back to the request origin for dev.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;

  // Billing snapshot as SEPARATE metadata keys. Each value < 500 chars
  // (Stripe limit). The webhook reassembles them into the jsonb passed
  // to place_order_for_user.
  const metadata: Record<string, string> = {
    user_id: user.id,
    billing_first_name: body.billing.firstName,
    billing_last_name: body.billing.lastName,
    billing_line1: body.billing.address1,
    billing_city: body.billing.city,
    billing_postal_code: body.billing.postalCode,
    billing_country: body.billing.country,
  };
  if (body.billing.address2) metadata.billing_line2 = body.billing.address2;
  if (body.billing.region) metadata.billing_region = body.billing.region;
  if (body.billing.phone) metadata.billing_phone = body.billing.phone;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: lineItems,
    customer: stripeCustomerId,
    client_reference_id: user.id,
    metadata,
    subscription_data: {
      // Mirror on the subscription so customer.subscription.* events get a
      // direct user_id without needing a profiles lookup.
      metadata: { user_id: user.id },
    },
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout`,
    allow_promotion_codes: false,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: 'stripe did not return a checkout url' },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: session.url });
}
