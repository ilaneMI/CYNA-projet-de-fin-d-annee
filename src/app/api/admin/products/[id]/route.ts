import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';

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
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'authentication required' }, { status: 401 });
  }

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

  revalidateCatalogue();
  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'authentication required' }, { status: 401 });
  }

  const { error } = await supabase.rpc('admin_delete_product', { p_id: params.id });
  if (error) {
    const status = STATUS_BY_CODE[error.code ?? ''] ?? 500;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  revalidateCatalogue();
  return NextResponse.json({ deleted: true });
}
