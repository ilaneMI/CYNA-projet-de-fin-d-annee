/**
 * tools/test-promo-montant.mjs
 *
 * Deux modes :
 *
 *   1. VERIFY (défaut)
 *      node tools/test-promo-montant.mjs [--limit N]
 *
 *      Scanne les N dernières commandes (défaut 10) qui ont un
 *      stripe_checkout_session_id. Pour chacune :
 *        - retrieve la session Stripe → amount_subtotal, amount_total,
 *          total_details.amount_discount
 *        - si amount_discount > 0 → candidate PROMO-03 → vérifie que
 *          orders.total_amount == amount_total (le fix W2 du ticket 55)
 *        - si amount_discount == 0 → skip (aucune réduction à vérifier)
 *      Bonus ticket 39 : contrôle que confirmation_email_sent_at est
 *      posé (le claim atomique s'est déclenché — pipeline invoqué).
 *
 *   2. CREATE-CODE
 *      node tools/test-promo-montant.mjs --create-code
 *
 *      Crée un coupon Stripe -20% (duration=once) + un promotion code
 *      TESTAUTO20-<random>. Imprime le code + les IDs. Aucun cleanup
 *      automatique : le code reste utilisable jusqu'à sa désactivation
 *      manuelle (BO PromotionsAdminSection, ou --deactivate-code CODE).
 *
 *   3. DEACTIVATE-CODE
 *      node tools/test-promo-montant.mjs --deactivate-code TESTAUTO20-XXXX
 *
 *      Désactive le promotion code cité (active: false). Le coupon
 *      sous-jacent est laissé (Stripe refuse la suppression s'il est
 *      attaché à une subscription active — non bloquant).
 *
 * ─── Aucun DDL, aucun UPDATE direct sur les tables métier ────────────
 *   Le script ne fait que READ sur `orders` et READ/WRITE sur Stripe
 *   test mode. Refuse net si STRIPE_SECRET_KEY n'est pas sk_test_*.
 *
 * ─── Env requises (dans .env.local) ──────────────────────────────────
 *   STRIPE_SECRET_KEY=sk_test_...
 *   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service role key>
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loader minimal ─────────────────────────────────────────────────
function loadEnvLocal() {
  const envPath = resolve(__dirname, '..', '.env.local');
  let raw;
  try {
    raw = readFileSync(envPath, 'utf-8');
  } catch {
    console.warn(`[env] ${envPath} introuvable — process.env only.`);
    return;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

// ── Colors ─────────────────────────────────────────────────────────────
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const good = (s) => `${GREEN}${BOLD}${s}${RESET}`;
const bad = (s) => `${RED}${BOLD}${s}${RESET}`;
const info = (s) => `${CYAN}${s}${RESET}`;
const warn = (s) => `${YELLOW}${s}${RESET}`;
const dim = (s) => `${DIM}${s}${RESET}`;

// ── CLI args ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const CREATE_CODE = args.includes('--create-code');
const DEACTIVATE_IDX = args.indexOf('--deactivate-code');
const DEACTIVATE_TARGET = DEACTIVATE_IDX >= 0 ? args[DEACTIVATE_IDX + 1] : null;
const LIMIT_IDX = args.indexOf('--limit');
const LIMIT = LIMIT_IDX >= 0 ? Number(args[LIMIT_IDX + 1]) : 10;

// ── Validation env ────────────────────────────────────────────────────
const REQUIRED_ENV = [
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(bad(`✗ Variables manquantes : ${missing.join(', ')}`));
  console.error(warn('Attendues dans .env.local :'));
  for (const k of REQUIRED_ENV) console.error(`   ${k}=...`);
  process.exit(2);
}
if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.error(bad('✗ STRIPE_SECRET_KEY doit être sk_test_*. Refus par sécurité.'));
  process.exit(2);
}

// ── Clients ────────────────────────────────────────────────────────────
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-05-27.dahlia',
});
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ── Mode dispatch ──────────────────────────────────────────────────────
if (CREATE_CODE) {
  await runCreateCode();
} else if (DEACTIVATE_TARGET) {
  await runDeactivate(DEACTIVATE_TARGET);
} else {
  await runVerify(LIMIT);
}

// ═══════════════════════════════════════════════════════════════════════
// MODE : create-code
// ═══════════════════════════════════════════════════════════════════════
async function runCreateCode() {
  console.log(info('Création d\'un code promo de test (-20%, duration=once)...'));
  console.log();

  const coupon = await stripe.coupons.create({
    percent_off: 20,
    duration: 'once',
    metadata: { created_by: 'test-promo-montant.mjs' },
  });
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const codeStr = `TESTAUTO20-${suffix}`;
  const promo = await stripe.promotionCodes.create({
    promotion: { type: 'coupon', coupon: coupon.id },
    code: codeStr,
  });

  console.log(good(`✅ Code créé : ${codeStr}`));
  console.log(dim(`   coupon Stripe        : ${coupon.id}`));
  console.log(dim(`   promotion code Stripe : ${promo.id}`));
  console.log();
  console.log(info('Prochaines étapes :'));
  console.log(`  1. Va sur /checkout depuis un compte client`);
  console.log(`  2. Sur la page hosted Stripe, clique « J'ai un code promo »`);
  console.log(`  3. Saisis : ${good(codeStr)}`);
  console.log(`  4. Paie avec 4242 4242 4242 4242, date future, CVC 123`);
  console.log(`  5. Relance ce script sans argument pour vérifier :`);
  console.log(`       ${dim('node tools/test-promo-montant.mjs')}`);
  console.log();
  console.log(warn('Pour désactiver ce code après tests :'));
  console.log(dim(`  node tools/test-promo-montant.mjs --deactivate-code ${codeStr}`));
  process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════════
// MODE : deactivate-code
// ═══════════════════════════════════════════════════════════════════════
async function runDeactivate(codeStr) {
  console.log(info(`Recherche du promotion code ${codeStr}...`));
  const list = await stripe.promotionCodes.list({ code: codeStr, limit: 1 });
  if (list.data.length === 0) {
    console.error(bad(`✗ Code ${codeStr} introuvable côté Stripe.`));
    process.exit(1);
  }
  const promo = list.data[0];
  await stripe.promotionCodes.update(promo.id, { active: false });
  console.log(good(`✅ ${codeStr} désactivé (promo ${promo.id}).`));
  console.log(dim('   Le coupon sous-jacent reste (Stripe ne supprime pas un coupon attaché à une sub).'));
  process.exit(0);
}

// ═══════════════════════════════════════════════════════════════════════
// MODE : verify
// ═══════════════════════════════════════════════════════════════════════
async function runVerify(limit) {
  console.log(info(`[verify] Lecture des ${limit} dernières commandes avec Stripe checkout session...`));
  console.log();

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, currency, status, email, stripe_checkout_session_id, confirmation_email_sent_at, created_at')
    .not('stripe_checkout_session_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(bad(`✗ Erreur DB : ${error.message}`));
    process.exit(2);
  }
  if (!orders || orders.length === 0) {
    console.error(warn('Aucune commande avec stripe_checkout_session_id trouvée.'));
    process.exit(0);
  }

  console.log(info(`Trouvé ${orders.length} commande(s). Analyse une par une...`));
  console.log();

  const results = [];
  for (const order of orders) {
    const result = await verifyOne(order);
    results.push(result);
  }

  // ── Récap ──────────────────────────────────────────────────────────
  console.log();
  console.log('═'.repeat(72));
  console.log(BOLD + 'RÉCAP' + RESET);
  console.log('═'.repeat(72));

  const promoOrders = results.filter((r) => r.hasPromo);
  const promoPass = promoOrders.filter((r) => r.promoPass);
  const promoFail = promoOrders.filter((r) => !r.promoPass);
  const emailPass = results.filter((r) => r.emailPass);
  const emailNone = results.filter((r) => !r.emailPass);

  console.log(`  Commandes scannées         : ${orders.length}`);
  console.log(`  Avec réduction (PROMO-03)  : ${promoOrders.length}`);
  console.log(`  ${good('PROMO-03 PASS')}              : ${promoPass.length}`);
  if (promoFail.length > 0) {
    console.log(`  ${bad('PROMO-03 FAIL')}              : ${promoFail.length}`);
  }
  console.log(`  ${good('Ticket 39 (email claim)')}    : ${emailPass.length} posé, ${emailNone.length} vide`);
  console.log('═'.repeat(72));

  if (promoOrders.length === 0) {
    console.log();
    console.log(
      warn(
        '⚠ Aucune commande avec réduction dans les dernières ' +
          `${limit} — PROMO-03 non testable ici. ` +
          'Fais un checkout avec un code promo puis relance.',
      ),
    );
    console.log(
      dim(
        `   Astuce : lance \`node tools/test-promo-montant.mjs --create-code\` ` +
          `pour créer un code de test.`,
      ),
    );
    process.exit(0);
  }

  if (promoFail.length > 0) {
    console.log();
    console.log(bad(`✗ PROMO-03 FAIL sur ${promoFail.length} commande(s). Fix W2 du ticket 55 à investiguer.`));
    process.exit(1);
  }

  console.log();
  console.log(good(`✅ PROMO-03 validé sur ${promoPass.length} commande(s) avec réduction.`));
  console.log(good(`   Le webhook enregistre bien le montant réduit (session.amount_total),`));
  console.log(good(`   pas le plein tarif catalogue (session.amount_subtotal).`));
  process.exit(0);
}

// ── Analyse d'une commande ─────────────────────────────────────────────
async function verifyOne(order) {
  const sessionId = order.stripe_checkout_session_id;
  console.log(`─ ${BOLD}${order.order_number}${RESET}  ${dim(`(${sessionId.slice(0, 20)}…)`)}`);
  console.log(dim(`  créée le ${order.created_at}, status=${order.status}, email=${order.email}`));

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['total_details.breakdown.discounts'],
    });
  } catch (err) {
    console.log(bad(`  ✗ Stripe retrieve failed : ${err.message}`));
    console.log();
    return {
      order,
      hasPromo: false,
      promoPass: false,
      emailPass: false,
      reason: 'stripe retrieve failed',
    };
  }

  const subtotal = session.amount_subtotal ?? null;
  const total = session.amount_total ?? null;
  const discount = session.total_details?.amount_discount ?? 0;
  const currency = (session.currency ?? order.currency ?? 'eur').toUpperCase();

  // Affiche les chiffres bruts
  const fmt = (n) => (n == null ? '(null)' : `${n} ${currency}`);
  console.log(dim(`  Stripe amount_subtotal : ${fmt(subtotal)}`));
  console.log(dim(`  Stripe amount_discount : ${fmt(discount)}`));
  console.log(dim(`  Stripe amount_total    : ${fmt(total)}`));
  console.log(dim(`  DB     total_amount    : ${fmt(order.total_amount)}`));

  const hasPromo = discount > 0;

  // ── PROMO-03 (ticket 55) ───────────────────────────────────────────
  let promoPass = false;
  if (!hasPromo) {
    console.log(dim(`  PROMO-03 : ${dim('SKIP')} (pas de réduction sur cette commande)`));
  } else if (total == null) {
    console.log(bad(`  PROMO-03 : FAIL — session.amount_total est null, impossible de comparer.`));
  } else if (order.total_amount === total) {
    console.log(good(`  PROMO-03 : PASS`) + dim(` — orders.total_amount == amount_total (${total})`));
    promoPass = true;
  } else if (order.total_amount === subtotal) {
    console.log(
      bad(`  PROMO-03 : FAIL`) +
        ` — orders.total_amount (${order.total_amount}) == amount_subtotal (${subtotal})`,
    );
    console.log(bad(`             Le PLEIN TARIF a été enregistré. Le fix W2 du ticket 55 est cassé.`));
  } else {
    console.log(
      bad(`  PROMO-03 : FAIL`) +
        ` — orders.total_amount (${order.total_amount}) ne matche ni amount_total ni amount_subtotal.`,
    );
  }

  // ── Ticket 39 (email claim) ────────────────────────────────────────
  const emailPass = order.confirmation_email_sent_at != null;
  if (emailPass) {
    console.log(
      good(`  Ticket 39: PASS`) +
        dim(` — confirmation_email_sent_at posé à ${order.confirmation_email_sent_at}`),
    );
    console.log(
      dim(
        `             (Claim atomique effectué. Livraison Resend dépend de l'env — cf. logs si sandbox limité.)`,
      ),
    );
  } else {
    console.log(warn(`  Ticket 39: ⚠ confirmation_email_sent_at est NULL`));
    console.log(
      dim(
        `             Commande antérieure au ticket 39 ou webhook n'a pas atteint le bloc email.`,
      ),
    );
  }

  console.log();
  return { order, hasPromo, promoPass, emailPass };
}
