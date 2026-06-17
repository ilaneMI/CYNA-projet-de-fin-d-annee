import { supabase } from '@/lib/supabase';
import type { Category } from './types';

type CategoryRow = {
  id: string;
  name: string;
  description: string;
  image_url: string;
  created_at: string;
};

const toCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  description: row.description,
  image_url: row.image_url,
  created_at: row.created_at,
});

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, description, image_url, created_at')
    .order('name', { ascending: true });
  if (error) {
    throw new Error(`Supabase getCategories failed: ${error.message}`);
  }
  return (data ?? []).map(toCategory);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, description, image_url, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new Error(`Supabase getCategoryById failed: ${error.message}`);
  }
  return data ? toCategory(data) : null;
}
