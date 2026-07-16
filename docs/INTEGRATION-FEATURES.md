# Intégration des features — état & plan

Document d'état des lieux basé sur l'inspection réelle du dépôt Git.
Aucune branche n'a été modifiée ni mergée dans le cadre de ce document.

- **Date** : 2026-07-04
- **Branche courante** : `main`
- **Tip de `main`** : `e2bf118 docs+tools: update CLAUDE.md for i18n LOT 1…`
- **Remote poussé** : `origin/main` (fork `ilaneMI/CYNA-projet-de-fin-d-annee`). `upstream/main` (repo école) NON touché.

## Méthodologie

L'inventaire a été produit à partir de :

- `git branch -a` — liste des branches locales et distantes
- `git rev-list --count main..<branche>` et `main..<branche>` — mesure d'écart
- `git log --oneline main..<branche>` — commits uniques à chaque branche
- `git show --stat <sha>` — contenu réel de chaque commit candidat
- Inspection du working tree pour vérifier ce qui est présent sur `main`
- Liste des migrations sur `main` (`supabase/migrations/`)

Aucune donnée n'a été reconstruite de mémoire. Toute affirmation « déjà sur main » a été vérifiée par lecture du fichier ou du log Git.

---

## Résumé exécutif

**Tout ce qui a été validé en recette est déjà sur `main`** (poussé sur `origin/main` le 2026-07-04, 4 commits ajoutés au-dessus des 10 commits admin déjà présents).

Trois branches locales portent encore du contenu non intégré à `main` :

| Branche | Commits en +main | Statut |
|---|---|---|
| `docs/user-stories` | +1 | Contenu neuf et utile (backlog user stories) — **à cherry-pick** |
| `feat/fix-recette-1` | +4 | Correctifs de recette anciens — **analyse par commit requise** (2 probablement obsolètes, 1 déjà résolu autrement, 1 à intégrer) |
| `test/integration-with-supabase` | +1 (merge) | **Obsolète** — merge commit d'une ancienne intégration Supabase, contenu déjà absorbé par `main` |

Les **16 autres branches locales** (`feat/nextjs-migration`, `feat/page-*`, `feat/supabase-*`, `local/integration-all-pages`, `test/integration-supabase`) sont **0 commit devant `main`** — entièrement absorbées lors du push d'aujourd'hui.

---

## Partie 1 — Inventaire des features

Chaque feature est listée avec ses fichiers principaux, la branche d'origine si elle existe encore, et son statut d'intégration.

### Backend & base de données (schéma + RPCs)

| Feature | Fichiers/migrations principaux | Branche d'origine | Statut | Migration ? |
|---|---|---|---|---|
| Schéma catalogue (products, categories, prices) | `supabase/migrations/20260617120000_data_schema.sql`, `src/lib/data/{products,categories,carousel}.ts` | absorbée depuis `feat/supabase-data` | ✅ main | oui |
| Auth profiles + lock anon | `supabase/migrations/20260617130000_auth_profiles.sql`, `..._auth_profiles_lock_anon.sql` | absorbée depuis `feat/supabase-auth` | ✅ main | oui |
| Orders + addresses | `supabase/migrations/20260618130000_orders_addresses.sql`, `src/lib/data/{orders,addresses}.ts` | main | ✅ main | oui |
| Stripe schema + subscriptions + invoices | `supabase/migrations/20260619100000_stripe_schema.sql`, `..._stripe_rpcs_revoke_*.sql`, `..._revoke_place_order_from_authenticated.sql` | main | ✅ main | oui |
| Admin dashboard RPCs (aggregates SECURITY DEFINER) | `supabase/migrations/20260619210000_admin_dashboard_rpcs.sql`, `src/features/admin/DashboardSection.tsx`, `SalesBarChart.tsx` | main | ✅ main | oui |
| `set_updated_at` search_path lock | `supabase/migrations/20260619220000_set_updated_at_search_path.sql` | main | ✅ main | oui |
| Admin product RPCs (CRUD via admin_*) + admin_read policy | `supabase/migrations/20260619230000_admin_product_rpcs.sql`, `..._products_admin_read.sql`, `..._admin_create_product.sql`, `src/app/api/admin/products/**` | main | ✅ main | oui |
| Trigger fn execute revoke | `supabase/migrations/20260621120000_revoke_trigger_fn_execute.sql` | main | ✅ main | oui |
| Contact messages (table + trigger + CHECK) | `supabase/migrations/20260627120000_contact_messages.sql`, `src/app/api/contact/route.ts` | main | ✅ main | oui |
| Orders : stripe_invoice_id (facture) | `supabase/migrations/20260627150000_orders_stripe_invoice_id.sql`, `src/app/api/account/orders/[id]/invoice/route.ts` | main | ✅ main | oui |
| Admin carousel + categories RPCs + admin_read | `supabase/migrations/20260627180000_admin_carousel_categories_rpcs.sql`, `..._carousel_categories_admin_read.sql`, `src/app/api/admin/{carousel-slides,categories,home-content}/**` | main | ✅ main | oui |
| Orders confirmation email trigger | `supabase/migrations/20260628120000_orders_confirmation_email.sql`, `src/lib/email/resend.ts` | main | ✅ main | oui |

### Front-office (client)

| Feature | Fichiers principaux | Branche d'origine | Statut |
|---|---|---|---|
| Migration Next.js 14 App Router | `src/app/**`, `next.config.mjs`, `tsconfig.json` | absorbée depuis `feat/nextjs-migration` | ✅ main |
| Page d'accueil (hero carousel + featured products + editorial) | `src/app/[locale]/page.tsx`, `src/features/admin/HomeContentAdminSection.tsx`, `src/lib/data/{carousel,homeContent}.ts` | absorbée depuis `feat/page-cart` (indirectement) | ✅ main |
| Catalogue + filtres + Postgres FTS `search_fr` | `src/app/[locale]/catalogue/**`, `src/lib/data/products.ts` | absorbée depuis `feat/page-search` | ✅ main |
| Recherche `/search` avec query params | `src/app/[locale]/search/**` | absorbée depuis `feat/page-search` | ✅ main |
| Fiche produit + carousel images + purchase | `src/app/[locale]/product/[id]/**` | absorbée depuis `feat/page-product` | ✅ main |
| Fiche catégorie | `src/app/[locale]/category/[id]/page.tsx` | absorbée depuis `feat/page-category` | ✅ main |
| Panier + persistance localStorage namespacée par user id | `src/app/[locale]/cart/**`, `src/context/CartContext.tsx` | absorbée depuis `feat/page-cart` | ✅ main |
| Checkout (StepIndicator + Billing + Payment + redirect Stripe) | `src/app/[locale]/checkout/page.tsx`, `src/features/checkout/**` | absorbée depuis `feat/page-checkout` | ✅ main |
| Checkout success (poll orders 10× après Stripe, clear cart) | `src/app/[locale]/checkout/success/**`, `src/app/api/webhooks/stripe/route.ts` | main | ✅ main |
| Login + register + forgot-password + reset-password | `src/app/[locale]/{login,register,forgot-password,reset-password}/**`, `src/features/auth/**`, `src/context/AuthContext.tsx` | absorbée depuis `feat/page-login`, `feat/page-register`, `feat/supabase-auth` | ✅ main |
| Historique commandes + filtres + facture download | `src/app/[locale]/orders/**`, `src/features/orders/**`, `src/app/api/account/orders/[id]/invoice/route.ts` | absorbée depuis `feat/page-orders` | ✅ main |
| Contact (formulaire + validation + POST /api/contact) | `src/features/contact/{ContactForm,validation,types}.ts(x)`, `src/app/api/contact/route.ts`, `src/app/[locale]/tools/page.tsx` | absorbée depuis `feat/page-tools` | ✅ main |
| Chatbot shell (FAQ matching + escalation) | `src/features/contact/ChatbotShell.tsx`, `src/components/ChatbotWidget.tsx`, `src/lib/faq-matcher.ts`, `src/data/faq.ts` | absorbée depuis `feat/page-tools` | ✅ main |
| Pages légales (mentions, cgu, confidentialite, à-propos) | `src/app/[locale]/{mentions-legales,cgu,confidentialite,a-propos}/page.tsx` | main | ✅ main (corps FR, H1/labels traduits) |

### Back-office (admin)

| Feature | Fichiers principaux | Branche d'origine | Statut |
|---|---|---|---|
| Layout `/admin` + `AdminView` shell | `src/app/[locale]/admin/**` | absorbée depuis `feat/page-admin` | ✅ main |
| Dashboard (KPI + graphes bar/pie via RPCs SECURITY DEFINER) | `src/features/admin/{DashboardSection,SalesBarChart,CategoryBasketChart,CategoryPieChart,adminStats}.tsx` | main | ✅ main |
| Produits CRUD (create/edit/soft-delete/reactivate) + ISR `revalidatePath('/')` | `src/features/admin/{ProductsAdminSection,CreateProductForm}.tsx`, `src/app/api/admin/products/**` | main | ✅ main |
| Filtres Tous / Actifs / Désactivés | `src/features/admin/ProductsAdminSection.tsx` | main | ✅ main |
| Édition prix (mensuel / annuel / per_user) | `src/app/api/admin/prices/[id]/route.ts`, `src/features/admin/ProductsAdminSection.tsx` | main | ✅ main |
| Commandes admin (liste + détail) | `src/features/admin/OrdersAdminSection.tsx` | main | ✅ main |
| Catégories (create/edit/reorder + protection orphelins) | `src/features/admin/CategoriesAdminSection.tsx`, `src/app/api/admin/categories/**` | main | ✅ main |
| Carrousel (create/edit/reorder/désactivation/suppression) | `src/features/admin/CarouselAdminSection.tsx`, `src/app/api/admin/carousel-slides/**` | main | ✅ main |
| Home content (bilingue jsonb `body`) | `src/features/admin/HomeContentAdminSection.tsx`, `src/app/api/admin/home-content/**`, `src/lib/data/homeContent.ts` | main | ✅ main |
| Messages contact admin (lecture + change statut) | `src/features/admin/MessagesAdminSection.tsx` | main | ✅ main |
| Promotions / codes promo | `src/features/admin/PromotionsAdminSection.tsx`, `src/app/api/admin/promotions/**` | main | ✅ main |
| Audit log (`admin_audit_log` + section BO) | `src/features/admin/AuditLogAdminSection.tsx`, `src/lib/admin/audit-log.ts` | main | ✅ main |
| Alertes rupture stock | `src/lib/admin/rupture-alert.ts`, `src/lib/data/rupture.ts` | main | ✅ main |

### Compte utilisateur

| Feature | Fichiers principaux | Branche d'origine | Statut |
|---|---|---|---|
| Vue `/my-account` + sections | `src/app/[locale]/my-account/**` | absorbée depuis `feat/page-myaccount` | ✅ main |
| Infos personnelles + changement mot de passe | `src/features/account/PersonalInfoSection.tsx` | main | ✅ main |
| Carnet d'adresses (CRUD + set default + ConfirmDialog) | `src/features/account/AddressBookSection.tsx`, `src/lib/data/addresses.ts` | main | ✅ main |
| Méthodes de paiement Stripe (SetupIntent + set default + isolation cross-user) | `src/features/account/{PaymentMethodsSection,AddCardForm}.tsx`, `src/app/api/account/payment-methods/**`, `src/lib/stripe-{browser,customer}.ts` | main | ✅ main |
| Abonnements (cancel/reactivate + réconciliation webhook) | `src/features/account/SubscriptionsSection.tsx`, `src/app/api/account/subscriptions/**` | main | ✅ main |
| 2FA TOTP (enroll/verify/disable + step-up) | `src/features/account/TwoFactorSection.tsx` | main | ✅ main |

### Sécurité

| Feature | Fichiers principaux | Branche d'origine | Statut |
|---|---|---|---|
| Middleware AAL2 F2 (redirect si non-admin ou non-AAL2) | `src/middleware.ts` | main | ✅ main |
| Guard AAL2 côté API (`require-aal2.ts`) sur 15 routes admin | `src/lib/admin/require-aal2.ts`, `src/app/api/admin/**` | main | ✅ main |
| RLS Supabase sur toutes les tables | `supabase/migrations/**` | main | ✅ main |
| Cookie consent RGPD + Plausible opt-in | `src/components/{CookieConsent,Analytics}.tsx` | main | ✅ main |
| CSP + headers de sécurité (HSTS, X-Frame, etc.) | `next.config.mjs` | main | ✅ main |
| Dette F3 (is_admin AAL2-aware côté DB) | non implémenté | — | ⚠️ dette assumée, documentée dans `CLAUDE.md` |

### Intégrations tierces

| Feature | Fichiers principaux | Branche d'origine | Statut |
|---|---|---|---|
| Stripe Checkout (mode subscription) | `src/app/api/checkout/session/route.ts`, `src/features/checkout/CheckoutFlow.tsx`, `src/lib/stripe-server.ts` | main | ✅ main |
| Stripe webhooks (signés) — `checkout.session.completed`, `customer.subscription.updated`, etc. | `src/app/api/webhooks/stripe/route.ts` | main | ✅ main |
| Stripe hosted invoices (facture download) | `src/app/api/account/orders/[id]/invoice/route.ts` | main | ✅ main |
| Stripe Elements côté navigateur (SetupIntent, PaymentElement) | `src/lib/stripe-browser.ts`, `src/features/account/AddCardForm.tsx` | main | ✅ main |
| Emails (Resend) — confirmation commande | `src/lib/email/resend.ts` | main | ✅ main (préparé pour ticket 39) |
| Plausible Analytics (RGPD-compliant, opt-in) | `src/components/Analytics.tsx`, `src/components/CookieConsent.tsx` | main | ✅ main |

### i18n

| Feature | Fichiers principaux | Branche d'origine | Statut |
|---|---|---|---|
| Infrastructure next-intl (routing/request/navigation, plugin Next config) | `src/i18n/**`, `next.config.mjs`, `src/app/[locale]/layout.tsx` | main | ✅ main |
| Middleware composé i18n + AAL2 | `src/middleware.ts` | main | ✅ main |
| Sélecteur de langue (Header) + cookie NEXT_LOCALE | `src/components/{LanguageSwitcher,Header}.tsx` | main | ✅ main |
| Messages FR/EN miroir (648 clés) | `messages/{fr,en}.json` | main | ✅ main |
| Data layer locale-aware (jsonb `{fr,en}` + fallback FR) | `src/lib/data/{products,categories,carousel,homeContent}.ts` | main | ✅ main |
| Composants wired i18n (nav, cart, checkout, orders, account, admin, contact, légal) | ~30 fichiers `src/{app,components,features}/**` | main | ✅ main |
| Validation → clés i18n | `src/features/{checkout,contact}/validation.ts`, `src/features/account/AddressBookSection.tsx` | main | ✅ main |
| **Toasts contexte AuthContext/CartContext** | `src/context/{AuthContext,CartContext}.tsx` | main | ⚠️ non i18n — AuthContext toasts hardcodés en FR, CartContext hardcodés en EN. Voir Partie 3 (ANO-03). |

### Docs

| Feature | Fichiers principaux | Branche d'origine | Statut |
|---|---|---|---|
| CLAUDE.md (charte projet + recette) | `CLAUDE.md` | main | ✅ main |
| DCT + OpenAPI + notes paiement locaux | `docs/DCT.md`, `docs/openapi.yaml`, `docs/PAIEMENTS-LOCAUX-PAYPAL.md` | main | ✅ main |
| Modèle de données physique | `modele-donnees-CYNA.md` | main | ✅ main |
| **User stories (63 stories, 6 epics)** | `docs/user-stories/**` | `docs/user-stories` | ❌ **PAS sur main** — à cherry-pick |
| Scripts de test d'intégration | `tools/test-*.mjs` | main | ✅ main |

---

## Partie 2 — État des branches

Colonne « conflits potentiels » établie par intersection des fichiers modifiés sur la branche avec ceux modifiés sur `main` depuis le point de divergence.

| Branche | Commits en +main | Contenu | Mergée dans main ? | Conflits potentiels |
|---|---|---|---|---|
| `main` | — | tip actuel | — | — |
| `test/integration-supabase` | 0 | tip d'où viennent les 4 commits du push d'aujourd'hui | ✅ oui (identique à main) | aucun |
| `feat/nextjs-migration` | 0 | migration Next.js 14 App Router | ✅ absorbée | aucun |
| `feat/page-admin` | 0 | scaffolding /admin | ✅ absorbée | aucun |
| `feat/page-cart` | 0 | scaffolding /cart | ✅ absorbée | aucun |
| `feat/page-category` | 0 | scaffolding /category | ✅ absorbée | aucun |
| `feat/page-checkout` | 0 | scaffolding /checkout | ✅ absorbée | aucun |
| `feat/page-login` | 0 | scaffolding /login | ✅ absorbée | aucun |
| `feat/page-myaccount` | 0 | scaffolding /my-account | ✅ absorbée | aucun |
| `feat/page-orders` | 0 | scaffolding /orders | ✅ absorbée | aucun |
| `feat/page-product` | 0 | scaffolding /product/[id] | ✅ absorbée | aucun |
| `feat/page-register` | 0 | scaffolding /register | ✅ absorbée | aucun |
| `feat/page-search` | 0 | scaffolding /search | ✅ absorbée | aucun |
| `feat/page-tools` | 0 | scaffolding /tools (contact) | ✅ absorbée | aucun |
| `feat/supabase-auth` | 0 | intégration Supabase Auth | ✅ absorbée | aucun |
| `feat/supabase-data` | 0 | intégration Supabase catalogue | ✅ absorbée | aucun |
| `local/integration-all-pages` | 0 | ancienne branche d'intégration | ✅ absorbée | aucun |
| `docs/user-stories` | +1 | 1 commit : ajout `docs/user-stories/*.md` (backlog 63 stories, 6 epics) | ❌ non | Aucun — le commit ne touche QUE des fichiers neufs sous `docs/user-stories/` |
| `feat/fix-recette-1` | +4 | 4 commits fix ANO-01 à ANO-04 (voir Partie 3) | ❌ non | Élevés — la branche a divergé début juin, avant tout le lot Supabase + i18n. Les fichiers concernés (`Step3Payment.tsx`, `ContactForm.tsx`, `AuthContext.tsx`, `CartContext.tsx`) ont été **réécrits** depuis. Cherry-pick nécessitera résolution manuelle. |
| `test/integration-with-supabase` | +1 (merge) | 1 merge commit `24c211c` de `feat/supabase-data` sur une ancienne intégration | ❌ non | **Obsolète** — le contenu de ce merge a déjà été absorbé par des chemins plus récents (`feat/supabase-data` est lui-même à 0 devant main). Aucune valeur ajoutée à intégrer. |

**Branches remote non-listées ici** : `origin/feat/page-*`, `origin/docs/user-stories`, `origin/feat/nextjs-migration` → mêmes contenus que leurs équivalents locaux. Côté `upstream/*` : hors périmètre (repo école, push désactivé).

---

## Partie 3 — Plan d'intégration

### Résumé

- **1 branche à cherry-pick** : `docs/user-stories` (sans risque)
- **1 branche à analyser commit par commit** : `feat/fix-recette-1` (2 fixes probablement obsolètes, 1 déjà résolu autrement, 1 à réintégrer)
- **1 branche à archiver/supprimer** : `test/integration-with-supabase`

### 1. `docs/user-stories` — cherry-pick direct

**Commit unique** : `7edfeb4 docs(user-stories): add product backlog in docs/user-stories`

**Contenu ajouté** :
```
docs/user-stories/01-catalogue-and-discovery.md
docs/user-stories/02-cart-and-checkout.md
docs/user-stories/03-account-and-orders.md
docs/user-stories/04-admin.md
docs/user-stories/05-support-and-tools.md
docs/user-stories/06-cross-cutting.md
docs/user-stories/README.md
```

**Conflits** : aucun. Ces fichiers n'existent pas sur `main`.

**Migration DB associée** : aucune.

**Commande** :
```bash
git checkout main
git cherry-pick 7edfeb4
git push origin main
```

**Re-test après merge** : aucun (pure docs).

### 2. `feat/fix-recette-1` — analyse par commit

Les 4 commits ont été faits le **2026-06-16** — donc **AVANT** le lot Supabase + Stripe + i18n de main. Les fichiers ciblés ont été profondément réécrits depuis. Analyse commit par commit :

#### `aa0337b fix(checkout): make payment confirmation handler synchronous` — ANO-01

- **Problème d'origine** : `Step3Payment.handleConfirm` était `async` avec `await new Promise(setTimeout)` + setState après → transitions manquantes.
- **État actuel sur main** : `src/features/checkout/Step3Payment.tsx` est réécrit. Le `setTimeout(1200)` existe encore mais `onConfirmed()` ne déclenche plus 5 setState en cascade — `CheckoutFlow` gère la redirection Stripe via `window.location.assign(payload.url)`, aucune transition d'étape locale.
- **Verdict** : **probablement OBSOLÈTE**. Le bug spécifique (batching React 18 sur setState post-await dans le contexte SPA) ne peut plus se produire. À vérifier par un test manuel CHK-01 confirmé plusieurs fois en recette.
- **Action recommandée** : **ne pas cherry-pick**. Le fix ne s'applique pas mécaniquement au code actuel.

#### `81e1890 fix(contact): make contact form submit handler synchronous` — ANO-02

- **Problème d'origine** : `ContactForm.handleSubmit` avait `await new Promise(setTimeout)` + 5 setState après.
- **État actuel sur main** : `src/features/contact/ContactForm.tsx` est réécrit i18n. **Il n'y a plus aucun `setTimeout`** dans ce fichier — le submit fait un `fetch('/api/contact', ...)` direct.
- **Verdict** : **OBSOLÈTE**. Le pattern buggé n'existe plus.
- **Action recommandée** : **ne pas cherry-pick**.

#### `cbdd3bc fix(i18n): translate hardcoded toast strings in Auth and Cart contexts` — ANO-03

- **Problème d'origine** : `AuthContext` et `CartContext` avaient des toasts en dur **en anglais** dans une UI FR-only.
- **État actuel sur main** :
  - `AuthContext.tsx` → toasts hardcodés **en français** (`"Bon retour !"`, `"Échec de l'inscription"`, `"Déconnecté"`, …). Le fix EN→FR a manifestement été refait au fil de l'eau.
  - `CartContext.tsx` → toasts hardcodés **en anglais** (`"Cart updated"`, `"Added to cart"`). **Le bug d'origine EST TOUJOURS présent sur ce fichier.**
- **Verdict** : le commit tel quel ne s'appliquera pas proprement (AuthContext a divergé), mais la partie CartContext du fix est encore utile. **Cependant, la vraie correction dans le contexte i18n LOT 1 n'est pas « traduire EN → FR » mais « passer par `useTranslations` »** — puisque le site est maintenant bilingue FR/EN, coller du FR en dur reste bugué côté EN.
- **Action recommandée** : **NE PAS cherry-pick tel quel**. Traiter comme une petite finition i18n séparée : wire `AuthContext` et `CartContext` sur `useTranslations` + ajouter un namespace `auth.toasts.*` et `cart.toasts.*` dans `messages/{fr,en}.json`. Petit effort (<30 min).

#### `5221a19 feat(404): add custom French not-found page` — ANO-04

- **Problème d'origine** : Next.js servait sa page 404 anglaise par défaut, incohérente avec l'UI FR.
- **État actuel sur main** : `src/app/not-found.tsx` **n'existe pas**. Le bug est présent.
- **Verdict** : **fix pertinent et non résolu ailleurs**.
- **Action recommandée** : **cherry-pick** (ou re-écrire proprement pour supporter l'i18n FR/EN et vivre sous `src/app/[locale]/not-found.tsx` pour bénéficier du layout locale-aware).

**Décision suggérée pour `feat/fix-recette-1`** :

1. Cherry-pick `5221a19` (page 404) puis adapter la version pour la déplacer sous `[locale]/not-found.tsx` et remplacer les strings dur en `useTranslations`.
2. Ne PAS cherry-pick `aa0337b`, `81e1890`, `cbdd3bc`.
3. Ouvrir un mini-ticket « i18n toasts AuthContext + CartContext » à traiter dans le lot Polish (ou en même temps que le correctif optionnel `success_url` mentionné dans CLAUDE.md).
4. Après intégration : supprimer la branche `feat/fix-recette-1` pour éviter la confusion.

### 3. `test/integration-with-supabase` — obsolète

Le commit `24c211c` est un merge de `feat/supabase-data` (elle-même à 0 devant `main`) dans une ancienne intégration. Le contenu apporté est **déjà** dans `main` par des chemins plus récents.

**Action recommandée** : **supprimer la branche locale** après validation. Rien à cherry-pick.

```bash
# Après vérification par toi
git branch -D test/integration-with-supabase
```

### Ordre de merge recommandé

Séquence sûre :

1. `git cherry-pick 7edfeb4` (docs/user-stories) — zéro risque, zéro migration.
2. `git cherry-pick 5221a19` puis adapter pour i18n (page 404) — front only, aucune migration.
3. (**optionnel**) mini-lot i18n toasts AuthContext + CartContext — non bloquant, hors périmètre initial.
4. Nettoyer les branches obsolètes : `feat/fix-recette-1`, `test/integration-with-supabase`, et si tu veux, les 16 branches à 0 commit d'écart (elles ne servent plus à rien).

### Points de vigilance

- **Migrations DB** : aucune des branches candidates ne touche à `supabase/migrations/` → **aucun risque de désordre migratoire**. Toutes les migrations utiles sont déjà sur `main`.
- **Gate F2/AAL2** : les 3 branches n'impactent PAS `src/middleware.ts` ni `src/lib/admin/require-aal2.ts`. Non-régression garantie.
- **Checkout 4242** : les commits `aa0337b` (Step3Payment) et le futur wire i18n `AuthContext/CartContext` touchent des zones critiques du checkout. **Ne pas cherry-pick sans re-jouer CHK-01 en FR ET en EN** derrière.
- **Parité JSON i18n** : si un ajout de namespace `auth.toasts.*` ou `cart.toasts.*` est fait, vérifier la parité FR/EN par le script :
  ```bash
  node -e "const fr=require('./messages/fr.json'), en=require('./messages/en.json'); …"
  ```
  (script utilisé en fin de chaque bloc du lot i18n, dispo dans les rapports).
- **CLAUDE.md** : après intégration de la page 404 et des toasts i18n, ajouter une ligne dans la section « ✅ Validé » de la recette pour tracer.

### Re-tests suggérés après chaque merge

| Étape | Re-tests |
|---|---|
| Après `docs/user-stories` cherry-pick | Aucun (pure docs). |
| Après cherry-pick page 404 | `/n-existe-pas` en FR ET en EN → vérifier la page custom, pas la 404 native anglaise de Next. |
| Après wire i18n `AuthContext`/`CartContext` (si fait) | Login FR + EN (`AUTH-04`), ajout au panier FR + EN (`PAN-01`), checkout 4242 FR + EN (`CHK-01`). |

---

## Annexe — commandes de vérification

```bash
# état des branches vs main
for b in $(git branch --list --format='%(refname:short)' | grep -v '^main$'); do
  ahead=$(git rev-list --count main..$b 2>/dev/null)
  behind=$(git rev-list --count $b..main 2>/dev/null)
  echo "$b : +$ahead / -$behind"
done

# contenu unique d'une branche
git log --oneline main..<branche>

# diff d'un commit précis
git show --stat <sha>

# parité messages FR/EN
node -e "const fr=require('./messages/fr.json'),en=require('./messages/en.json');function k(o,p=''){const r=[];for(const x of Object.keys(o))o[x]&&typeof o[x]==='object'&&!Array.isArray(o[x])?r.push(...k(o[x],p?p+'.'+x:x)):r.push(p?p+'.'+x:x);return r}const F=new Set(k(fr)),E=new Set(k(en));console.log('FR:',F.size,'EN:',E.size);const onlyF=[...F].filter(x=>!E.has(x)),onlyE=[...E].filter(x=>!F.has(x));if(onlyF.length)console.log('Only FR:',onlyF);if(onlyE.length)console.log('Only EN:',onlyE);if(!onlyF.length&&!onlyE.length)console.log('PARITY: OK')"
```
