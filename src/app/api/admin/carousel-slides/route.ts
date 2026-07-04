import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminAAL2 } from '@/lib/admin/require-aal2';
import { logAdminAction } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/carousel-slides
 *
 * Création via la RPC `public.admin_create_carousel_slide`. La RPC
 * vérifie elle-même `is_admin()` (defense in depth) ; on conserve la
 * vérif côté route pour court-circuiter sans appel SQL si la session
 * n'est même pas authentifiée.
 *
 * `revalidatePath('/')` après succès : la home est ISR et réutilise la
 * sortie de getCarouselItems(). Sans revalidate, le nouveau slide ne
 * remonte que dans la fenêtre 3600s par défaut.
 */

const STATUS_BY_CODE: Record<string, number> = {
  '42501': 403,
  '22023': 400,
  P0002: 404,
};

type Body = {
  title: Record<string, string>;
  image_url: string;
  subtitle?: Record<string, string> | null;
  cta_text?: Record<string, string> | null;
  cta_link?: string | null;
  display_order?: number;
  is_active?: boolean;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAdminAAL2();
  if (!guard.ok) return guard.response;
  const { supabase, user } = guard;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('admin_create_carousel_slide', {
    p_title: body.title,
    p_image_url: body.image_url,
    p_subtitle: body.subtitle ?? null,
    p_cta_text: body.cta_text ?? null,
    p_cta_link: body.cta_link ?? null,
    p_display_order: body.display_order ?? 0,
    p_is_active: body.is_active ?? true,
  });
  if (error) {
    const status = STATUS_BY_CODE[error.code ?? ''] ?? 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  // AUDIT LOG POINT (Ticket 44) — best-effort.
  const createdRow = data as { id?: string } | null;
  const titleShort = body.title?.fr ?? body.title?.en ?? '(sans titre)';
  await logAdminAction({
    actor: { id: user.id, email: user.email ?? null },
    action: 'create',
    entityType: 'carousel_slide',
    entityId: String(createdRow?.id ?? ''),
    summary: `Slide carrousel « ${titleShort} » créée`,
    diff: null,
  });

  revalidatePath('/');
  return NextResponse.json({ data });
}
