import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminAAL2 } from '@/lib/admin/require-aal2';
import { logAdminAction } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH / DELETE /api/admin/carousel-slides/[id]
 *
 * Pass-through vers `admin_update_carousel_slide` / `admin_delete_carousel_slide`.
 * Les RPC re-vérifient `is_admin()` ; cette route est defense-in-depth.
 */

const STATUS_BY_CODE: Record<string, number> = {
  '42501': 403,
  '22023': 400,
  P0002: 404,
};

type Patch = {
  title?: Record<string, string> | null;
  subtitle?: Record<string, string> | null;
  image_url?: string | null;
  cta_text?: Record<string, string> | null;
  cta_link?: string | null;
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

  const { data, error } = await supabase.rpc('admin_update_carousel_slide', {
    p_id: params.id,
    p_title: patch.title ?? null,
    p_subtitle: patch.subtitle ?? null,
    p_image_url: patch.image_url ?? null,
    p_cta_text: patch.cta_text ?? null,
    p_cta_link: patch.cta_link ?? null,
    p_display_order: patch.display_order ?? null,
    p_is_active: patch.is_active ?? null,
  });
  if (error) {
    const status = STATUS_BY_CODE[error.code ?? ''] ?? 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  // AUDIT LOG POINT (Ticket 44) — best-effort.
  await logAdminAction({
    actor: { id: user.id, email: user.email ?? null },
    action: 'update',
    entityType: 'carousel_slide',
    entityId: params.id,
    summary: `Slide carrousel ${params.id} mise à jour`,
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

  const { error } = await supabase.rpc('admin_delete_carousel_slide', { p_id: params.id });
  if (error) {
    const status = STATUS_BY_CODE[error.code ?? ''] ?? 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  // AUDIT LOG POINT (Ticket 44) — best-effort.
  await logAdminAction({
    actor: { id: user.id, email: user.email ?? null },
    action: 'delete',
    entityType: 'carousel_slide',
    entityId: params.id,
    summary: `Slide carrousel ${params.id} supprimée`,
    diff: null,
  });

  revalidatePath('/');
  return NextResponse.json({ deleted: true });
}
