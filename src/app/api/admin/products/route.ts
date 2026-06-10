import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import { getServiceSupabase } from '@/lib/supabase-service';
import { getStripe } from '@/lib/stripe-server';
import { requireAdminAAL2 } from '@/lib/admin/require-aal2';
import { logAdminAction } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';        // Stripe SDK + crypto
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/products
 *
 * Création d'un produit complet (ligne `public.products` + N lignes
 * `public.prices` + Stripe Product + N Stripe Prices) en garantissant
 * l'invariant : aucune ligne `prices` ne peut exister avec un
 * stripe_price_id NULL ou divergent, et aucun produit ne peut être
 * publié sans au moins un prix.
 *
 * Stratégie d'ordre :
 *   0. Auth admin + validation payload.
 *   1. Pré-check slug (service-role, lecture rapide). 409 si collision —
 *      évite de créer des objets Stripe orphelins pour rien.
 *   2. PRÉ-GÉNÉRATION des uuids (product + 1 par prix) côté Node, pour
 *      pouvoir les embeder dans `stripe.metadata.supabase_*_id` AVANT
 *      la moindre écriture base.
 *   3. Stripe.products.create.
 *   4. Pour chaque plan : Stripe.prices.create sur le Stripe Product.
 *   5. Si (3) ou (4) échoue → best-effort archive de ce qui a été créé
 *      (active:false) + log d'orphelins + 502. La base est intacte.
 *   6. RPC admin_create_product (SECURITY DEFINER, transactionnelle) :
 *      INSERT products + N INSERTs prices, en passant les uuids et les
 *      stripe_*_id fraîchement créés. Atomique par construction PG.
 *   7. Si la RPC échoue (race slug, contrainte, validation) → best-effort
 *      archive de TOUS les objets Stripe créés (product + prices) + log
 *      d'orphelins + erreur explicite. La base reste cohérente.
 *   8. revalidatePath sur les surfaces ISR (mêmes chemins que CRUD-1/2).
 *
 * Différence avec CRUD-2 (modif de prix) : ici on a un Stripe Product à
 * créer en plus, donc le rollback en cas d'échec de l'étape 6 doit
 * archiver le Product en plus de ses Prices. Stripe Products restent
 * mutables (.update active:false) donc l'archive est triviale.
 *
 * Sécurité :
 *   - getServerSupabase().auth.getUser() → 401 si pas de session.
 *   - rpc('is_admin') côté serveur → 403 si pas admin (defense in depth
 *     contre un client compromis qui s'amuserait à appeler directement
 *     la route).
 *   - L'écriture base passe par la RPC SECURITY DEFINER qui vérifie
 *     elle-même is_admin() + a son search_path figé.
 *   - Le pré-check slug utilise service-role (la table products n'a pas
 *     de policy SELECT permissive sur tous les rôles ; ici on lit juste
 *     l'existence).
 *
 * Currency : EUR fixe en minuscule, conforme à l'existant. Le payload
 * ne laisse pas le client choisir une autre devise (changement = autre
 * lot, comme pour CRUD-2).
 */

const VALID_INTERVALS = {
  monthly: 'month',
  annual: 'year',
} as const satisfies Record<string, Stripe.PriceCreateParams.Recurring.Interval>;

type BillingInterval = keyof typeof VALID_INTERVALS;
type UnitType = 'flat' | 'per_user' | 'per_device';
type Availability = 'in_stock' | 'limited' | 'out_of_stock';

type PriceInput = {
  billing_interval: BillingInterval;
  unit_type: UnitType;
  /** Centimes, entier ≥ 1. */
  unit_amount: number;
};

type Body = {
  slug: string;
  name: Record<string, string>;
  description?: Record<string, string> | null;
  specs?: Record<string, unknown> | null;
  /** Slug de catégorie — cohérent avec l'API publique (Category.id = slug).
   *  La route résout l'UUID en service-role avant l'appel RPC. */
  category_id: string;
  availability: Availability;
  priority?: number;
  is_featured?: boolean;
  is_active?: boolean;
  prices: PriceInput[];
};

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CURRENCY = 'eur';

const STATUS_BY_CODE: Record<string, number> = {
  '42501': 403, // is_admin denied
  '22023': 400, // validation
  P0002: 404,   // not found (category)
  '23505': 409, // unique violation (slug race)
};

function revalidateCatalogue(): void {
  revalidatePath('/');
  revalidatePath('/catalogue');
  revalidatePath('/category/[id]', 'page');
  revalidatePath('/product/[id]', 'page');
}

function validateBody(body: unknown): Body | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'body must be a JSON object' };
  const b = body as Record<string, unknown>;
  if (typeof b.slug !== 'string' || !SLUG_REGEX.test(b.slug)) {
    return { error: 'slug must be lowercase kebab-case (a-z, 0-9, single hyphens)' };
  }
  if (!b.name || typeof b.name !== 'object') return { error: 'name must be an object' };
  const name = b.name as Record<string, string>;
  if (!(name.fr || name.en)) return { error: 'name must have a non-empty fr or en key' };

  if (typeof b.category_id !== 'string' || b.category_id.length === 0) {
    return { error: 'category_id is required' };
  }
  if (!['in_stock', 'limited', 'out_of_stock'].includes(String(b.availability))) {
    return { error: 'availability must be one of in_stock, limited, out_of_stock' };
  }
  const priority = b.priority ?? 0;
  if (typeof priority !== 'number' || priority < 0 || priority > 1000 || !Number.isInteger(priority)) {
    return { error: 'priority must be an integer between 0 and 1000' };
  }

  if (!Array.isArray(b.prices) || b.prices.length === 0) {
    return { error: 'prices must be a non-empty array' };
  }
  const prices: PriceInput[] = [];
  const seen = new Set<string>();
  for (const raw of b.prices) {
    if (!raw || typeof raw !== 'object') return { error: 'price entries must be objects' };
    const p = raw as Record<string, unknown>;
    const interval = p.billing_interval as BillingInterval;
    const unit = p.unit_type as UnitType;
    if (!(interval in VALID_INTERVALS)) return { error: `invalid billing_interval: ${String(interval)}` };
    if (!['flat', 'per_user', 'per_device'].includes(String(unit))) {
      return { error: `invalid unit_type: ${String(unit)}` };
    }
    const amount = p.unit_amount;
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1) {
      return { error: 'unit_amount must be a positive integer (centimes)' };
    }
    // Détecte un doublon (interval, unit_type) avant Stripe — la table a
    // un UNIQUE qui rattrape, mais autant éviter d'orpheliner un Stripe
    // Price pour ça.
    const key = `${interval}/${unit}`;
    if (seen.has(key)) return { error: `duplicate price plan: ${key}` };
    seen.add(key);
    prices.push({ billing_interval: interval, unit_type: unit, unit_amount: amount });
  }

  return {
    slug: b.slug,
    name,
    description: (b.description as Record<string, string> | null) ?? null,
    specs: (b.specs as Record<string, unknown> | null) ?? null,
    category_id: b.category_id,
    availability: b.availability as Availability,
    priority,
    is_featured: Boolean(b.is_featured ?? false),
    is_active: b.is_active === undefined ? true : Boolean(b.is_active),
    prices,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1-2. AuthN + AuthZ + AAL2 ─────────────────────────────────────────
  // requireAdminAAL2 fait : getUser (401) → is_admin RPC (403 "admin
  // required") → getAuthenticatorAssuranceLevel (403 "aal2 required").
  // Ferme le gap F2 : AAL1 admin ne peut plus muter via cette route.
  const guard = await requireAdminAAL2();
  if (!guard.ok) return guard.response;
  const { supabase: supabaseUser, user } = guard;

  // ── 3. Body + validation ──────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = validateBody(rawBody);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const body = parsed;

  // ── 4. Pré-check slug + résolution catégorie (slug → UUID) ────────────
  // Deux SELECT en service-role : (a) collision slug produit, (b)
  // existence catégorie. On les fait ICI pour éviter d'orpheliner du
  // Stripe sur des payloads invalides — la RPC referait les mêmes checks
  // mais après les calls Stripe.
  const supabaseAdmin = getServiceSupabase();

  const { data: existingSlug, error: slugErr } = await supabaseAdmin
    .from('products')
    .select('id')
    .eq('slug', body.slug)
    .maybeSingle();
  if (slugErr) {
    return NextResponse.json(
      { error: `slug pre-check failed: ${slugErr.message}` },
      { status: 500 },
    );
  }
  if (existingSlug) {
    return NextResponse.json(
      { error: `slug ${body.slug} already exists`, code: '23505' },
      { status: 409 },
    );
  }

  const { data: categoryRow, error: catErr } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('slug', body.category_id)
    .maybeSingle();
  if (catErr) {
    return NextResponse.json(
      { error: `category lookup failed: ${catErr.message}` },
      { status: 500 },
    );
  }
  if (!categoryRow) {
    return NextResponse.json(
      { error: `unknown category: ${body.category_id}` },
      { status: 404 },
    );
  }
  const categoryUuid = (categoryRow as { id: string }).id;

  // ── 5. Pré-gen UUIDs (product + 1 par prix) ───────────────────────────
  const productUuid = randomUUID();
  const pricesWithIds = body.prices.map((p) => ({ ...p, id: randomUUID() }));

  const stripe = getStripe();

  // ── 6. Stripe Product.create ──────────────────────────────────────────
  let stripeProduct: Stripe.Product;
  try {
    stripeProduct = await stripe.products.create({
      name: body.name.fr ?? body.name.en ?? body.slug,
      description: body.description?.fr ?? body.description?.en ?? undefined,
      metadata: {
        supabase_product_id: productUuid,
        supabase_product_slug: body.slug,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `stripe.products.create failed: ${msg}` },
      { status: 502 },
    );
  }

  // ── 7. Stripe Prices.create (1 par plan) ──────────────────────────────
  const createdStripePrices: Array<{ supabase_price_id: string; stripe_price_id: string }> = [];
  try {
    for (const p of pricesWithIds) {
      const stripePrice = await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: p.unit_amount,
        currency: CURRENCY,
        recurring: { interval: VALID_INTERVALS[p.billing_interval] },
        metadata: {
          supabase_price_id: p.id,
          supabase_product_id: productUuid,
          unit_type: p.unit_type,
        },
        nickname: `${body.slug}/${p.billing_interval}/${p.unit_type}`,
        active: true,
      });
      createdStripePrices.push({
        supabase_price_id: p.id,
        stripe_price_id: stripePrice.id,
      });
    }
  } catch (err) {
    // Best-effort archive du Stripe Product + des Prices déjà créées.
    const msg = err instanceof Error ? err.message : String(err);
    await archiveStripeBestEffort(stripe, stripeProduct.id, createdStripePrices.map((p) => p.stripe_price_id));
    return NextResponse.json(
      {
        error: `stripe.prices.create failed: ${msg}`,
        orphaned_stripe_product_id: stripeProduct.id,
      },
      { status: 502 },
    );
  }

  // ── 8. RPC admin_create_product (atomique, transactionnelle) ──────────
  // L'écriture passe par la session admin (RLS gating au niveau RPC via
  // is_admin() interne). On a déjà vérifié is_admin côté route ; la RPC
  // re-vérifie quoi qu'il arrive (defense in depth).
  const pricesPayload = pricesWithIds.map((p, i) => ({
    id: p.id,
    billing_interval: p.billing_interval,
    unit_type: p.unit_type,
    unit_amount: p.unit_amount,
    currency: CURRENCY,
    stripe_price_id: createdStripePrices[i].stripe_price_id,
  }));

  const { data: createdRow, error: rpcErr } = await supabaseUser.rpc('admin_create_product', {
    p_id: productUuid,
    p_slug: body.slug,
    p_name: body.name,
    p_description: body.description ?? null,
    p_specs: body.specs ?? null,
    p_category_id: categoryUuid,
    p_availability: body.availability,
    p_priority: body.priority ?? 0,
    p_is_featured: body.is_featured ?? false,
    p_is_active: body.is_active ?? true,
    p_prices: pricesPayload,
  });

  if (rpcErr) {
    // Rollback Stripe best-effort. La DB est intacte (la RPC a échoué
    // avant ou pendant l'INSERT — PG rollback la transaction). On
    // archive Stripe pour ne pas laisser de Product + Prices fantômes
    // accessibles depuis un Dashboard Stripe.
    console.error(
      `[admin/products POST] RPC admin_create_product failed after creating ` +
        `Stripe Product ${stripeProduct.id} (and ${createdStripePrices.length} ` +
        `Stripe Prices). Archiving Stripe best-effort. RPC error: ${rpcErr.message} ` +
        `(code=${rpcErr.code ?? '?'})`,
    );
    await archiveStripeBestEffort(
      stripe,
      stripeProduct.id,
      createdStripePrices.map((p) => p.stripe_price_id),
    );

    const status = STATUS_BY_CODE[rpcErr.code ?? ''] ?? 500;
    return NextResponse.json(
      {
        error: rpcErr.message,
        code: rpcErr.code,
        orphaned_stripe_product_id: stripeProduct.id,
        archive_attempted: true,
      },
      { status },
    );
  }

  // AUDIT LOG POINT (Ticket 44) — best-effort.
  await logAdminAction({
    actor: { id: user.id, email: user.email ?? null },
    action: 'create',
    entityType: 'product',
    entityId: productUuid,
    summary: `Produit « ${body.slug} » créé (${body.prices.length} prix Stripe)`,
    diff: {
      slug: body.slug,
      stripe_product_id: stripeProduct.id,
      stripe_price_ids: createdStripePrices.map((p) => p.stripe_price_id),
    },
  });

  // ── 9. ISR revalidate ─────────────────────────────────────────────────
  revalidateCatalogue();

  return NextResponse.json({
    data: createdRow,
    stripe_product_id: stripeProduct.id,
    stripe_price_ids: createdStripePrices.map((p) => p.stripe_price_id),
  });
}

/**
 * Best-effort archive d'un Stripe Product + de ses Prices. Tolérant
 * aux échecs individuels : on log chaque erreur mais on continue —
 * l'idée est de réduire la quantité d'orphelins, pas de garantir un
 * cleanup parfait. Le route handler appelle cette fonction quand un
 * échec post-Stripe nous laisserait sans référence DB vers ces objets.
 */
async function archiveStripeBestEffort(
  stripe: Stripe,
  productId: string,
  priceIds: string[],
): Promise<void> {
  for (const pid of priceIds) {
    try {
      await stripe.prices.update(pid, { active: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[admin/products POST] best-effort archive of Stripe Price ${pid} failed: ${msg}`);
    }
  }
  try {
    await stripe.products.update(productId, { active: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[admin/products POST] best-effort archive of Stripe Product ${productId} failed: ${msg}`);
  }
}
