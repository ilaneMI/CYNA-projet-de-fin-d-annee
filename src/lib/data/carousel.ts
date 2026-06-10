import { supabase } from '@/lib/supabase';
import type { CarouselItem } from './types';

type CarouselRow = {
  id: string;
  title: Record<string, string> | null;
  subtitle: Record<string, string> | null;
  image_url: string;
  cta_text: Record<string, string> | null;
  cta_link: string | null;
  display_order: number;
  created_at: string;
};

const CAROUSEL_COLUMNS =
  'id, title, subtitle, image_url, cta_text, cta_link, display_order, created_at';

/**
 * The legacy `CarouselItem` shape used `description` for the body line and
 * `order_index` for the sort key. The normalized schema renames them to
 * `subtitle` and `display_order` — we remap here so the pages don't move.
 * `id` stays the UUID (used as a React key only, never as a URL slug).
 */
const toCarouselItem = (row: CarouselRow): CarouselItem => ({
  id: row.id,
  title: row.title?.fr ?? '',
  description: row.subtitle?.fr ?? '',
  image_url: row.image_url,
  cta_text: row.cta_text?.fr,
  cta_link: row.cta_link ?? undefined,
  order_index: row.display_order,
  created_at: row.created_at,
});

export async function getCarouselItems(): Promise<CarouselItem[]> {
  const { data, error } = await supabase
    .from('carousel_slides')
    .select(CAROUSEL_COLUMNS)
    .order('display_order', { ascending: true });
  if (error) {
    throw new Error(`Supabase getCarouselItems failed: ${error.message}`);
  }
  return ((data ?? []) as CarouselRow[]).map(toCarouselItem);
}
