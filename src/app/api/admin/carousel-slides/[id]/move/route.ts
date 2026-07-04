import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminAAL2 } from '@/lib/admin/require-aal2';
import { logAdminAction } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/carousel-slides/[id]/move
 *
 * Body : { direction: 'up' | 'down' }. La RPC `admin_move_carousel_slide`
 * fait un swap atomique avec la voisine. Si la slide est déjà à la
 * bordure, la RPC no-op silencieusement (UI désactive le bouton).
 */

const STATUS_BY_CODE: Record<string, number> = {
  '42501': 403,
  '22023': 400,
  P0002: 404,
};

type Body = { direction: 'up' | 'down' };

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const guard = await requireAdminAAL2();
  if (!guard.ok) return guard.response;
  const { supabase, user } = guard;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (body.direction !== 'up' && body.direction !== 'down') {
    return NextResponse.json(
      { error: 'direction must be "up" or "down"' },
      { status: 400 },
    );
  }

  const { error } = await supabase.rpc('admin_move_carousel_slide', {
    p_id: params.id,
    p_direction: body.direction,
  });
  if (error) {
    const status = STATUS_BY_CODE[error.code ?? ''] ?? 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  // AUDIT LOG POINT (Ticket 44) — best-effort.
  await logAdminAction({
    actor: { id: user.id, email: user.email ?? null },
    action: 'reorder',
    entityType: 'carousel_slide',
    entityId: params.id,
    summary: `Slide carrousel ${params.id} déplacée vers le ${body.direction === 'up' ? 'haut' : 'bas'}`,
    diff: { direction: body.direction },
  });

  revalidatePath('/');
  return NextResponse.json({ ok: true });
}
