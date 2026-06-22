import { supabase } from '@/lib/supabase';

/**
 * Ticket 45 — lecture des produits en rupture pour l'alerte BO.
 *
 * Périmètre : actifs uniquement (is_active=true AND availability='out_of_stock').
 * Un produit désactivé n'est pas en vente → sa rupture n'est pas un
 * événement business à signaler. Lecture via products_public_read
 * (anon/authenticated + is_active), donc pas de dépendance à
 * products_admin_read AAL2 — mais l'UI (dashboard) est de toute façon
 * derrière le middleware AAL2, cohérent avec F3.
 *
 * Si un jour le périmètre doit inclure les désactivés (produits en
 * "pause" qui devraient alerter), passer sur products_admin_read en
 * changeant le filtre côté requête.
 */

export type RupturedProduct = {
  id: string;
  slug: string;
  name: string;
  updated_at: string;
};

type Row = {
  id: string;
  slug: string;
  name: Record<string, string> | null;
  updated_at: string;
};

export async function getRupturedProducts(): Promise<RupturedProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, slug, name, updated_at')
    .eq('is_active', true)
    .eq('availability', 'out_of_stock')
    .order('updated_at', { ascending: false });
  if (error) {
    throw new Error(`Supabase getRupturedProducts failed: ${error.message}`);
  }
  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name?.fr ?? row.name?.en ?? row.slug,
    updated_at: row.updated_at,
  }));
}
