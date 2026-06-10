import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminAAL2 } from '@/lib/admin/require-aal2';
import { logAdminAction } from '@/lib/admin/audit-log';
import {
  tryClaimAndSendRuptureAlert,
  resetRuptureAlertFlag,
} from '@/lib/admin/rupture-alert';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH / DELETE /api/admin/products/[id]
 *
 * Thin pass-throughs to `public.admin_update_product` and
 * `public.admin_delete_product`. Both RPCs check `public.is_admin()`
 * themselves and raise `42501` for non-admins, so this handler is a
 * defence-in-depth layer rather than the primary gate.
 *
 *   - The browser session is forwarded via the supabase-ssr cookies, so
 *     the RPC runs with the caller's auth.uid(). Service-role is NOT
 *     used — a UI bug here cannot escalate.
 *   - `revalidatePath` is fired after a successful mutation to invalidate
 *     the ISR caches on the public catalogue / category / product
 *     pages, so an admin edit shows up immediately instead of waiting
 *     for the next revalidate window (3600 s).
 *
 * Error mapping:
 *   42501 (forbidden by is_admin)        → 403
 *   22023 (validation, our raise)        → 400
 *   P0002 (not found, our raise)         → 404
 *   anything else                        → 500
 */

const STATUS_BY_CODE: Record<string, number> = {
  '42501': 403,
  '22023': 400,
  P0002: 404,
};

type Patch = {
  name?: Record<string, string> | null;
  description?: Record<string, string> | null;
  specs?: Record<string, unknown> | null;
  availability?: 'in_stock' | 'limited' | 'out_of_stock' | null;
  priority?: number | null;
  is_featured?: boolean | null;
  is_active?: boolean | null;
  category_id?: string | null;
};

function revalidateCatalogue(): void {
  // Static home shows Top Products / Featured.
  revalidatePath('/');
  // /catalogue is `ƒ` dynamic, but the call is cheap and protects against
  // a future migration to ISR without us remembering this path.
  revalidatePath('/catalogue');
  // Both [id] segments are SSG; `'page'` invalidates every dynamic instance,
  // which is what we want when a product moves category or the catalogue
  // re-ranks on priority.
  revalidatePath('/category/[id]', 'page');
  revalidatePath('/product/[id]', 'page');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const guard = await requireAdminAAL2();
  if (!guard.ok) return guard.response;
  const { supabase, user } = guard;

  let patch: Patch;
  try {
    patch = (await request.json()) as Patch;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('admin_update_product', {
    p_id: params.id,
    p_name: patch.name ?? null,
    p_description: patch.description ?? null,
    p_specs: patch.specs ?? null,
    p_availability: patch.availability ?? null,
    p_priority: patch.priority ?? null,
    p_is_featured: patch.is_featured ?? null,
    p_is_active: patch.is_active ?? null,
    p_category_id: patch.category_id ?? null,
  });
  if (error) {
    const status = STATUS_BY_CODE[error.code ?? ''] ?? 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  // AUDIT LOG POINT (Ticket 44) — best-effort.
  await logAdminAction({
    actor: { id: user.id, email: user.email ?? null },
    action: 'update',
    entityType: 'product',
    entityId: params.id,
    summary: `Produit ${params.id} mis à jour`,
    diff: { patch },
  });

  // TICKET 45 — alerte rupture stock, best-effort strict.
  // Ces appels ne peuvent JAMAIS faire échouer la mutation ni changer
  // le status/payload (helpers wrappent tout dans try/catch, retour
  // Promise<void>). Le bloc rupture est HORS de la chaîne d'audit —
  // le log ticket 44 s'insère indépendamment.
  //
  // Distinction :
  //   - patch.availability === 'out_of_stock' → claim atomique + email
  //     si claim OK. Anti-spam via rupture_alerted_at.
  //   - patch.availability in ('in_stock','limited') → reset du flag
  //     pour ré-armer la prochaine alerte.
  //   - patch.availability undefined/null (mutation qui ne touche pas
  //     availability) → aucune action, comportement inchangé.
  if (patch.availability === 'out_of_stock') {
    const row = (Array.isArray(data) ? data[0] : data) as
      | { name?: Record<string, string> | null; slug?: string }
      | null;
    const productName =
      row?.name?.fr ?? row?.name?.en ?? row?.slug ?? params.id;
    await tryClaimAndSendRuptureAlert({
      actor: { id: user.id, email: user.email ?? null },
      productId: params.id,
      productName: String(productName),
    });
  } else if (
    patch.availability === 'in_stock' ||
    patch.availability === 'limited'
  ) {
    await resetRuptureAlertFlag(params.id);
  }

  revalidateCatalogue();
  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const guard = await requireAdminAAL2();
  if (!guard.ok) return guard.response;
  const { supabase, user } = guard;

  const { error } = await supabase.rpc('admin_delete_product', { p_id: params.id });
  if (error) {
    const status = STATUS_BY_CODE[error.code ?? ''] ?? 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  // AUDIT LOG POINT (Ticket 44) — best-effort.
  await logAdminAction({
    actor: { id: user.id, email: user.email ?? null },
    action: 'delete',
    entityType: 'product',
    entityId: params.id,
    summary: `Produit ${params.id} supprimé (soft delete via RPC)`,
    diff: null,
  });

  revalidateCatalogue();
  return NextResponse.json({ deleted: true });
}
