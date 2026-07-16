import { supabase } from '@/lib/supabase';
import type { Category } from './types';

/**
 * The data layer exposes `id = slug` so the existing pages (which build
 * URLs like `/category/${cat.id}`) keep working unchanged after the
 * schema went from `text` ids to UUID + slug. The real UUID stays
 * internal to the DB.
 */

type CategoryRow = {
  id: string;
  slug: string;
  name: Record<string, string> | null;
  description: Record<string, string> | null;
  image_url: string | null;
  display_order: number;
  created_at: string;
};

const CATEGORY_COLUMNS = 'id, slug, name, description, image_url, display_order, created_at';

// Locale-aware pick avec fallback FR — miroir du pipeline RSC catalogue.
const pickLoc = (rec: Record<string, string> | null, locale: string): string =>
  rec?.[locale] ?? rec?.fr ?? rec?.en ?? '';

const toCategory = (row: CategoryRow, locale: string): Category => ({
  id: row.slug,
  name: pickLoc(row.name, locale),
  description: pickLoc(row.description, locale),
  image_url: row.image_url ?? '',
  created_at: row.created_at,
});

export async function getCategories(locale: string = 'fr'): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_COLUMNS)
    .order('display_order', { ascending: true });
  if (error) {
    throw new Error(`Supabase getCategories failed: ${error.message}`);
  }
  return ((data ?? []) as CategoryRow[]).map((r) => toCategory(r, locale));
}

export async function getCategoryById(id: string, locale: string = 'fr'): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_COLUMNS)
    .eq('slug', id)
    .maybeSingle();
  if (error) {
    throw new Error(`Supabase getCategoryById failed: ${error.message}`);
  }
  return data ? toCategory(data as CategoryRow, locale) : null;
}
