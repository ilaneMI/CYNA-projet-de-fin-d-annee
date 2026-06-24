#!/usr/bin/env node
/**
 * tools/seed-stripe-prices.mjs
 *
 * Idempotent seed of Stripe Products + Prices from `public.prices` (Lot A
 * catalogue). Run once after every change to the local catalogue:
 *
 *   node tools/seed-stripe-prices.mjs
 *
 * Behaviour:
 *   1. Read .env.local (STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL,
 *      SUPABASE_SERVICE_ROLE_KEY).
 *   2. Pull every row from `public.prices` joined to its product.
 *   3. Skip any row that already has `stripe_price_id` set.
 *   4. For each remaining row:
 *      - Resolve or create a Stripe Product (searched by metadata
 *        `supabase_product_id`, fall back to create) — one per product slug.
 *      - Create a Stripe Price (Stripe Prices are IMMUTABLE).
 *      - Persist `stripe_price_id` on the row via the service-role client.
 *   5. Print a summary.
 *
 * IMPORTANT — Stripe Prices are immutable. There is no `prices.update` for
 * unit_amount or recurring interval. To change a montant on an existing
 * Price you create a NEW Price with the new amount, archive the old one
 * (`active: false`), and update `public.prices.stripe_price_id` to point
 * at the new id. NEVER edit a row in Stripe Dashboard expecting the
 * subscription you already created on the old Price to update — it
 * won't. Apply that pattern via a follow-up migration of this seed.
 *
 * Service-role-only: this script writes `stripe_price_id` on a column
 * that is exposed read-only to clients but writeable only by the
 * service_role (no RLS UPDATE policy on prices for authenticated). Do
 * NOT commit .env.local. Do NOT publish the SUPABASE_SERVICE_ROLE_KEY.
 */

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

function loadEnv() {
  const path = '.env.local';
  if (!existsSync(path)) {
    console.error('error: .env.local not found. Run from the repo root.');
    process.exit(2);
  }
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
const requiredKeys = [
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];
for (const k of requiredKeys) {
  if (!env[k]) {
    console.error(`error: ${k} missing from .env.local`);
    process.exit(2);
  }
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-05-27.dahlia',
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---- Fetch prices + products ----------------------------------------------
const { data: rows, error: rowsErr } = await supabase
  .from('prices')
  .select(
    `id, product_id, billing_interval, unit_type, unit_amount, currency, stripe_price_id, is_active,
     product:products!inner ( id, slug, name, description )`,
  )
  .order('product_id', { ascending: true });

if (rowsErr) {
  console.error('error: failed to read prices:', rowsErr.message);
  process.exit(1);
}

const totalRows = rows?.length ?? 0;
const pending = (rows ?? []).filter((r) => !r.stripe_price_id);

console.log(`prices: ${totalRows} total, ${pending.length} pending, ${totalRows - pending.length} skipped (already linked).`);

if (pending.length === 0) {
  console.log('nothing to do.');
  process.exit(0);
}

// ---- Stripe Product cache: supabase_product_id → stripe_product_id --------
const productCache = new Map();

async function resolveStripeProduct(localProduct) {
  if (productCache.has(localProduct.id)) {
    return productCache.get(localProduct.id);
  }

  // Try to find an existing Stripe Product tagged with this supabase id.
  const search = await stripe.products.search({
    query: `active:'true' AND metadata['supabase_product_id']:'${localProduct.id}'`,
    limit: 1,
  });
  let stripeProduct = search.data[0];

  if (!stripeProduct) {
    const name =
      (localProduct.name && (localProduct.name.fr ?? localProduct.name.en)) || localProduct.slug;
    const description =
      (localProduct.description && (localProduct.description.fr ?? localProduct.description.en)) || undefined;
    stripeProduct = await stripe.products.create({
      name,
      description,
      metadata: {
        supabase_product_id: localProduct.id,
        supabase_product_slug: localProduct.slug,
      },
    });
    console.log(`+ created Stripe Product ${stripeProduct.id} (${localProduct.slug})`);
  } else {
    console.log(`= reusing Stripe Product ${stripeProduct.id} (${localProduct.slug})`);
  }

  productCache.set(localProduct.id, stripeProduct.id);
  return stripeProduct.id;
}

const INTERVAL_MAP = {
  monthly: 'month',
  annual: 'year',
};

let created = 0;
let failed = 0;

for (const row of pending) {
  try {
    const stripeProductId = await resolveStripeProduct(row.product);
    const interval = INTERVAL_MAP[row.billing_interval];
    if (!interval) {
      throw new Error(`unknown billing_interval: ${row.billing_interval}`);
    }

    // Stripe Price = immutable. We never update; we create.
    const price = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: row.unit_amount,
      currency: row.currency,
      recurring: { interval },
      nickname: `${row.product.slug}/${row.billing_interval}/${row.unit_type}`,
      active: row.is_active !== false,
      metadata: {
        supabase_price_id: row.id,
        supabase_product_id: row.product.id,
        unit_type: row.unit_type,
      },
    });

    const { error: updateErr } = await supabase
      .from('prices')
      .update({ stripe_price_id: price.id })
      .eq('id', row.id);
    if (updateErr) {
      throw new Error(`failed to write back stripe_price_id: ${updateErr.message}`);
    }

    console.log(
      `+ ${row.product.slug} ${row.billing_interval}/${row.unit_type} ${row.unit_amount}${row.currency} → ${price.id}`,
    );
    created++;
  } catch (err) {
    failed++;
    console.error(`! ${row.product?.slug ?? row.product_id} ${row.billing_interval}/${row.unit_type}: ${err.message}`);
  }
}

console.log(`done. created ${created}, failed ${failed}, skipped ${totalRows - pending.length}.`);
process.exit(failed === 0 ? 0 : 1);
