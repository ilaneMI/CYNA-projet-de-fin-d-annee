import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import type Stripe from 'stripe';
import { getServiceSupabase } from '@/lib/supabase-service';
import { getStripe } from '@/lib/stripe-server';
import { requireAdminAAL2 } from '@/lib/admin/require-aal2';
import { logAdminAction } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';        // Stripe SDK needs Node crypto
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/prices/[id]
 *
 * Stripe-aware unit_amount change for a public.prices row.
 *
 * STRIPE PRICES ARE IMMUTABLE — there is no Stripe API to mutate
 * `unit_amount` on an existing Price. The only correct way to change a
 * montant is to:
 *
 *   (1) create a NEW Stripe Price on the SAME Stripe Product with the
 *       new unit_amount,
 *   (2) flip public.prices to point at it (UPDATE unit_amount +
 *       stripe_price_id),
 *   (3) archive the OLD Stripe Price (active:false) as best-effort
 *       cleanup so it cannot be reused via Checkout.
 *
 * INVARIANT defended at every observable moment:
 *     public.prices.stripe_price_id references a Stripe Price that exists
 *     AND whose unit_amount matches public.prices.unit_amount.
 *
 * Why this ordering and not anything else:
 *   - archive-first (3→1→2): between (3) and (2) the DB still references
 *     the OLD price id, which is now inactive in Stripe → any Checkout
 *     session created in that window fails. Rejected.
 *   - DB-first (2→1→3): between (2) and (1) the DB references a Stripe
 *     Price id that does not yet exist → Checkout fails. Rejected.
 *   - 1→2→3 keeps the invariant true at every step.
 *
 * Per-step failure (each leaves the invariant intact):
 *   step 1 fails → nothing changed; surface the error.
 *   step 2 fails → the freshly-created Stripe Price is orphaned in
 *                  Stripe but not referenced anywhere in DB. The DB still
 *                  points at the OLD price; on-going traffic is fine.
 *                  We log the orphan id so it can be archived manually,
 *                  then surface the error.
 *   step 3 fails → NOT BLOCKING. The old Stripe Price stays active in
 *                  Stripe but is no longer referenced in DB. Nobody can
 *                  reach it through Checkout (the session route resolves
 *                  prices via public.prices.is_active + stripe_price_id,
 *                  both gated by what the DB says). Log a warning,
 *                  return 200 with deactivation_of_previous: 'failed'.
 *
 * IN-FLIGHT SUBSCRIPTIONS — IMPORTANT and BY DESIGN:
 *   Subscriptions ALREADY created on the OLD Stripe Price KEEP billing
 *   the OLD amount until they renew or are explicitly migrated. This is
 *   Stripe's intended behaviour for Price objects: a Price is the
 *   contractual amount, and an active Subscription is bound to the Price
 *   it was created with. Only NEW Checkout sessions and NEW subscriptions
 *   created AFTER step (2) hit the new amount. If migrating in-flight
 *   subs to the new amount ever becomes a requirement, that is a
 *   separate flow (a batch job calling stripe.subscriptions.update with
 *   the new price id and explicit proration_behavior) and is out of
 *   scope for this endpoint.
 *
 * AUTHENTICATION / AUTHORISATION:
 *   - session is read from cookies via getServerSupabase() → 401 if absent.
 *   - admin role is checked via the is_admin() RPC running with the
 *     caller's auth.uid() → 403 if not admin. We deliberately do NOT
 *     wrap the Stripe orchestration in a SQL RPC; Stripe SDK calls
 *     belong on the Node side.
 *   - DB write goes through the service-role client. The public.prices
 *     table has no UPDATE policy for `authenticated`, so this is the
 *     only legitimate write path. A UI bug here cannot escalate
 *     because step (1) (Stripe.prices.create) requires Stripe secrets
 *     that never leave the server.
 *
 * CURRENCY is read from the existing row and never from the payload.
 * Changing currency mid-flight would silently swap a EUR price for a
 * USD price and rot already-built carts; that is a different operation
 * and belongs to a different endpoint if it is ever needed.
 *
 * Response codes:
 *   200 — bascule succeeded (deactivation_of_previous may be 'failed')
 *   200 — amount unchanged (no-op, no Stripe call made)
 *   400 — invalid body / invalid unit_amount
 *   401 — not authenticated
 *   403 — authenticated but not admin
 *   404 — price not found
 *   409 — price has no stripe_price_id (never seeded; run the seed script)
 *   500 — DB lookup failed or step (2) failed (with orphaned_stripe_price_id)
 *   502 — Stripe SDK call in step (1) failed
 */

const VALID_INTERVALS: Record<'monthly' | 'annual', Stripe.PriceCreateParams.Recurring.Interval> = {
  monthly: 'month',
  annual: 'year',
};

type PriceRow = {
  id: string;
  product_id: string;
  currency: string;
  billing_interval: 'monthly' | 'annual';
  unit_type: 'flat' | 'per_user' | 'per_device';
  unit_amount: number;
  stripe_price_id: string | null;
  is_active: boolean;
};

type PatchBody = { unit_amount?: unknown };

function revalidateCatalogue(): void {
  revalidatePath('/');
  revalidatePath('/catalogue');
  revalidatePath('/category/[id]', 'page');
  revalidatePath('/product/[id]', 'page');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  // --- 1-2. AuthN + AuthZ + AAL2 ------------------------------------------
  // requireAdminAAL2 fait : getUser (401) → is_admin RPC (403 "admin
  // required") → getAuthenticatorAssuranceLevel (403 "aal2 required").
  // Ferme le gap F2 : AAL1 admin ne peut plus muter via cette route.
  const guard = await requireAdminAAL2();
  if (!guard.ok) return guard.response;
  const { user } = guard;

  // --- 3. Body validation --------------------------------------------------
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const newAmount = body.unit_amount;
  if (
    typeof newAmount !== 'number' ||
    !Number.isFinite(newAmount) ||
    !Number.isInteger(newAmount) ||
    newAmount < 1
  ) {
    return NextResponse.json(
      { error: 'unit_amount must be a positive integer (centimes)' },
      { status: 400 },
    );
  }

  // --- 4. Load the row (service-role bypasses RLS, uniform error mapping)--
  const supabaseAdmin = getServiceSupabase();
  const { data: rowRaw, error: rowErr } = await supabaseAdmin
    .from('prices')
    .select(
      'id, product_id, currency, billing_interval, unit_type, unit_amount, stripe_price_id, is_active',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (rowErr) {
    return NextResponse.json(
      { error: `price lookup failed: ${rowErr.message}` },
      { status: 500 },
    );
  }
  if (!rowRaw) {
    return NextResponse.json({ error: 'price not found' }, { status: 404 });
  }
  const priceRow = rowRaw as PriceRow;

  if (!priceRow.stripe_price_id) {
    return NextResponse.json(
      {
        error:
          'price has no stripe_price_id — run tools/seed-stripe-prices.mjs first',
      },
      { status: 409 },
    );
  }

  const interval = VALID_INTERVALS[priceRow.billing_interval];
  if (!interval) {
    return NextResponse.json(
      { error: `unsupported billing_interval: ${priceRow.billing_interval}` },
      { status: 500 },
    );
  }

  // No-op short-circuit. We do NOT mint a duplicate Stripe Price when the
  // amount is unchanged; that would clutter Stripe with identical Price
  // objects for nothing.
  if (newAmount === priceRow.unit_amount) {
    return NextResponse.json({
      data: priceRow,
      replaced: false,
      note: 'amount unchanged',
    });
  }

  const stripe = getStripe();
  const oldStripePriceId = priceRow.stripe_price_id;

  // --- 5. STEP 1 — create the new Stripe Price -----------------------------
  // We resolve the stripe Product by retrieving the old Price and reading
  // its `product` field. No need for a separate column on public.products
  // and no need to re-run the products.search() the seed uses on first
  // bootstrap — every priced row already has a Stripe Product behind it.
  let oldStripePrice: Stripe.Price;
  try {
    oldStripePrice = await stripe.prices.retrieve(oldStripePriceId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `stripe.prices.retrieve failed: ${msg}` },
      { status: 502 },
    );
  }
  const stripeProductId =
    typeof oldStripePrice.product === 'string'
      ? oldStripePrice.product
      : oldStripePrice.product?.id;
  if (!stripeProductId) {
    return NextResponse.json(
      { error: 'cannot resolve stripe product from old price' },
      { status: 500 },
    );
  }

  let newStripePrice: Stripe.Price;
  try {
    newStripePrice = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: newAmount,
      currency: priceRow.currency,
      recurring: { interval },
      // Mirror the metadata shape written by tools/seed-stripe-prices.mjs
      // so any downstream that resolves Stripe Price → public.prices row
      // (e.g. the webhook) keeps working unchanged.
      metadata: {
        supabase_price_id: priceRow.id,
        supabase_product_id: priceRow.product_id,
        unit_type: priceRow.unit_type,
      },
      nickname: `${stripeProductId}/${priceRow.billing_interval}/${priceRow.unit_type}`,
      active: true,
    });
  } catch (err) {
    // Step 1 failed — nothing has changed anywhere. Invariant intact.
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `stripe.prices.create failed: ${msg}` },
      { status: 502 },
    );
  }

  // --- 6. STEP 2 — flip the DB to point at the new Stripe Price ------------
  const { error: updateErr } = await supabaseAdmin
    .from('prices')
    .update({ unit_amount: newAmount, stripe_price_id: newStripePrice.id })
    .eq('id', priceRow.id);
  if (updateErr) {
    // Step 2 failed. The new Stripe Price is orphaned in Stripe (not
    // referenced anywhere in DB). The DB still points at the OLD price,
    // so the invariant holds: every observable read still sees a
    // matching (stripe_price_id, unit_amount) pair.
    console.error(
      `[admin/prices] DB update failed AFTER creating Stripe Price ${newStripePrice.id} ` +
        `for prices.id=${priceRow.id}. Orphan Stripe Price — archive manually via ` +
        `stripe.prices.update(${newStripePrice.id}, { active: false }). ` +
        `DB error: ${updateErr.message}`,
    );
    return NextResponse.json(
      {
        error: `db update failed: ${updateErr.message}`,
        orphaned_stripe_price_id: newStripePrice.id,
      },
      { status: 500 },
    );
  }

  // --- 7. STEP 3 — best-effort archive of the old Stripe Price -------------
  // Non-blocking. A failure here leaves the OLD price active in Stripe
  // but unreachable from our system (no DB row points to it any more).
  // In-flight subscriptions on the OLD price keep billing the OLD
  // amount — that is the intended Stripe semantic; see header comment.
  let deactivation: 'ok' | 'failed' = 'ok';
  try {
    await stripe.prices.update(oldStripePriceId, { active: false });
  } catch (err) {
    deactivation = 'failed';
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[admin/prices] best-effort deactivation of old Stripe Price ${oldStripePriceId} ` +
        `failed (non-blocking, in-flight subs unaffected): ${msg}`,
    );
  }

  // AUDIT LOG POINT (Ticket 44) — best-effort. Uniquement sur la
  // branche "replaced=true" (le no-op amount unchanged plus haut ne
  // constitue pas une mutation à tracer).
  await logAdminAction({
    actor: { id: user.id, email: user.email ?? null },
    action: 'update',
    entityType: 'price',
    entityId: priceRow.id,
    summary: `Prix ${priceRow.billing_interval}/${priceRow.unit_type} passé de ${priceRow.unit_amount} à ${newAmount} centimes`,
    diff: {
      from: priceRow.unit_amount,
      to: newAmount,
      previous_stripe_price_id: oldStripePriceId,
      new_stripe_price_id: newStripePrice.id,
      deactivation_of_previous: deactivation,
    },
  });

  revalidateCatalogue();

  return NextResponse.json({
    data: {
      ...priceRow,
      unit_amount: newAmount,
      stripe_price_id: newStripePrice.id,
    },
    replaced: true,
    previous_stripe_price_id: oldStripePriceId,
    new_stripe_price_id: newStripePrice.id,
    deactivation_of_previous: deactivation,
  });
}
