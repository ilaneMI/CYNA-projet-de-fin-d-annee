-- Lot Outils — Édition carrousel + catégories en BO (complément RLS).
-- Mirrors public.products_admin_read : sans cette policy, un admin ne voit
-- pas les lignes is_active=false dans le BO, ce qui rend la (ré)activation
-- impossible depuis la UI. La policy publique reste inchangée — la home
-- continue de filtrer sur is_active. PostgreSQL combine les policies
-- multiples en OR, donc l'admin voit (is_active=true OR is_admin()) =
-- toutes les lignes ; le public voit uniquement is_active=true.

drop policy if exists carousel_slides_admin_read on public.carousel_slides;
create policy carousel_slides_admin_read
  on public.carousel_slides
  for select to authenticated
  using (public.is_admin());

drop policy if exists categories_admin_read on public.categories;
create policy categories_admin_read
  on public.categories
  for select to authenticated
  using (public.is_admin());
