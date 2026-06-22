import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminAAL2 } from '@/lib/admin/require-aal2';
import { logAdminAction } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH / DELETE /api/admin/categories/[id]
 *
 * - PATCH : 23505 si le nouveau slug est déjà pris (citext UNIQUE).
 * - DELETE : hard delete. 23503 si la FK `products.category_id` RESTRICT
 *   bloque (au moins un produit lié) — l'UI catch et propose alors
 *   "Désactiver" via PATCH avec `is_active=false`.
 */

const STATUS_BY_CODE: Record<string, number> = {
  '42501': 403,
  '22023': 400,
  '23505': 409, // slug UNIQUE conflict
  '23503': 409, // FK restrict — category referenced by products
  P0002: 404,
};

type Patch = {
  slug?: string | null;
  name?: Record<string, string> | null;
  description?: Record<string, string> | null;
  image_url?: string | null;
  display_order?: number | null;
  is_active?: boolean | null;
};

function revalidateCatalogue(): void {
  revalidatePath('/');
  revalidatePath('/catalogue');
  revalidatePath('/category/[id]', 'page');
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

  const { data, error } = await supabase.rpc('admin_update_category', {
    p_id: params.id,
    p_slug: patch.slug ?? null,
    p_name: patch.name ?? null,
    p_description: patch.description ?? null,
    p_image_url: patch.image_url ?? null,
    p_display_order: patch.display_order ?? null,
    p_is_active: patch.is_active ?? null,
  });
  if (error) {
    const status = STATUS_BY_CODE[error.code ?? ''] ?? 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  // AUDIT LOG POINT (Ticket 44) — best-effort.
  const updatedRow = data as { slug?: string } | null;
  await logAdminAction({
    actor: { id: user.id, email: user.email ?? null },
    action: 'update',
    entityType: 'category',
    entityId: params.id,
    summary: `Catégorie « ${updatedRow?.slug ?? params.id} » mise à jour`,
    diff: { patch },
  });

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

  const { error } = await supabase.rpc('admin_delete_category', { p_id: params.id });
  if (error) {
    const status = STATUS_BY_CODE[error.code ?? ''] ?? 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  // AUDIT LOG POINT (Ticket 44) — best-effort.
  await logAdminAction({
    actor: { id: user.id, email: user.email ?? null },
    action: 'delete',
    entityType: 'category',
    entityId: params.id,
    summary: `Catégorie ${params.id} supprimée`,
    diff: null,
  });

  revalidateCatalogue();
  return NextResponse.json({ deleted: true });
}
