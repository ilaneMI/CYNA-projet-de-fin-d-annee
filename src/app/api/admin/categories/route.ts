import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminAAL2 } from '@/lib/admin/require-aal2';
import { logAdminAction } from '@/lib/admin/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/categories
 *
 * Création via `public.admin_create_category`. La RPC vérifie `is_admin()`
 * et la validité du slug ; 23505 si conflit de slug (citext UNIQUE).
 *
 * revalidatePath('/') + '/catalogue' : le menu catégories alimente les
 * deux surfaces.
 */

const STATUS_BY_CODE: Record<string, number> = {
  '42501': 403,
  '22023': 400,
  '23505': 409, // slug UNIQUE conflict
  P0002: 404,
};

type Body = {
  slug: string;
  name: Record<string, string>;
  description?: Record<string, string> | null;
  image_url?: string | null;
  display_order?: number;
  is_active?: boolean;
};

function revalidateCatalogue(): void {
  revalidatePath('/');
  revalidatePath('/catalogue');
  revalidatePath('/category/[id]', 'page');
}

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

  const { data, error } = await supabase.rpc('admin_create_category', {
    p_slug: body.slug,
    p_name: body.name,
    p_description: body.description ?? null,
    p_image_url: body.image_url ?? null,
    p_display_order: body.display_order ?? 0,
    p_is_active: body.is_active ?? true,
  });
  if (error) {
    const status = STATUS_BY_CODE[error.code ?? ''] ?? 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  // AUDIT LOG POINT (Ticket 44) — best-effort, ne peut pas casser la mutation.
  const createdRow = data as { id?: string; slug?: string } | null;
  await logAdminAction({
    actor: { id: user.id, email: user.email ?? null },
    action: 'create',
    entityType: 'category',
    entityId: String(createdRow?.id ?? ''),
    summary: `Catégorie « ${createdRow?.slug ?? body.slug} » créée`,
    diff: null,
  });

  revalidateCatalogue();
  return NextResponse.json({ data });
}
