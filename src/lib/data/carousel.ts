import { supabase } from '@/lib/supabase';
import type { CarouselItem } from './types';

type CarouselRow = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  cta_text: string | null;
  cta_link: string | null;
  order_index: number;
  created_at: string;
};

const toCarouselItem = (row: CarouselRow): CarouselItem => ({
  id: row.id,
  title: row.title,
  description: row.description,
  image_url: row.image_url,
  cta_text: row.cta_text ?? undefined,
  cta_link: row.cta_link ?? undefined,
  order_index: row.order_index,
  created_at: row.created_at,
});

export async function getCarouselItems(): Promise<CarouselItem[]> {
  const { data, error } = await supabase
    .from('carousel_items')
    .select('id, title, description, image_url, cta_text, cta_link, order_index, created_at')
    .order('order_index', { ascending: true });
  if (error) {
    throw new Error(`Supabase getCarouselItems failed: ${error.message}`);
  }
  return (data ?? []).map(toCarouselItem);
}
