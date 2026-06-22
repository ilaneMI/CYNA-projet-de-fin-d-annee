import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe-server';
import { requireAdminAAL2 } from '@/lib/admin/require-aal2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * /api/admin/promotions — Ticket 55.
 *
 * Source de vérité = Stripe. Aucune table locale (mêmes principes
 * que le ticket 22 pour les cartes).
 *
 * Sécurité :
 *   - auth.getUser() → 401
 *   - is_admin() RPC → 403
 *     Défense en profondeur : middleware `/admin/*` filtre déjà en
 *     amont, mais on redouble ici pour rester safe même si un futur
 *     changement de middleware ouvrait ces routes.
 *
 * Modèle Stripe : chaque action admin crée UN Coupon (la réduction)
 * puis UN PromotionCode (le code saisissable). Si l'appel PromotionCode
 * échoue après que le Coupon a été créé, on rollback le Coupon
 * (best-effort — Stripe autorise la suppression d'un coupon non utilisé).
 */

const CODE_RE = /^[A-Z0-9_-]{3,32}$/;

type DiscountType = 'percent' | 'amount';
type Duration = 'once' | 'repeating' | 'forever';

type CreateBody = {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  duration: Duration;
  durationInMonths?: number;
  expiresAt?: number | null;
  maxRedemptions?: number | null;
};

type UiPromotion = {
  id: string;
  code: string;
  active: boolean;
  discountType: DiscountType;
  discountValue: number;
  duration: Duration;
  durationInMonths: number | null;
  expiresAt: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  currency: string | null;
  created: number;
};

function toUiPromotion(pc: Stripe.PromotionCode): UiPromotion | null {
  // Stripe API 2026-05-27.dahlia : PromotionCode.coupon a été déplacé
  // sous `promotion.coupon`. Le shape est { promotion: { type: 'coupon',
  // coupon: string | Coupon | null } }. On expand `data.promotion.coupon`
  // côté list/create pour obtenir l'objet Coupon complet ici.
  const rawCoupon = pc.promotion?.coupon;
  const coupon =
    !rawCoupon || typeof rawCoupon === 'string' ? null : (rawCoupon as Stripe.Coupon);
  if (!coupon) return null;

  const discountType: DiscountType =
    typeof coupon.percent_off === 'number' ? 'percent' : 'amount';
  const discountValue =
    discountType === 'percent'
      ? (coupon.percent_off ?? 0)
      : (coupon.amount_off ?? 0);

  return {
    id: pc.id,
    code: pc.code,
    active: pc.active,
    discountType,
    discountValue,
    duration: coupon.duration as Duration,
    durationInMonths: coupon.duration_in_months ?? null,
    expiresAt: pc.expires_at ?? null,
    maxRedemptions: pc.max_redemptions ?? null,
    timesRedeemed: pc.times_redeemed ?? 0,
    currency: coupon.currency ?? null,
    created: pc.created,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAdminAAL2();
  if (!guard.ok) return guard.response;

  const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';

  const stripe = getStripe();
  try {
    const list = await stripe.promotionCodes.list({
      limit: 100,
      expand: ['data.promotion.coupon'],
      ...(includeInactive ? {} : { active: true }),
    });
    const promotions = list.data
      .map(toUiPromotion)
      .filter((p): p is UiPromotion => p !== null);
    return NextResponse.json({ promotions });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[admin/promotions GET] stripe failure: ${message}`);
    return NextResponse.json(
      { error: 'unable to list promotions' },
      { status: 502 },
    );
  }
}

function validateCreate(body: unknown): CreateBody | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'invalid body' };
  const b = body as Record<string, unknown>;

  const code = typeof b.code === 'string' ? b.code.trim().toUpperCase() : '';
  if (!CODE_RE.test(code)) {
    return {
      error:
        "code invalide : 3 à 32 caractères, A-Z 0-9 _ - uniquement (ex. 'RENTREE24')",
    };
  }

  const discountType = b.discountType;
  if (discountType !== 'percent' && discountType !== 'amount') {
    return { error: "discountType doit être 'percent' ou 'amount'" };
  }

  const discountValue = Number(b.discountValue);
  if (!Number.isFinite(discountValue) || !Number.isInteger(discountValue)) {
    return { error: 'discountValue doit être un entier' };
  }
  if (discountType === 'percent' && (discountValue < 1 || discountValue > 100)) {
    return { error: 'pourcentage entre 1 et 100' };
  }
  if (discountType === 'amount' && discountValue <= 0) {
    return { error: 'montant en centimes doit être > 0' };
  }

  const duration = b.duration;
  if (duration !== 'once' && duration !== 'repeating' && duration !== 'forever') {
    return { error: "duration doit être 'once', 'repeating' ou 'forever'" };
  }

  let durationInMonths: number | undefined;
  if (duration === 'repeating') {
    const raw = Number(b.durationInMonths);
    if (!Number.isInteger(raw) || raw < 1 || raw > 999) {
      return { error: "durationInMonths requis (1..999) quand duration = 'repeating'" };
    }
    durationInMonths = raw;
  }

  let expiresAt: number | null | undefined = null;
  if (b.expiresAt != null) {
    const raw = Number(b.expiresAt);
    if (!Number.isInteger(raw) || raw <= Math.floor(Date.now() / 1000)) {
      return { error: 'expiresAt doit être un timestamp Unix (secondes) futur' };
    }
    expiresAt = raw;
  }

  let maxRedemptions: number | null | undefined = null;
  if (b.maxRedemptions != null) {
    const raw = Number(b.maxRedemptions);
    if (!Number.isInteger(raw) || raw < 1) {
      return { error: 'maxRedemptions doit être un entier >= 1' };
    }
    maxRedemptions = raw;
  }

  return {
    code,
    discountType,
    discountValue,
    duration,
    durationInMonths,
    expiresAt,
    maxRedemptions,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAdminAAL2();
  if (!guard.ok) return guard.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = validateCreate(raw);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const stripe = getStripe();

  // 1. Créer le coupon.
  let coupon: Stripe.Coupon;
  try {
    const couponParams: Stripe.CouponCreateParams = {
      duration: parsed.duration,
      metadata: { created_from: 'cyna_admin_bo' },
    };
    if (parsed.discountType === 'percent') {
      couponParams.percent_off = parsed.discountValue;
    } else {
      couponParams.amount_off = parsed.discountValue;
      couponParams.currency = 'eur';
    }
    if (parsed.duration === 'repeating' && parsed.durationInMonths) {
      couponParams.duration_in_months = parsed.durationInMonths;
    }
    coupon = await stripe.coupons.create(couponParams);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[admin/promotions POST] coupon create failed: ${message}`);
    return NextResponse.json(
      { error: `création du coupon Stripe échouée : ${message}` },
      { status: 502 },
    );
  }

  // 2. Créer le promotion code attaché au coupon. Rollback du coupon
  // en cas d'échec — si on laisse tomber, on accumule des coupons
  // orphelins non utilisés dans Stripe (pas critique mais sale).
  let promotionCode: Stripe.PromotionCode;
  try {
    const pcParams: Stripe.PromotionCodeCreateParams = {
      promotion: { type: 'coupon', coupon: coupon.id },
      code: parsed.code,
    };
    if (parsed.expiresAt) pcParams.expires_at = parsed.expiresAt;
    if (parsed.maxRedemptions) pcParams.max_redemptions = parsed.maxRedemptions;
    promotionCode = await stripe.promotionCodes.create(pcParams);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[admin/promotions POST] promotion code create failed after coupon ${coupon.id}: ${message}`,
    );
    try {
      await stripe.coupons.del(coupon.id);
    } catch (delErr) {
      const delMsg = delErr instanceof Error ? delErr.message : String(delErr);
      console.error(
        `[admin/promotions POST] rollback failed — orphan coupon ${coupon.id}: ${delMsg}`,
      );
    }
    // 409 si Stripe a refusé pour "code déjà pris" (Stripe error message
    // en clair suffit — on transmet).
    const isConflict = /already exists/i.test(message);
    return NextResponse.json(
      { error: `création du code échouée : ${message}` },
      { status: isConflict ? 409 : 502 },
    );
  }

  // Re-shape avec le coupon expandé pour renvoyer un UiPromotion.
  // `promotionCodes.create` renvoie `promotion.coupon` sous forme
  // d'ID (pas expandé) — on injecte le Coupon complet obtenu à
  // l'étape 1 pour éviter un aller-retour Stripe supplémentaire.
  const shaped = toUiPromotion({
    ...promotionCode,
    promotion: { type: 'coupon', coupon },
  } as Stripe.PromotionCode);
  return NextResponse.json({ promotion: shaped }, { status: 201 });
}
