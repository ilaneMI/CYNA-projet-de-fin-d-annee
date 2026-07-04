#!/usr/bin/env node
/**
 * tools/test-price-update.mjs
 *
 * End-to-end test of the CRUD-2 Stripe-aware price update.
 *
 * What this proves:
 *   1. The bascule changes both `public.prices.unit_amount` AND
 *      `public.prices.stripe_price_id` (the old id is replaced).
 *   2. The OLD Stripe Price is archived (active:false).
 *   3. The NEW Stripe Price billing flow really charges the NEW amount —
 *      we bill a Visa 4242 test subscription against the new price id and
 *      assert that Stripe's invoice.total equals the new amount in centimes.
 *   4. The original amount is restored at the end, so the script is
 *      repeatable.
 *
 * What this drives:
 *   The bascule is invoked via the SAME ORCHESTRATION the route handler
 *   uses (stripe.prices.retrieve → stripe.prices.create → service-role
 *   UPDATE → stripe.prices.update active:false). It does NOT hit the
 *   HTTP route — minting `supabase-ssr` cookie sessions from a Node
 *   script is fragile and would mostly test cookie plumbing, not the
 *   bascule itself. The HTTP layer (auth/admin gating) is straightforward
 *   and exercised manually from the admin UI.
 *
 * Stripe test mode ONLY. Refuses to run against a live key.
 *
 *   node tools/test-price-update.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// --- env --------------------------------------------------------------------
function loadEnv() {
  const path = '.env.local';
  if (!existsSync(path)) {
    console.error('error: .env.local not found. Run from the repo root.');
    process.exit(2);
  }
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const env = loadEnv();
const REQ = ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const k of REQ) {
  if (!env[k]) {
    console.error(`error: ${k} missing from .env.local`);
    process.exit(2);
  }
}
if (!env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.error('refusing to run: STRIPE_SECRET_KEY is not a test key (sk_test_*).');
  process.exit(2);
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' });
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// --- helpers ----------------------------------------------------------------
let failed = false;
function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function ko(msg) {
  failed = true;
  console.log(`  ✗ ${msg}`);
}
function assert(cond, msg) {
  if (cond) ok(msg);
  else ko(msg);
}
function step(label) {
  console.log(`\n--- ${label} ---`);
}

/**
 * Replays the production route handler's orchestration. Mirror, not
 * duplicate logic — if the route handler ever diverges this must be
 * updated in lockstep.
 */
async function bascule(row, newAmount) {
  const oldId = row.stripe_price_id;
  const old = await stripe.prices.retrieve(oldId);
  const productId = typeof old.product === 'string' ? old.product : old.product.id;
  const interval = row.billing_interval === 'annual' ? 'year' : 'month';

  // step 1
  const created = await stripe.prices.create({
    product: productId,
    unit_amount: newAmount,
    currency: row.currency,
    recurring: { interval },
    metadata: {
      supabase_price_id: row.id,
      supabase_product_id: row.product_id,
      unit_type: row.unit_type,
    },
    nickname: `${productId}/${row.billing_interval}/${row.unit_type}`,
    active: true,
  });

  // step 2
  const { error } = await supabase
    .from('prices')
    .update({ unit_amount: newAmount, stripe_price_id: created.id })
    .eq('id', row.id);
  if (error) {
    console.error(`! DB update failed; orphan Stripe Price ${created.id}`);
    throw new Error(error.message);
  }

  // step 3 (best-effort)
  try {
    await stripe.prices.update(oldId, { active: false });
  } catch (e) {
    console.warn(`! warning: failed to archive old price ${oldId}: ${e.message}`);
  }

  return created.id;
}

// ===========================================================================
// 1. pick a target price
// ===========================================================================
step('picking an active price with a stripe_price_id');

const { data: target, error: pickErr } = await supabase
  .from('prices')
  .select(
    'id, product_id, currency, billing_interval, unit_type, unit_amount, stripe_price_id, is_active',
  )
  .not('stripe_price_id', 'is', null)
  .eq('is_active', true)
  .order('created_at', { ascending: true })
  .limit(1)
  .maybeSingle();

if (pickErr) {
  console.error('pick price failed:', pickErr.message);
  process.exit(1);
}
if (!target) {
  console.error(
    'no active price with a stripe_price_id. Run `node tools/seed-stripe-prices.mjs` first.',
  );
  process.exit(1);
}

const ORIGINAL_AMOUNT = target.unit_amount;
const ORIGINAL_STRIPE_PRICE_ID = target.stripe_price_id;
const NEW_AMOUNT = ORIGINAL_AMOUNT + 100;

console.log(`  prices.id            = ${target.id}`);
console.log(`  product_id           = ${target.product_id}`);
console.log(`  ${target.currency} ${target.billing_interval}/${target.unit_type}`);
console.log(`  unit_amount          : ${ORIGINAL_AMOUNT} -> ${NEW_AMOUNT} (centimes)`);
console.log(`  old stripe_price_id  : ${ORIGINAL_STRIPE_PRICE_ID}`);

// ===========================================================================
// 2. perform the bascule
// ===========================================================================
step('bascule (step 1 create + step 2 DB update + step 3 archive)');
const newStripePriceId = await bascule(target, NEW_AMOUNT);
console.log(`  new stripe_price_id  : ${newStripePriceId}`);

// ===========================================================================
// 3. verify DB state
// ===========================================================================
step('verify DB');
const { data: after, error: afterErr } = await supabase
  .from('prices')
  .select('id, unit_amount, stripe_price_id')
  .eq('id', target.id)
  .maybeSingle();
if (afterErr) {
  console.error('post-state read failed:', afterErr.message);
  process.exit(1);
}
assert(after.unit_amount === NEW_AMOUNT, `prices.unit_amount = ${NEW_AMOUNT}`);
assert(
  after.stripe_price_id === newStripePriceId,
  `prices.stripe_price_id rotated to ${newStripePriceId}`,
);
assert(
  after.stripe_price_id !== ORIGINAL_STRIPE_PRICE_ID,
  'prices.stripe_price_id is NOT the old id',
);

// ===========================================================================
// 4. verify Stripe state
// ===========================================================================
step('verify Stripe');
const oldOnStripe = await stripe.prices.retrieve(ORIGINAL_STRIPE_PRICE_ID);
assert(
  oldOnStripe.active === false,
  `old Stripe Price ${ORIGINAL_STRIPE_PRICE_ID} is archived (active:false)`,
);
const newOnStripe = await stripe.prices.retrieve(newStripePriceId);
assert(newOnStripe.active === true, `new Stripe Price ${newStripePriceId} is active`);
assert(
  newOnStripe.unit_amount === NEW_AMOUNT,
  `new Stripe Price unit_amount = ${NEW_AMOUNT}`,
);
assert(
  newOnStripe.currency === target.currency,
  `new Stripe Price currency = ${target.currency} (locked from existing row)`,
);

// ===========================================================================
// 5. bill a test payment 4242 against the NEW price
// ===========================================================================
step('billing a test subscription (Visa 4242) against the NEW Stripe Price');

const customer = await stripe.customers.create({
  email: `crud2-e2e-${Date.now()}@example.test`,
  description: 'CRUD-2 e2e test (throwaway, auto-deleted)',
});
console.log(`  test customer: ${customer.id}`);

try {
  // `pm_card_visa` is the canonical Stripe test token; on .attach() Stripe
  // mints a real PaymentMethod (pm_xxx) tied to this customer. We must use
  // THAT id as the default — the token alias is not valid past attach.
  const attached = await stripe.paymentMethods.attach('pm_card_visa', {
    customer: customer.id,
  });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: attached.id },
  });

  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: newStripePriceId, quantity: 1 }],
    expand: ['latest_invoice'],
  });
  console.log(`  subscription: ${sub.id} status=${sub.status}`);

  // Confirm at the subscription-item level that the new price is what's
  // bound to the recurring contract. `invoice.lines[].price` moved across
  // recent API versions; the subscription-item shape is stable.
  const subPriceId = sub.items?.data?.[0]?.price?.id ?? null;
  assert(
    subPriceId === newStripePriceId,
    `subscription bound to new Stripe Price ${newStripePriceId} (got ${subPriceId})`,
  );

  let invoice =
    typeof sub.latest_invoice === 'string'
      ? await stripe.invoices.retrieve(sub.latest_invoice)
      : sub.latest_invoice;

  if (invoice && invoice.status === 'draft') {
    invoice = await stripe.invoices.finalizeInvoice(invoice.id);
  }
  if (invoice && invoice.status === 'open') {
    invoice = await stripe.invoices.pay(invoice.id);
  }

  console.log(`  invoice: ${invoice.id} status=${invoice.status} total=${invoice.total}`);

  assert(invoice.status === 'paid', `invoice ${invoice.id} is paid`);
  // THE proof of bascule: the actual amount charged on a 4242 card equals
  // the new unit_amount. If we were still pinned to the old Stripe Price,
  // this would equal ORIGINAL_AMOUNT instead.
  assert(
    invoice.total === NEW_AMOUNT,
    `invoice.total = NEW_AMOUNT (${NEW_AMOUNT}), got ${invoice.total}`,
  );
  assert(
    invoice.total !== ORIGINAL_AMOUNT,
    `invoice.total is NOT the old amount (${ORIGINAL_AMOUNT})`,
  );
} finally {
  // Cleanup: deleting a customer cancels any active subscriptions on it.
  try {
    await stripe.customers.del(customer.id);
    console.log(`  cleanup: deleted test customer ${customer.id}`);
  } catch (e) {
    console.warn(`  cleanup warning: could not delete ${customer.id}: ${e.message}`);
  }
}

// ===========================================================================
// 6. restore the original amount (Stripe Prices are immutable, so this
//    creates a 3rd Stripe Price object — small clutter, by design)
// ===========================================================================
step(`restoring original amount ${ORIGINAL_AMOUNT}`);
const restoredId = await bascule(
  { ...target, stripe_price_id: newStripePriceId, unit_amount: NEW_AMOUNT },
  ORIGINAL_AMOUNT,
);

const { data: restored } = await supabase
  .from('prices')
  .select('unit_amount, stripe_price_id')
  .eq('id', target.id)
  .maybeSingle();

assert(
  restored.unit_amount === ORIGINAL_AMOUNT,
  `restored: prices.unit_amount back to ${ORIGINAL_AMOUNT}`,
);
assert(
  restored.stripe_price_id === restoredId,
  `restored: prices.stripe_price_id = ${restoredId}`,
);

console.log();
if (failed) {
  console.log('❌ TEST FAILED');
  process.exit(1);
}
console.log('✅ ALL CHECKS PASSED');
