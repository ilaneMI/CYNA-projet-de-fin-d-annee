# Épopée 6 — Transverse

Stories qui ne se rattachent pas à une fonctionnalité métier précise mais
qui conditionnent la qualité, la sécurité et la conformité du produit
livré.

---

### US-XC-001 — Sécuriser toutes les tables Postgres avec RLS

**Persona :** Tech (interne)
**Priorité :** Must
**Estimation :** 5
**Statut :** À faire

**Story :**
En tant qu'équipe tech, je veux que **toutes** les tables Supabase aient
des politiques RLS strictes, afin qu'une faille applicative ne suffise pas
pour qu'un utilisateur lise les données d'un autre.

**Critères d'acceptation :**
- [ ] Aucune table accessible sans politique explicite.
- [ ] Politique par défaut : `auth.uid() = user_id` pour les tables user-scoped.
- [ ] Politiques admin : `auth.jwt() ->> 'role' = 'admin'`.
- [ ] Test d'intrusion : un autre user authentifié ne lit JAMAIS les données d'autrui.
- [ ] Tests automatisés des règles dans CI.

---

### US-XC-002 — Atteindre WCAG 2.1 AA sur les parcours principaux

**Persona :** Visiteur en situation de handicap
**Priorité :** Must
**Estimation :** 8

**Story :**
En tant qu'utilisateur en situation de handicap (déficience visuelle,
motrice, cognitive), je veux pouvoir effectuer un parcours d'achat complet
au clavier et avec un lecteur d'écran, afin d'accéder au service sans
barrière.

**Critères d'acceptation :**
- [ ] Audit Axe / Lighthouse sans erreur critique sur les pages clés.
- [ ] Navigation clavier complète : tab order logique, focus visible.
- [ ] Tous les composants custom ont `aria-*` corrects.
- [ ] Contrastes vérifiés sur la palette dark et light.
- [ ] Sous-titres et alternatives texte pour les contenus multimédias.

---

### US-XC-003 — Internationaliser FR / EN / AR / HE

**Persona :** Client international
**Priorité :** Must
**Estimation :** 8

**Story :**
En tant que client francophone, anglophone, arabophone ou hébraïque, je
veux pouvoir utiliser le site dans ma langue, avec mise en page RTL pour
l'arabe et l'hébreu, afin de comprendre l'offre sans friction.

**Critères d'acceptation :**
- [ ] Sélecteur de langue dans le header, persistant en cookie.
- [ ] Strings extraites via `next-intl` ou `react-i18next`.
- [ ] FR par défaut, EN obligatoire, AR + HE à la mise en RTL.
- [ ] `dir="rtl"` appliqué au layout pour AR / HE.
- [ ] Le back-office peut rester en anglais (équipe interne).

---

### US-XC-004 — Charger les pages catalogue en moins de 1,5 s

**Persona :** Visiteur mobile
**Priorité :** Must
**Estimation :** 5

**Story :**
En tant que visiteur sur un réseau 4G moyen, je veux que la page catalogue
charge son premier contenu visible en moins de 1,5 s (LCP), afin de ne pas
quitter par impatience.

**Critères d'acceptation :**
- [ ] LCP < 1,5 s sur 75e percentile mobile (CrUX).
- [ ] Images via `next/image` (responsive, WebP/AVIF, lazy).
- [ ] RSC côté serveur, pas de fetch client redondant pour la liste de produits.
- [ ] Bundle JS initial < 100 kB gzippé sur le catalogue.

---

### US-XC-005 — Indexer les pages publiques dans Google

**Persona :** Visiteur arrivant par recherche
**Priorité :** Must
**Estimation :** 3

**Story :**
En tant que visiteur qui découvre Cyna via Google, je veux trouver les
fiches produit et les catégories dans les résultats, afin d'arriver
directement sur la page pertinente.

**Critères d'acceptation :**
- [ ] Toutes les pages publiques exportent `metadata` complète.
- [ ] Sitemap XML généré automatiquement.
- [ ] Données structurées JSON-LD (`Product`, `Organization`, `BreadcrumbList`).
- [ ] Pages user-scoped (`/cart`, `/checkout`, `/my-account`...) : `robots: noindex`.

---

### US-XC-006 — Empêcher les vulnérabilités OWASP top 10

**Persona :** Tech (interne)
**Priorité :** Must
**Estimation :** 5

**Story :**
En tant qu'équipe tech, je veux que la base de code soit immunisée par
défaut contre les vulnérabilités OWASP top 10 (XSS, CSRF, SQLi, IDOR,
open redirect…), afin de protéger les utilisateurs et la marque.

**Critères d'acceptation :**
- [ ] Aucun `dangerouslySetInnerHTML` sans sanitization documentée.
- [ ] CSP stricte côté headers Next.
- [ ] Cookies de session `SameSite=Lax`, `Secure`, `HttpOnly`.
- [ ] Double-submit token sur les mutations sensibles.
- [ ] Garde anti open-redirect sur tout paramètre `?from=` / `?next=`.
- [ ] Aucune concaténation SQL — requêtes paramétrées Supabase uniquement.

---

### US-XC-007 — Recueillir un consentement RGPD explicite

**Persona :** Visiteur (UE)
**Priorité :** Must
**Estimation :** 3

**Story :**
En tant que visiteur européen, je veux que mes choix de consentement
cookies / analytics soient demandés explicitement et révocables, afin que
mes droits RGPD soient respectés.

**Critères d'acceptation :**
- [ ] Banner consent à la première visite, bouton « Refuser » aussi visible
      que « Accepter ».
- [ ] Pas de cookie analytics avant consentement explicite.
- [ ] Page `/privacy` listant chaque cookie, sa finalité, sa durée.
- [ ] Lien « Gérer mes préférences » présent dans le footer.

---

### US-XC-008 — Conserver les secrets hors du repo

**Persona :** Tech (interne)
**Priorité :** Must
**Estimation :** 2

**Story :**
En tant qu'équipe tech, je veux que toute clé, jeton ou mot de passe soit
stocké en variable d'environnement et jamais commité, afin d'éviter une
fuite massive via Git.

**Critères d'acceptation :**
- [ ] `.env.local` git-ignored, `.env.example` versionné sans valeurs.
- [ ] Secrets sensibles dans Hostinger / Supabase Vault uniquement.
- [ ] Pre-commit hook qui bloque les patterns secret évidents.
- [ ] Rotation documentée et planifiée trimestriellement.

---

### US-XC-009 — Observer la performance et les erreurs en production

**Persona :** Tech (interne)
**Priorité :** Must
**Estimation :** 5

**Story :**
En tant qu'équipe tech, je veux que toute erreur en production remonte
dans un dashboard avec contexte (URL, user, stack trace), afin de réagir
sans attendre que les utilisateurs nous signalent.

**Critères d'acceptation :**
- [ ] Sentry (ou équivalent) branché côté Next.
- [ ] Sourcemaps uploadées en build pour les stacks lisibles.
- [ ] Alertes Slack sur erreurs en hausse (> 5/min).
- [ ] Anonymisation des données utilisateur (pas d'email/IP dans les events).

---

### US-XC-010 — Couvrir les parcours critiques par des tests automatisés

**Persona :** Tech (interne)
**Priorité :** Must
**Estimation :** 8

**Story :**
En tant qu'équipe tech, je veux que les parcours utilisateur critiques
(catalogue, checkout, login) soient couverts par des tests bout-en-bout,
afin de pouvoir releaser sans crainte de régression.

**Critères d'acceptation :**
- [ ] Playwright pour les e2e (login, ajout panier, checkout placeholder).
- [ ] Vitest / Jest pour les composants critiques (data layer, validation).
- [ ] CI bloque le merge si tests échouent.
- [ ] Couverture minimale 60 % sur `src/lib/` et `src/features/`.

---

### US-XC-011 — Documenter la stack pour les nouveaux arrivants

**Persona :** Nouveau dev sur le projet
**Priorité :** Should
**Estimation :** 3

**Story :**
En tant que nouveau développeur, je veux pouvoir cloner le repo et lancer
l'app en moins de 15 minutes, afin de devenir productif rapidement.

**Critères d'acceptation :**
- [ ] README à jour avec stack, scripts, prérequis Node.
- [ ] CLAUDE.md / contributing guide listant les conventions.
- [ ] `.env.example` couvre toutes les variables nécessaires.
- [ ] `npm install && npm run dev` suffit pour démarrer.

---

### US-XC-012 — Gérer le mode dark (et light si besoin)

**Persona :** Visiteur
**Priorité :** Should
**Estimation :** 2

**Story :**
En tant que visiteur, je veux que le site respecte mes préférences système
(dark / light) et que je puisse les surcharger via un toggle, afin de
consulter dans des conditions confortables.

**Critères d'acceptation :**
- [ ] Dark par défaut (palette projet), light alternative.
- [ ] Toggle accessible dans le header ou le footer.
- [ ] Préférence persistante (cookie).
- [ ] Tous les composants utilisent les tokens HSL — pas de couleur en dur.
