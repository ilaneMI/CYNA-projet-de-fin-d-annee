import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminAAL2 } from '@/lib/admin/require-aal2';
import { logAdminAction } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH / DELETE /api/admin/home-content/[id] — Ticket 4.
 *
 * Mirror strict de /api/admin/categories/[id] — RPCs admin_update_home_block
 * et admin_delete_home_block.
 * Pas de FK entrante sur homepage_content → DELETE hard sans piège 23503.
 */

const STATUS_BY_CODE: Record<string, number> = {
  '42501': 403,
  '22023': 400,
  '23505': 409,
  P0002: 404,
};

type Patch = {
  slug?: string | null;
  title?: Record<string, string> | null;
  body?: Record<string, string> | null;
  display_order?: number | null;
  is_active?: boolean | null;
};

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

  const { data, error } = await supabase.rpc('admin_update_home_block', {
    p_id: params.id,
    p_slug: patch.slug ?? null,
    p_title: patch.title ?? null,
    p_body: patch.body ?? null,
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
    entityType: 'home_block',
    entityId: params.id,
    summary: `Bloc home « ${updatedRow?.slug ?? params.id} » mis à jour`,
    diff: { patch },
  });

  revalidatePath('/');
  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const guard = await requireAdminAAL2();
  if (!guard.ok) return guard.response;
  const { supabase, user } = guard;

  const { error } = await supabase.rpc('admin_delete_home_block', { p_id: params.id });
  if (error) {
    const status = STATUS_BY_CODE[error.code ?? ''] ?? 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  // AUDIT LOG POINT (Ticket 44) — best-effort.
  await logAdminAction({
    actor: { id: user.id, email: user.email ?? null },
    action: 'delete',
    entityType: 'home_block',
    entityId: params.id,
    summary: `Bloc home ${params.id} supprimé`,
    diff: null,
  });

  revalidatePath('/');
  return NextResponse.json({ deleted: true });
}
