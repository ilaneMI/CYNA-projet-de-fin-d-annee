-- Hygiène lint 0028 / 0029 : retirer EXECUTE sur deux fonctions
-- trigger qui ne sont jamais appelées en RPC. Réduit le bruit du
-- linter sans aucun effet sur les triggers existants.
--
-- Pourquoi c'est SANS RISQUE pour les triggers :
--   Quand Postgres exécute un trigger, il appelle la fonction
--   par OID sans consulter le privilège EXECUTE du caller (la
--   doc PG « CREATE TRIGGER » : les privilege checks sur la fn
--   trigger se font à la CRÉATION du trigger, pas à chaque fire).
--   De plus ces deux fns sont SECURITY DEFINER → elles tournent
--   avec les droits du owner (postgres), indépendamment du
--   caller. Vérifié manuellement (pg_trigger) :
--     on_auth_user_created     auth.users     → handle_new_user()                  (enabled)
--     addresses_enforce_default public.addresses → enforce_single_default_address() (enabled)
--
-- Pourquoi le grant n'avait pas lieu d'être :
--   - handle_new_user()                  insert dans public.profiles à partir d'un
--                                        row auth.users (`new.id`) — appel hors
--                                        contexte trigger = `new` NULL = erreur.
--   - enforce_single_default_address()   `if new.is_default …` — idem.
--   Aucun usage RPC légitime.
--
-- IMPORTANT : on doit revoke depuis PUBLIC en plus de anon/authenticated.
-- L'ACL actuelle contient `=X/postgres` (grant à PUBLIC) en plus des
-- grants explicites par rôle. Sans `from public`, anon et authenticated
-- gardent EXECUTE via leur appartenance à PUBLIC.
--
-- rls_auto_enable() N'EST PAS TOUCHÉE — voir analyse séparée : fn
-- de plateforme Supabase (owner=postgres), event-trigger fn non
-- appelable via PostgREST, branchée sur l'event trigger `ensure_rls`
-- qui auto-active RLS sur tout CREATE TABLE dans public. Faux
-- positif du linter + garde-fou utile.

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

revoke execute on function public.enforce_single_default_address()
  from public, anon, authenticated;
