#!/usr/bin/env node
/**
 * tools/test-create-product.mjs
 *
 * End-to-end du flow de création de produit (Lot Admin CRUD-CREATE).
 *
 * Ce que ça prouve :
 *   1. L'orchestration Stripe + DB telle qu'implémentée par la route
 *      POST /api/admin/products produit bien un Stripe Product + N
 *      Stripe Prices + 1 ligne `products` + N lignes `prices`, avec
 *      des stripe_price_id non-NULL et cohérents (metadata pointant
 *      vers la bonne UUID Supabase).
 *   2. Un paiement test Visa 4242 contre le premier Stripe Price
 *      facture le montant attendu — preuve que le price seedé est
 *      utilisable côté Stripe.
 *   3. Cleanup propre : suppression de la ligne products (cascade sur
 *      prices) et archive best-effort du Stripe Product + Prices.
 *
 * Mode d'exécution :
 *   Inline orchestration via service-role (mirror exact de la route +
 *   de la RPC admin_create_product). On NE passe PAS par la RPC parce
 *   qu'elle vérifie is_admin() interne, lequel échoue pour service_role
 *   (auth.uid() = null). Le route handler est exercé manuellement
 *   depuis le BO ; ce script vérifie l'invariant côté Stripe + DB +
 *   billing, pas le chemin HTTP.
 *
 * Stripe TEST mode UNIQUEMENT. Refuse de tourner avec une live key.
 *
 *   node tools/test-create-product.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

function loadEnv() {
  if (!existsSync('.env.local')) {
    console.error('error: .env.local not found. Run from the repo root.');
    process.exit(2);
  }
  const env = {};
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const env = loadEnv();
for (const k of ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
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

let failed = false;
function ok(msg)  { console.log(`  ✓ ${msg}`); }
function ko(msg)  { failed = true; console.log(`  ✗ ${msg}`); }
function assert(cond, msg) { (cond ? ok : ko)(msg); }
function step(label) { console.log(`\n--- ${label} ---`); }

// ───────────────────────────────────────────────────────────────────────────
// 1. Pré-requis : choisir une catégorie cible (n'importe laquelle).
// ───────────────────────────────────────────────────────────────────────────
step('picking a category');
const { data: category, error: catErr } = await supabase
  .from('categories')
  .select('id, slug, name')
  .limit(1)
  .maybeSingle();
if (catErr || !category) {
  console.error('cannot find any category to attach the test product to.', catErr?.message);
  process.exit(1);
}
console.log(`  using category: ${category.slug} (${category.id})`);

// ───────────────────────────────────────────────────────────────────────────
// 2. Pré-gen uuids + payload.
// ───────────────────────────────────────────────────────────────────────────
const stamp = Date.now();
const SLUG = `test-prod-${stamp}`;
const NAME_FR = `Produit de test ${stamp}`;
const productUuid = randomUUID();
const prices = [
  { id: randomUUID(), billing_interval: 'monthly', unit_type: 'flat',     unit_amount: 12300 }, // 123.00 €
  { id: randomUUID(), billing_interval: 'annual',  unit_type: 'flat',     unit_amount: 123000 },
];

console.log(`  product slug      : ${SLUG}`);
console.log(`  product uuid      : ${productUuid}`);
for (const p of prices) {
  console.log(`  price ${p.billing_interval}/${p.unit_type}  : ${p.unit_amount} centimes (uuid=${p.id})`);
}

// ───────────────────────────────────────────────────────────────────────────
// 3. Stripe Product.create.
// ───────────────────────────────────────────────────────────────────────────
step('Stripe Product.create');
const stripeProduct = await stripe.products.create({
  name: NAME_FR,
  description: 'Produit créé par tools/test-create-product.mjs (throwaway).',
  metadata: {
    supabase_product_id: productUuid,
    supabase_product_slug: SLUG,
    purpose: 'crud-create-e2e-test',
  },
});
console.log(`  stripe_product_id : ${stripeProduct.id}`);

// ───────────────────────────────────────────────────────────────────────────
// 4. Stripe Prices.create (1 par plan).
// ───────────────────────────────────────────────────────────────────────────
step('Stripe Prices.create');
const createdStripePrices = [];
for (const p of prices) {
  const stripePrice = await stripe.prices.create({
    product: stripeProduct.id,
    unit_amount: p.unit_amount,
    currency: 'eur',
    recurring: { interval: p.billing_interval === 'annual' ? 'year' : 'month' },
    metadata: {
      supabase_price_id: p.id,
      supabase_product_id: productUuid,
      unit_type: p.unit_type,
    },
    nickname: `${SLUG}/${p.billing_interval}/${p.unit_type}`,
    active: true,
  });
  createdStripePrices.push({ ...p, stripe_price_id: stripePrice.id });
  console.log(`  + stripe_price_id : ${stripePrice.id} (${p.billing_interval}/${p.unit_type})`);
}

// ───────────────────────────────────────────────────────────────────────────
// 5. INSERT products + prices via service_role (mirror de la RPC).
// ───────────────────────────────────────────────────────────────────────────
step('DB inserts (service_role mirror of admin_create_product RPC)');
const { error: insProdErr } = await supabase.from('products').insert({
  id: productUuid,
  category_id: category.id,
  slug: SLUG,
  name: { fr: NAME_FR },
  description: { fr: 'Produit de test, sera supprimé après vérification.' },
  specs: {},
  availability: 'in_stock',
  priority: 0,
  is_featured: false,
  is_active: true,
});
if (insProdErr) {
  console.error('! products INSERT failed:', insProdErr.message);
  console.error('! Stripe Product + Prices orphaned:', stripeProduct.id, createdStripePrices.map((p) => p.stripe_price_id));
  process.exit(1);
}
ok(`inserted products row ${productUuid}`);

const { error: insPriErr } = await supabase.from('prices').insert(
  createdStripePrices.map((p) => ({
    id: p.id,
    product_id: productUuid,
    billing_interval: p.billing_interval,
    unit_type: p.unit_type,
    unit_amount: p.unit_amount,
    currency: 'eur',
    stripe_price_id: p.stripe_price_id,
    is_active: true,
  })),
);
if (insPriErr) {
  console.error('! prices INSERT failed:', insPriErr.message);
  // Cleanup partiel : DELETE products (cascade prices vide), archive Stripe.
  await supabase.from('products').delete().eq('id', productUuid);
  process.exit(1);
}
ok(`inserted ${createdStripePrices.length} prices rows`);

// ───────────────────────────────────────────────────────────────────────────
// 6. Vérif DB : produit + N prices avec stripe_price_id correct.
// ───────────────────────────────────────────────────────────────────────────
step('verify DB state');
const { data: dbProduct } = await supabase
  .from('products')
  .select('id, slug, name, is_active, availability, category_id')
  .eq('id', productUuid)
  .maybeSingle();
assert(dbProduct?.slug === SLUG, `products.slug = ${SLUG}`);
assert(dbProduct?.is_active === true, 'products.is_active = true');
assert(dbProduct?.availability === 'in_stock', 'products.availability = in_stock');

const { data: dbPrices } = await supabase
  .from('prices')
  .select('id, billing_interval, unit_type, unit_amount, stripe_price_id, currency')
  .eq('product_id', productUuid)
  .order('billing_interval');
assert((dbPrices?.length ?? 0) === createdStripePrices.length, `prices count = ${createdStripePrices.length}`);
for (const expected of createdStripePrices) {
  const found = (dbPrices ?? []).find((row) => row.id === expected.id);
  assert(!!found, `prices row ${expected.billing_interval}/${expected.unit_type} present`);
  if (found) {
    assert(found.stripe_price_id === expected.stripe_price_id, `stripe_price_id matches for ${expected.billing_interval}/${expected.unit_type}`);
    assert(found.unit_amount === expected.unit_amount, `unit_amount matches (${expected.unit_amount})`);
    assert(found.currency === 'eur', 'currency = eur (lowercase)');
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 7. Vérif Stripe : metadata cohérente.
// ───────────────────────────────────────────────────────────────────────────
step('verify Stripe state');
const stripeProductNow = await stripe.products.retrieve(stripeProduct.id);
assert(stripeProductNow.metadata.supabase_product_id === productUuid, 'Stripe Product metadata.supabase_product_id matches');
assert(stripeProductNow.metadata.supabase_product_slug === SLUG, 'Stripe Product metadata.supabase_product_slug matches');
for (const p of createdStripePrices) {
  const sp = await stripe.prices.retrieve(p.stripe_price_id);
  assert(sp.active === true, `Stripe Price ${p.stripe_price_id} is active`);
  assert(sp.unit_amount === p.unit_amount, `Stripe Price unit_amount = ${p.unit_amount}`);
  assert(sp.product === stripeProduct.id, 'Stripe Price product matches our Stripe Product');
  assert(sp.metadata.supabase_price_id === p.id, 'Stripe Price metadata.supabase_price_id matches');
}

// ───────────────────────────────────────────────────────────────────────────
// 8. Paiement test Visa 4242 sur le premier prix créé.
// ───────────────────────────────────────────────────────────────────────────
step('billing a test subscription (Visa 4242) on the new monthly price');
const firstPrice = createdStripePrices[0];
const customer = await stripe.customers.create({
  email: `crud-create-e2e-${stamp}@example.test`,
  description: 'CRUD-CREATE e2e test customer (throwaway, auto-deleted)',
});
console.log(`  test customer: ${customer.id}`);

let billingFailure = null;
try {
  const attached = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: attached.id },
  });
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: firstPrice.stripe_price_id, quantity: 1 }],
    expand: ['latest_invoice'],
  });
  console.log(`  subscription : ${sub.id} status=${sub.status}`);

  const subPriceId = sub.items?.data?.[0]?.price?.id ?? null;
  assert(subPriceId === firstPrice.stripe_price_id, `subscription bound to new Stripe Price ${firstPrice.stripe_price_id}`);

  let invoice = typeof sub.latest_invoice === 'string'
    ? await stripe.invoices.retrieve(sub.latest_invoice)
    : sub.latest_invoice;
  if (invoice && invoice.status === 'draft')  invoice = await stripe.invoices.finalizeInvoice(invoice.id);
  if (invoice && invoice.status === 'open')   invoice = await stripe.invoices.pay(invoice.id);

  console.log(`  invoice      : ${invoice.id} status=${invoice.status} total=${invoice.total}`);
  assert(invoice.status === 'paid', `invoice ${invoice.id} is paid`);
  assert(invoice.total === firstPrice.unit_amount, `invoice.total = ${firstPrice.unit_amount}`);
} catch (err) {
  billingFailure = err;
  ko(`billing flow threw: ${err.message}`);
} finally {
  try {
    await stripe.customers.del(customer.id);
    console.log(`  cleanup: deleted test customer ${customer.id}`);
  } catch (e) {
    console.warn(`  cleanup warning: ${e.message}`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 9. Cleanup : DELETE products (cascade prices) + archive Stripe.
// ───────────────────────────────────────────────────────────────────────────
step('cleanup DB + Stripe');
const { error: delErr } = await supabase.from('products').delete().eq('id', productUuid);
if (delErr) ko(`DB cleanup failed: ${delErr.message}`); else ok(`deleted products row ${productUuid} (cascade prices)`);

for (const p of createdStripePrices) {
  try {
    await stripe.prices.update(p.stripe_price_id, { active: false });
  } catch (e) {
    console.warn(`  cleanup warning: archive Stripe Price ${p.stripe_price_id}: ${e.message}`);
  }
}
try {
  await stripe.products.update(stripeProduct.id, { active: false });
  ok(`archived Stripe Product ${stripeProduct.id} + ${createdStripePrices.length} Prices`);
} catch (e) {
  ko(`archive Stripe Product failed: ${e.message}`);
}

console.log();
if (failed || billingFailure) {
  console.log('❌ TEST FAILED');
  process.exit(1);
}
console.log('✅ ALL CHECKS PASSED');
