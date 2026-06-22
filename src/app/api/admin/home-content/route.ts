import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminAAL2 } from '@/lib/admin/require-aal2';
import { logAdminAction } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/home-content — Ticket 4.
 *
 * Création via `public.admin_create_home_block`. La RPC vérifie
 * `is_admin()` en 1re ligne (renvoie 42501 sinon) et valide la forme
 * jsonb du title/body. 23505 si conflit de slug (citext UNIQUE).
 *
 * revalidatePath('/') : le contenu est utilisé QUE sur la home.
 */

const STATUS_BY_CODE: Record<string, number> = {
  '42501': 403,
  '22023': 400,
  '23505': 409, // slug UNIQUE conflict
  P0002: 404,
};

type Body = {
  slug: string;
  title: Record<string, string>;
  body: Record<string, string>;
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

  const { data, error } = await supabase.rpc('admin_create_home_block', {
    p_slug: body.slug,
    p_title: body.title,
    p_body: body.body,
    p_display_order: body.display_order ?? 0,
    p_is_active: body.is_active ?? true,
  });
  if (error) {
    const status = STATUS_BY_CODE[error.code ?? ''] ?? 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  // AUDIT LOG POINT (Ticket 44) — best-effort.
  const createdRow = data as { id?: string; slug?: string } | null;
  await logAdminAction({
    actor: { id: user.id, email: user.email ?? null },
    action: 'create',
    entityType: 'home_block',
    entityId: String(createdRow?.id ?? ''),
    summary: `Bloc home « ${createdRow?.slug ?? body.slug} » créé`,
    diff: null,
  });

  revalidatePath('/');
  return NextResponse.json({ data });
}
