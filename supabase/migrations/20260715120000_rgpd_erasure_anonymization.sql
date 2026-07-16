-- Lot RGPD — Droit à l'effacement par anonymisation.
-- Mirrors la dette flaggée dans 20260618130000_orders_addresses.sql:113-117.
--
-- Scope strict :
--   1) orders.user_id : FK CASCADE -> SET NULL (conserve la facture apres
--      suppression du user, obligation comptable ~10 ans).
--   2) RPC public.anonymize_user_data(uuid) : neutralise les colonnes PII
--      sur orders + contact_messages du user cible. Variante "token" —
--      aucun ALTER de contrainte NOT NULL.
--
-- La suppression du auth.users est manuelle (Studio -> Auth -> Delete),
-- procedure documentee dans docs/RGPD-suppression-compte.md. Le runbook
-- impose la verification du count retourne par cette RPC AVANT le delete
-- (piege d'ordre : cascade CASCADE->SET NULL mettrait user_id a NULL et
-- rendrait l'anonymisation ciblee impossible).
--
-- Non touche : addresses / profiles / subscriptions (cascade OK via
-- auth.users -> profiles), auth.* (chemin Studio), order_items (aucune PII,
-- product_name_snapshot deja fige au checkout).

-- ---------------------------------------------------------------------------
-- 1) orders.user_id — FK CASCADE -> SET NULL
--
-- Nom de contrainte confirme par pg_constraint : orders_user_id_fkey.
-- DROP + ADD car ALTER CONSTRAINT ne couvre pas le changement d'action
-- ON DELETE.
-- ---------------------------------------------------------------------------
alter table public.orders
  drop constraint orders_user_id_fkey;

alter table public.orders
  add constraint orders_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

comment on constraint orders_user_id_fkey on public.orders is
  'SET NULL et non CASCADE : la suppression du compte doit conserver la
   facture (obligation comptable ~10 ans) apres anonymisation via la RPC
   public.anonymize_user_data.';

-- ---------------------------------------------------------------------------
-- 2) RPC anonymize_user_data(target_user uuid) returns integer
--
-- SECURITY DEFINER + search_path='' : conforme au pattern des autres RPCs
-- du projet (is_admin, place_order_for_user, admin_dashboard_*).
--
-- Variante "token" : les 6 colonnes billing_* NOT NULL recoivent
-- 'Anonymise' / '—'. email (NOT NULL) recoit 'deleted@anon.local'. Les
-- colonnes billing_* nullable passent a NULL. Aucun ALTER de contrainte.
--
-- Refuse target_user NULL : evite qu'un appelant maladroit anonymise
-- silencieusement les orders deja orphelines (user_id IS NULL).
--
-- Retourne le count d'orders anonymisees : le runbook impose de verifier
-- ce retour >= 1 (ou = 0 documente) AVANT de supprimer le auth.users.
-- Le row_count est capture immediatement apres l'UPDATE orders car
-- GET DIAGNOSTICS s'applique a la DERNIERE DML — l'UPDATE contact_messages
-- qui suit ecraserait le compteur sinon.
-- ---------------------------------------------------------------------------
create or replace function public.anonymize_user_data(target_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  anonymized_orders integer;
begin
  if target_user is null then
    raise exception 'anonymize_user_data: target_user is null';
  end if;

  update public.orders
     set email               = 'deleted@anon.local',
         billing_first_name  = 'Anonymise',
         billing_last_name   = 'Anonymise',
         billing_line1       = '—',
         billing_line2       = null,
         billing_city        = '—',
         billing_region      = null,
         billing_postal_code = '—',
         billing_country     = '—',
         billing_phone       = null,
         billing_label       = null
   where user_id = target_user;

  get diagnostics anonymized_orders = row_count;

  update public.contact_messages
     set name    = 'Anonymise',
         email   = 'deleted@anon.local',
         message = '[supprime]'
   where user_id = target_user;

  return anonymized_orders;
end;
$$;

comment on function public.anonymize_user_data(uuid) is
  'Droit a l''effacement RGPD : neutralise les PII sur orders (billing_*,
   email — tokens pour respecter les NOT NULL existants) et contact_messages
   (name, email, message) du user cible. NE SUPPRIME PAS auth.users
   (chemin Studio manuel, voir docs/RGPD-suppression-compte.md). Retourne
   le count d''orders anonymisees, pour verification cote runbook.';

-- ---------------------------------------------------------------------------
-- Grants : service_role uniquement. Aucune exposition client, jamais.
-- ---------------------------------------------------------------------------
revoke execute on function public.anonymize_user_data(uuid) from anon, authenticated, public;
grant  execute on function public.anonymize_user_data(uuid) to service_role;
