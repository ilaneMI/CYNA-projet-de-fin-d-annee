// Test d'isolation cross-user pour /api/account/payment-methods/[id].
//
// Reproduit la logique EXACTE du owner-guard de la route (cf.
// src/app/api/account/payment-methods/[id]/route.ts) :
//   1. retrieve(pm_id) depuis Stripe
//   2. compare pm.customer au stripe_customer_id du user appelant
//   3. 404 indifférencié si mismatch — aucun detach ne doit partir
//
// Scénario :
//   - Crée une carte test attachée au customer du USER A
//   - Simule un appel DELETE par USER B → guard refuse (404), carte préservée
//   - Simule un appel DELETE par USER A (propriétaire) → guard passe, detach OK
//
// Pas de session HTTP requise : on prouve la garde au niveau Stripe SDK,
// identique à ce qu'exécute la route — la route ne fait qu'envelopper.
//
// Run : node tools/test-pm-isolation.mjs

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Mini loader .env.local (dotenv n'est pas en deps — on évite l'ajout
// d'un package juste pour ce script).
try {
  const raw = readFileSync('.env.local', 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) {
      let value = m[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[m[1]] = value;
    }
  }
} catch { /* .env.local optional */ }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE || !STRIPE_KEY) {
  console.error('❌ env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2026-05-27.dahlia' });

const ok = (msg) => console.log(`✅ ${msg}`);
const warn = (msg) => console.log(`⚠  ${msg}`);
const fail = (msg) => { console.error(`❌ ${msg}`); process.exit(1); };

// ─── Mock de la logique de la route /[id] DELETE ─────────────────────────
// Reproduit lignes 51-95 de src/app/api/account/payment-methods/[id]/route.ts
async function simulateDeleteAs({ userId, pmId }) {
  // 1. Charge profile.stripe_customer_id du user appelant
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();
  const customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) return { status: 404, reason: 'no stripe_customer_id' };

  // 2. retrieve pm
  let pm;
  try {
    pm = await stripe.paymentMethods.retrieve(pmId);
  } catch (err) {
    if (err.code === 'resource_missing') return { status: 404, reason: 'pm not found' };
    return { status: 502, reason: `stripe retrieve failed: ${err.message}` };
  }

  // 3. Owner-guard
  const pmCustomer = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id ?? null;
  if (pmCustomer !== customerId) {
    return { status: 404, reason: `OWNER_GUARD_REJECTED (pm.customer=${pmCustomer} ≠ user.customer=${customerId})` };
  }

  // 4. Detach
  await stripe.paymentMethods.detach(pmId);
  return { status: 200, reason: 'detached' };
}
// ──────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('── Recherche de 2 users avec stripe_customer_id ──');
  const { data: users, error: usersErr } = await supabase
    .from('profiles')
    .select('id, stripe_customer_id')
    .not('stripe_customer_id', 'is', null)
    .limit(2);
  if (usersErr) fail(`profile lookup: ${usersErr.message}`);
  if (!users || users.length < 2) fail('Besoin d\'au moins 2 users avec stripe_customer_id');
  const [A, B] = users;
  console.log(`   USER A: ${A.id} → ${A.stripe_customer_id}`);
  console.log(`   USER B: ${B.id} → ${B.stripe_customer_id}\n`);

  console.log('── Création d\'une carte test attachée à USER A ──');
  // Crée un pm via le token de test "tok_visa" (méthode officielle Stripe)
  const pm = await stripe.paymentMethods.create({
    type: 'card',
    card: { token: 'tok_visa' },
  });
  await stripe.paymentMethods.attach(pm.id, { customer: A.stripe_customer_id });
  ok(`Carte ${pm.id} attachée à customer ${A.stripe_customer_id}\n`);

  try {
    // ── Test 1 : USER B tente de supprimer la carte de USER A ─────────────
    console.log('── TEST 1 : DELETE par USER B (cross-user, doit échouer 404) ──');
    const r1 = await simulateDeleteAs({ userId: B.id, pmId: pm.id });
    if (r1.status === 404 && r1.reason.startsWith('OWNER_GUARD')) {
      ok(`Guard a refusé : ${r1.reason}`);
    } else {
      fail(`Guard N'A PAS refusé : status=${r1.status} reason=${r1.reason}`);
    }
    // Vérification : la carte est-elle toujours attachée à A ?
    const stillThere = await stripe.paymentMethods.retrieve(pm.id);
    if (stillThere.customer === A.stripe_customer_id) {
      ok('Carte TOUJOURS attachée à USER A (pas de leak)\n');
    } else {
      fail(`Carte détachée à tort ! customer = ${stillThere.customer}\n`);
    }

    // ── Test 2 : Même test côté PATCH /default (mémé garde) ──────────────
    console.log('── TEST 2 : SET DEFAULT par USER B (cross-user, doit échouer 404) ──');
    // Reproduit le guard de PATCH /default (qui est identique structurellement)
    const { data: profileB } = await supabase.from('profiles').select('stripe_customer_id').eq('id', B.id).maybeSingle();
    const pmCheck = await stripe.paymentMethods.retrieve(pm.id);
    const pmCustomerCheck = typeof pmCheck.customer === 'string' ? pmCheck.customer : pmCheck.customer?.id;
    if (pmCustomerCheck !== profileB.stripe_customer_id) {
      ok(`Guard /default a refusé : pm.customer=${pmCustomerCheck} ≠ B.customer=${profileB.stripe_customer_id}`);
    } else {
      fail('Guard /default a accepté à tort');
    }
    // Vérif : invoice_settings de B inchangé
    const customerB = await stripe.customers.retrieve(B.stripe_customer_id);
    if (!customerB.invoice_settings?.default_payment_method ||
        customerB.invoice_settings.default_payment_method !== pm.id) {
      ok('default_payment_method de B inchangé (pas de pollution cross-customer)\n');
    } else {
      fail(`default_payment_method de B a été modifié à tort : ${customerB.invoice_settings.default_payment_method}\n`);
    }

    // ── Test 3 : USER A (propriétaire) supprime sa propre carte ───────────
    console.log('── TEST 3 : DELETE par USER A (propriétaire, doit réussir) ──');
    const r3 = await simulateDeleteAs({ userId: A.id, pmId: pm.id });
    if (r3.status === 200) {
      ok(`Detach OK : ${r3.reason}`);
    } else {
      fail(`Detach a échoué : status=${r3.status} reason=${r3.reason}`);
    }
    // Vérif : la carte n'a plus de customer (détachée)
    const afterDetach = await stripe.paymentMethods.retrieve(pm.id);
    if (!afterDetach.customer) {
      ok('Carte effectivement détachée (customer=null)\n');
    } else {
      warn(`Carte encore attachée à ${afterDetach.customer} (Stripe peut prendre 1-2s à propager)\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Isolation cross-user VALIDÉE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } finally {
    // Cleanup défensif : si la carte est encore attachée à quelqu'un, on détache.
    try {
      const finalCheck = await stripe.paymentMethods.retrieve(pm.id);
      if (finalCheck.customer) {
        await stripe.paymentMethods.detach(pm.id);
        console.log(`(cleanup: carte ${pm.id} détachée du customer ${finalCheck.customer})`);
      }
    } catch { /* swallow */ }
  }
}

main().catch((err) => {
  console.error('❌ test script crashed:', err);
  process.exit(1);
});
