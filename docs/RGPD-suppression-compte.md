# Suppression de compte RGPD — Procédure admin

Procédure manuelle exercée par un admin sur demande formelle du user
(courriel à contact@… ou message via `/contact`).

**⚠️ Non réversible. Suivre l'ordre strictement — l'inversion (suppression
avant anonymisation) laisse des PII orphelines de façon irrattrapable :
la cascade `auth.users` → `profiles` met `orders.user_id` à `NULL` avant
que la RPC n'ait tourné, la RPC ne retrouve plus aucune commande du user,
et les colonnes `billing_*` / `email` restent identifiantes dans la base.**

## Prérequis

- Accès Supabase Studio (SQL editor + onglet Auth) sur le projet CYNA.
- Accès dashboard Stripe (test mode ou live selon le compte à traiter).
- Copie de la demande RGPD du user, avec vérification d'identité si la
  demande arrive depuis une adresse tierce.

## Périmètre de l'effacement

Ce qui est effacé côté nous : les colonnes personnelles de `orders`
(`email`, `billing_*`) et de `contact_messages` (`name`, `email`,
`message`) du user cible, ainsi que la totalité de son compte auth
(profil, adresses, abonnements, cartes détachées).

Ce qui est **conservé côté nous** : les données strictement comptables
(numéro de commande, montants, dates, articles) — obligation de
conservation ~10 ans (article L.123-22 du Code de commerce, article 102
du Code général des impôts).

Ce qui est **conservé côté Stripe** : les factures identifiées originelles.
Stripe conserve ses invoices archivées avec l'identité complète du client
au titre de la même obligation comptable, indépendamment de notre
suppression du customer. C'est le comportement légal et documenté par
Stripe ; ce n'est pas une PII résiduelle chez nous.

## Étapes

### 1. Récupérer l'`uuid` du user

Supabase Studio → Authentication → rechercher par email → copier l'UUID
(colonne `id`). Vérifier que l'email correspond exactement à celui de la
demande RGPD.

### 2. Stripe — annuler les abonnements puis supprimer le customer

1. Dashboard Stripe → Customers → rechercher par email → ouvrir la fiche.
2. **Noter le `customer_id` (`cus_…`)** pour le journal RGPD (voir §6).
3. Onglet **Subscriptions** de la fiche customer : pour chaque abonnement
   avec statut ≠ `canceled`, cliquer **Cancel subscription** →
   **Cancel immediately**.
4. Une fois toutes les subscriptions passées à `canceled`, en haut à droite
   de la fiche customer, menu ⋯ → **Delete customer**. Confirmer
   (soft-delete Stripe, détache automatiquement toutes les payment methods).

### 3a. Anonymiser les données locales (RPC)

Dans Supabase Studio → SQL editor :

```sql
select public.anonymize_user_data('UUID-DU-USER');
```

**Vérifier le retour** :
- `≥ 1` → nombre de commandes anonymisées. Poursuivre.
- `0` → **STOP si le user avait passé des commandes**. Vérifier l'UUID.
  Retour `0` accepté uniquement si le user n'a jamais commandé (à
  confirmer par `select count(*) from public.orders where user_id = 'UUID';`
  **avant** toute manip).
- Erreur (`target_user is null` ou autre) → **STOP, ne pas continuer**.

### 3b. (Optionnel — pour preuve de démo) Smoke test facture

**Cette étape ne prouve pas l'anonymisation.** Elle vérifie uniquement que
la route locale `/api/account/orders/[id]/invoice` ne crashe pas sur les
tokens (`'Anonymise'`, `'—'`, `'deleted@anon.local'`). La route ne
compose rien à partir de `email`/`billing_*` : elle sélectionne l'UUID
de la commande, appelle Stripe, retourne le `hosted_invoice_url`. Le PDF
est rendu par Stripe et affiche l'identité originelle (archive Stripe).

Depuis la session encore active du user (**avant** l'étape 4), ouvrir
`/orders`, cliquer « Télécharger la facture » sur une commande anonymisée
à l'étape 3a. Vérifier :
- L'URL Stripe hosted s'ouvre proprement.
- Le PDF Stripe rend n° / montant / date / articles correctement.
- Aucune erreur applicative côté nous.

Le user connecté verra son nom affiché comme `Anonymise` sur `/orders`
pendant la fenêtre entre 3a et 4 — ne pas laisser le user connecté hors
du contrôle admin durant cet intervalle (~1 min).

### 4. Supprimer le compte auth (Studio, pas de SQL brut)

Supabase Studio → Authentication → Users → rechercher par UUID/email →
menu ⋯ → **Delete user**. Confirmer.

Cascade automatique :
- `public.profiles` : supprimé (FK CASCADE)
- `public.addresses` : supprimé via profiles
- `public.subscriptions` : supprimé via profiles
- `public.orders.user_id` : passé à `NULL` (FK SET NULL, factures
  conservées anonymisées grâce à l'étape 3a)
- `public.contact_messages.user_id` : passé à `NULL` (FK SET NULL,
  `name`/`email`/`message` déjà anonymisés grâce à l'étape 3a)

### 5. Vérifs finales

Dans SQL editor :

```sql
-- Doit renvoyer 0 : aucun order ne pointe encore vers cet UUID.
select count(*) from public.orders where user_id = 'UUID-DU-USER';

-- Doit renvoyer autant que le count retourné à l'étape 3a, toutes avec
-- email = 'deleted@anon.local' et billing_first_name = 'Anonymise'.
-- Le total_amount / order_number / created_at doivent correspondre au
-- snapshot pré-anonymisation.
select order_number, email, billing_first_name, total_amount, created_at
  from public.orders
 where email = 'deleted@anon.local'
   and billing_first_name = 'Anonymise'
 order by created_at desc
 limit 20;

-- Aucun profil ne doit rester avec cet UUID.
select count(*) from public.profiles where id = 'UUID-DU-USER';  -- 0 attendu
```

Vérifs manuelles :
- Dashboard Stripe : le customer est bien absent (statut `deleted`).
- Nouvelle inscription possible avec le même email (test rapide sur
  `/register`, puis supprimer le nouveau compte de test).

**La preuve du design = ces vérifs locales + le dashboard Stripe (customer
supprimé, factures identifiées conservées côté Stripe au titre comptable).**
L'étape 3b n'est qu'un smoke test applicatif.

### 6. Journalisation

Consigner dans le log interne (fichier ou wiki équipe) :
- Date + admin ayant exécuté.
- UUID + email traités.
- **`customer_id` Stripe supprimé** — pointeur d'audit vers les factures
  identifiées conservées chez Stripe (base légale : obligation comptable
  ~10 ans, article L.123-22 du Code de commerce). Ce n'est pas une PII
  résiduelle : c'est la traçabilité minimale nécessaire pour répondre à
  un contrôle fiscal sans dépendre d'une recherche en aveugle chez Stripe.
- Count d'orders anonymisées retourné par la RPC.
- Aucun autre détail identifiant (l'objet même de l'opération est
  d'effacer ces données).

## Test de démonstration complet

À exécuter en préproduction (test mode Stripe) pour valider la
procédure avant un premier passage en production.

1. Depuis un navigateur privé, `/register` avec `test-rgpd@example.com`.
2. Ajouter un produit au panier → checkout carte `4242 4242 4242 4242` →
   attendre webhook → vérifier `/orders` affiche la commande.
3. Snapshot SQL avant anonymisation :
   ```sql
   select id, user_id, order_number, email, billing_first_name,
          total_amount, created_at
     from public.orders
    where email = 'test-rgpd@example.com';
   ```
   Noter les valeurs — elles serviront de référence.
4. Runbook étapes 1 → 3a : récupérer UUID, canceler + delete customer
   Stripe, exécuter la RPC. Retour attendu ≥ 1.
5. **8a — smoke test** : depuis la session encore active du user, ouvrir
   `/orders`, cliquer « Télécharger la facture » sur la commande de
   l'étape 2. L'URL Stripe hosted s'ouvre, le PDF rend correctement.
   Prouve seulement que la route ne casse pas — ne prouve pas
   l'anonymisation.
6. Runbook étape 4 : delete user via Studio.
7. **8b — preuves du design** :
   - SQL : `user_id IS NULL`, `email = 'deleted@anon.local'`,
     `billing_first_name = 'Anonymise'`, `total_amount` / `order_number` /
     `created_at` identiques au snapshot de l'étape 3 ; `order_items.*`
     intacts.
   - Dashboard Stripe : customer absent (ou statut `deleted`), factures
     archivées conservées avec l'identité originelle.
8. Réinscription même email → session vide (nouvelle UID, RLS
   `auth.uid() = user_id` filtre les anciennes commandes maintenant à
   `user_id IS NULL`).
