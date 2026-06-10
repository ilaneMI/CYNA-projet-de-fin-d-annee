import { NextResponse, type NextRequest } from 'next/server';
import { getStripe } from '@/lib/stripe-server';
import { requireAdminAAL2 } from '@/lib/admin/require-aal2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/promotions/[id] — Ticket 55.
 *
 * Désactive un PromotionCode (Stripe n'autorise pas la suppression :
 * l'historique doit être préservé). L'UI expose ça comme "Supprimer" via
 * ConfirmDialog, mais côté Stripe c'est `active: false`.
 *
 * Aucune modification "édition" possible : Stripe n'autorise pas la
 * modification de percent_off / amount_off / duration après création.
 * L'admin doit désactiver et recréer — c'est signalé côté UI.
 *
 * Sécurité : même garde que la route parente. auth → is_admin() RPC.
 */

const PROMO_ID_RE = /^promo_[A-Za-z0-9_]+$/;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  if (!PROMO_ID_RE.test(params.id)) {
    return NextResponse.json({ error: 'invalid promotion id' }, { status: 400 });
  }

  const guard = await requireAdminAAL2();
  if (!guard.ok) return guard.response;

  let body: { active?: boolean };
  try {
    body = (await request.json()) as { active?: boolean };
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (body.active !== false) {
    // On n'expose QUE la désactivation (Stripe n'autorise pas la
    // ré-activation d'un code désactivé — il faut recréer). Refuser
    // proprement plutôt que de laisser un appel Stripe rebondir en 400.
    return NextResponse.json(
      {
        error:
          "action non autorisée : seul { active: false } est pris en charge (la réactivation nécessite de créer un nouveau code)",
      },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  try {
    await stripe.promotionCodes.update(params.id, { active: false });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'resource_missing') {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[admin/promotions PATCH] update failed for ${params.id}: ${message}`);
    return NextResponse.json(
      { error: `désactivation échouée : ${message}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, active: false });
}
