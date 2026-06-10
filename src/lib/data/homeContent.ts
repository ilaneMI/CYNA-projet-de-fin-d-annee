import { supabase } from '@/lib/supabase';

/**
 * Ticket 4 — blocs de texte dynamiques affichés sur la home.
 *
 * Lecture RLS-protégée : `homepage_content_public_read` filtre déjà
 * sur `is_active`. On applique aussi le filtre côté requête pour
 * rendre l'intention explicite et éviter tout affichage en admin
 * (l'admin_read policy renverrait les inactifs).
 *
 * Le type public expose la locale déjà résolue (fr par défaut, fallback
 * en) — même choix que `getCategories`. Le multi-langue vit dans jsonb
 * côté DB ; le front reste plat.
 */

export type HomeBlock = {
  id: string;
  title: string;
  body: string;
  display_order: number;
};

type Localised = Record<string, string> | null;

type Row = {
  slug: string;
  title: Localised;
  body: Localised;
  display_order: number;
};

const resolve = (loc: Localised): string => loc?.fr ?? loc?.en ?? '';

export async function getHomeContent(): Promise<HomeBlock[]> {
  const { data, error } = await supabase
    .from('homepage_content')
    .select('slug, title, body, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    throw new Error(`Supabase getHomeContent failed: ${error.message}`);
  }
  return ((data ?? []) as Row[]).map((row) => ({
    id: row.slug,
    title: resolve(row.title),
    body: resolve(row.body),
    display_order: row.display_order,
  }));
}
