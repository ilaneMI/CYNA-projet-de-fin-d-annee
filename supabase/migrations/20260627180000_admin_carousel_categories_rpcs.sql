-- Lot Outils — Édition carrousel + catégories en backoffice.
-- Mirrors admin_*_product (migration 20260619230000) pattern :
--   - security definer, search_path='' (pas d'override de schéma possible)
--   - is_admin() interne en première ligne → 42501 si non admin
--   - revoke execute from public, anon ; grant à authenticated, service_role
--   - validation côté serveur (le client n'est jamais source de vérité)
--
-- Aucune policy RLS ni grant table-level modifié : la home reste lisible
-- world via les `*_public_read` (WHERE is_active) ; le BO écrit
-- exclusivement via ces RPCs. Une UPDATE/DELETE directe depuis un client
-- authentifié reste bloquée par l'absence de policy correspondante.
--
-- Convention reorder : swap atomique avec la voisine. Pas d'unique sur
-- display_order (on autorise des ex-aequo qui se trient ensuite par
-- created_at desc côté UI — pas de cas d'usage métier qui exige unique).
--
-- Catégories : DELETE dur ; si la FK products.category_id (RESTRICT)
-- bloque, Postgres propage 23503 et l'UI propose alors le soft delete
-- via admin_update_category(p_is_active=false). Pas de fallback caché
-- côté RPC.

-- ===========================================================================
-- CARROUSEL
-- ===========================================================================

create or replace function public.admin_create_carousel_slide(
  p_title         jsonb,
  p_image_url     text,
  p_subtitle      jsonb   default null,
  p_cta_text      jsonb   default null,
  p_cta_link      text    default null,
  p_display_order integer default 0,
  p_is_active     boolean default true
) returns public.carousel_slides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.carousel_slides;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  if p_title is null or jsonb_typeof(p_title) <> 'object'
     or coalesce(p_title->>'fr', p_title->>'en', '') = '' then
    raise exception 'title must be a JSON object with a non-empty fr or en key'
      using errcode = '22023';
  end if;
  if p_subtitle is not null and jsonb_typeof(p_subtitle) <> 'object' then
    raise exception 'subtitle must be a JSON object' using errcode = '22023';
  end if;
  if p_cta_text is not null and jsonb_typeof(p_cta_text) <> 'object' then
    raise exception 'cta_text must be a JSON object' using errcode = '22023';
  end if;
  if p_image_url is null or length(trim(p_image_url)) = 0 then
    raise exception 'image_url is required' using errcode = '22023';
  end if;
  if p_display_order < 0 or p_display_order > 1000 then
    raise exception 'display_order must be between 0 and 1000' using errcode = '22023';
  end if;

  insert into public.carousel_slides
    (title, subtitle, image_url, cta_text, cta_link, display_order, is_active)
  values
    (p_title, p_subtitle, p_image_url, p_cta_text, p_cta_link, p_display_order, p_is_active)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.admin_update_carousel_slide(
  p_id            uuid,
  p_title         jsonb   default null,
  p_subtitle      jsonb   default null,
  p_image_url     text    default null,
  p_cta_text      jsonb   default null,
  p_cta_link      text    default null,
  p_display_order integer default null,
  p_is_active     boolean default null
) returns public.carousel_slides
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.carousel_slides;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  if p_title is not null then
    if jsonb_typeof(p_title) <> 'object'
       or coalesce(p_title->>'fr', p_title->>'en', '') = '' then
      raise exception 'title must be a JSON object with a non-empty fr or en key'
        using errcode = '22023';
    end if;
  end if;
  if p_subtitle is not null and jsonb_typeof(p_subtitle) <> 'object' then
    raise exception 'subtitle must be a JSON object' using errcode = '22023';
  end if;
  if p_cta_text is not null and jsonb_typeof(p_cta_text) <> 'object' then
    raise exception 'cta_text must be a JSON object' using errcode = '22023';
  end if;
  if p_image_url is not null and length(trim(p_image_url)) = 0 then
    raise exception 'image_url cannot be empty' using errcode = '22023';
  end if;
  if p_display_order is not null and (p_display_order < 0 or p_display_order > 1000) then
    raise exception 'display_order must be between 0 and 1000' using errcode = '22023';
  end if;

  update public.carousel_slides
     set title         = coalesce(p_title,         title),
         subtitle      = coalesce(p_subtitle,      subtitle),
         image_url     = coalesce(p_image_url,     image_url),
         cta_text      = coalesce(p_cta_text,      cta_text),
         cta_link      = coalesce(p_cta_link,      cta_link),
         display_order = coalesce(p_display_order, display_order),
         is_active     = coalesce(p_is_active,     is_active)
   where id = p_id
   returning * into v_row;
  if not found then
    raise exception 'carousel slide % not found', p_id using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

create or replace function public.admin_delete_carousel_slide(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  delete from public.carousel_slides where id = p_id;
  if not found then
    raise exception 'carousel slide % not found', p_id using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_move_carousel_slide(
  p_id        uuid,
  p_direction text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_curr_order int;
  v_swap_id    uuid;
  v_swap_order int;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  if p_direction not in ('up', 'down') then
    raise exception 'direction must be ''up'' or ''down''' using errcode = '22023';
  end if;

  select display_order into v_curr_order
    from public.carousel_slides where id = p_id;
  if not found then
    raise exception 'carousel slide % not found', p_id using errcode = 'P0002';
  end if;

  if p_direction = 'up' then
    select id, display_order into v_swap_id, v_swap_order
      from public.carousel_slides
     where display_order < v_curr_order
     order by display_order desc, created_at desc
     limit 1;
  else
    select id, display_order into v_swap_id, v_swap_order
      from public.carousel_slides
     where display_order > v_curr_order
     order by display_order asc, created_at asc
     limit 1;
  end if;

  if v_swap_id is null then
    return;
  end if;

  update public.carousel_slides set display_order = v_swap_order where id = p_id;
  update public.carousel_slides set display_order = v_curr_order where id = v_swap_id;
end;
$$;

-- ===========================================================================
-- CATÉGORIES
-- ===========================================================================

create or replace function public.admin_create_category(
  p_slug          text,
  p_name          jsonb,
  p_description   jsonb   default null,
  p_image_url     text    default null,
  p_display_order integer default 0,
  p_is_active     boolean default true
) returns public.categories
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row  public.categories;
  v_slug text;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  if p_slug is null then
    raise exception 'slug is required' using errcode = '22023';
  end if;
  v_slug := lower(trim(p_slug));
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'slug must be kebab-case (a-z, 0-9, single hyphens)'
      using errcode = '22023';
  end if;
  if p_name is null or jsonb_typeof(p_name) <> 'object'
     or coalesce(p_name->>'fr', p_name->>'en', '') = '' then
    raise exception 'name must be a JSON object with a non-empty fr or en key'
      using errcode = '22023';
  end if;
  if p_description is not null and jsonb_typeof(p_description) <> 'object' then
    raise exception 'description must be a JSON object' using errcode = '22023';
  end if;
  if p_display_order < 0 or p_display_order > 1000 then
    raise exception 'display_order must be between 0 and 1000' using errcode = '22023';
  end if;

  insert into public.categories
    (slug, name, description, image_url, display_order, is_active)
  values
    (v_slug::public.citext, p_name, p_description, p_image_url, p_display_order, p_is_active)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.admin_update_category(
  p_id            uuid,
  p_slug          text    default null,
  p_name          jsonb   default null,
  p_description   jsonb   default null,
  p_image_url     text    default null,
  p_display_order integer default null,
  p_is_active     boolean default null
) returns public.categories
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row  public.categories;
  v_slug text;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  if p_slug is not null then
    v_slug := lower(trim(p_slug));
    if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'slug must be kebab-case (a-z, 0-9, single hyphens)'
        using errcode = '22023';
    end if;
  end if;
  if p_name is not null then
    if jsonb_typeof(p_name) <> 'object'
       or coalesce(p_name->>'fr', p_name->>'en', '') = '' then
      raise exception 'name must be a JSON object with a non-empty fr or en key'
        using errcode = '22023';
    end if;
  end if;
  if p_description is not null and jsonb_typeof(p_description) <> 'object' then
    raise exception 'description must be a JSON object' using errcode = '22023';
  end if;
  if p_display_order is not null and (p_display_order < 0 or p_display_order > 1000) then
    raise exception 'display_order must be between 0 and 1000' using errcode = '22023';
  end if;

  update public.categories
     set slug          = coalesce(v_slug::public.citext, slug),
         name          = coalesce(p_name,                name),
         description   = coalesce(p_description,         description),
         image_url     = coalesce(p_image_url,           image_url),
         display_order = coalesce(p_display_order,       display_order),
         is_active     = coalesce(p_is_active,           is_active)
   where id = p_id
   returning * into v_row;
  if not found then
    raise exception 'category % not found', p_id using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

create or replace function public.admin_delete_category(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  delete from public.categories where id = p_id;
  if not found then
    raise exception 'category % not found', p_id using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_move_category(
  p_id        uuid,
  p_direction text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_curr_order int;
  v_swap_id    uuid;
  v_swap_order int;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  if p_direction not in ('up', 'down') then
    raise exception 'direction must be ''up'' or ''down''' using errcode = '22023';
  end if;

  select display_order into v_curr_order
    from public.categories where id = p_id;
  if not found then
    raise exception 'category % not found', p_id using errcode = 'P0002';
  end if;

  if p_direction = 'up' then
    select id, display_order into v_swap_id, v_swap_order
      from public.categories
     where display_order < v_curr_order
     order by display_order desc, created_at desc
     limit 1;
  else
    select id, display_order into v_swap_id, v_swap_order
      from public.categories
     where display_order > v_curr_order
     order by display_order asc, created_at asc
     limit 1;
  end if;

  if v_swap_id is null then
    return;
  end if;

  update public.categories set display_order = v_swap_order where id = p_id;
  update public.categories set display_order = v_curr_order where id = v_swap_id;
end;
$$;

-- ===========================================================================
-- GRANTS — pattern strict admin_*_product
-- ===========================================================================
revoke execute on function public.admin_create_carousel_slide(jsonb, text, jsonb, jsonb, text, integer, boolean) from public, anon;
revoke execute on function public.admin_update_carousel_slide(uuid, jsonb, jsonb, text, jsonb, text, integer, boolean) from public, anon;
revoke execute on function public.admin_delete_carousel_slide(uuid) from public, anon;
revoke execute on function public.admin_move_carousel_slide(uuid, text) from public, anon;

revoke execute on function public.admin_create_category(text, jsonb, jsonb, text, integer, boolean) from public, anon;
revoke execute on function public.admin_update_category(uuid, text, jsonb, jsonb, text, integer, boolean) from public, anon;
revoke execute on function public.admin_delete_category(uuid) from public, anon;
revoke execute on function public.admin_move_category(uuid, text) from public, anon;

grant execute on function public.admin_create_carousel_slide(jsonb, text, jsonb, jsonb, text, integer, boolean) to authenticated, service_role;
grant execute on function public.admin_update_carousel_slide(uuid, jsonb, jsonb, text, jsonb, text, integer, boolean) to authenticated, service_role;
grant execute on function public.admin_delete_carousel_slide(uuid) to authenticated, service_role;
grant execute on function public.admin_move_carousel_slide(uuid, text) to authenticated, service_role;

grant execute on function public.admin_create_category(text, jsonb, jsonb, text, integer, boolean) to authenticated, service_role;
grant execute on function public.admin_update_category(uuid, text, jsonb, jsonb, text, integer, boolean) to authenticated, service_role;
grant execute on function public.admin_delete_category(uuid) to authenticated, service_role;
grant execute on function public.admin_move_category(uuid, text) to authenticated, service_role;
