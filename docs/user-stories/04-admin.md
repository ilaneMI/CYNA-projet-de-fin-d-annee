# Épopée 4 — Administration

Permettre à l'équipe Cyna interne de piloter le catalogue, suivre les
commandes et gérer les utilisateurs en respectant les contraintes de
sécurité renforcée (RBAC + MFA obligatoire).

---

### US-ADM-001 — Accéder au back-office avec MFA obligatoire

**Persona :** Admin
**Priorité :** Must
**Estimation :** 5
**Statut :** À faire

**Story :**
En tant qu'admin Cyna, je veux que l'accès à `/admin` exige systématiquement
une double authentification, afin de protéger les données catalogue et
commandes contre une fuite de mot de passe.

**Critères d'acceptation :**
- [ ] Toute route sous `/admin` exige rôle `admin` ET MFA actif.
- [ ] Si l'admin tente d'accéder sans MFA activé → forcé à l'activer avant.
- [ ] Sessions admin durent maximum 2 heures (vs 7 jours utilisateur).
- [ ] Toute action sensible (delete, update prix...) est journalisée.

**Notes techniques :**
- Vérifié par middleware Supabase + RLS sur les tables `admin_logs`.
- FIXME-SECURITY : la phase actuelle ne fait que vérifier l'email
  `admin@cyna.com` côté client — à remplacer impérativement.

---

### US-ADM-002 — Créer un nouveau produit

**Persona :** Admin
**Priorité :** Must
**Estimation :** 5

**Story :**
En tant qu'admin, je veux pouvoir créer un nouveau produit (nom, description,
catégorie, image, prix par durée, specs techniques, disponibilité), afin
d'enrichir l'offre catalogue.

**Critères d'acceptation :**
- [ ] Formulaire de création accessible depuis `/admin/products/new`.
- [ ] Upload image avec preview et compression côté client.
- [ ] Validation : nom unique, prix positifs, catégorie existante.
- [ ] Brouillon enregistrable sans publier (statut `draft`).
- [ ] Publication déclenche la régénération ISR de la page catégorie.

---

### US-ADM-003 — Modifier un produit existant

**Persona :** Admin
**Priorité :** Must
**Estimation :** 3

**Story :**
En tant qu'admin, je veux pouvoir modifier les informations et les prix
d'un produit existant, afin de refléter les évolutions de l'offre.

**Critères d'acceptation :**
- [ ] Page d'édition `/admin/products/<id>`.
- [ ] Diff visible avant enregistrement.
- [ ] Modification du prix : confirmation à 2 étapes.
- [ ] Historique des modifications consultable.

---

### US-ADM-004 — Désactiver ou archiver un produit

**Persona :** Admin
**Priorité :** Must
**Estimation :** 2

**Story :**
En tant qu'admin, je veux pouvoir retirer temporairement un produit du
catalogue (désactivation) ou le supprimer définitivement (archivage), afin
de gérer la fin de vie d'une offre sans casser les commandes passées.

**Critères d'acceptation :**
- [ ] Action « Désactiver » → masque le produit du catalogue public.
- [ ] Action « Archiver » → suppression logique (soft delete), accessible
      en lecture seule.
- [ ] Les commandes passées référençant un produit archivé restent valides.

---

### US-ADM-005 — Gérer les catégories

**Persona :** Admin
**Priorité :** Must
**Estimation :** 3

**Story :**
En tant qu'admin, je veux pouvoir créer, modifier et réordonner les
catégories de produits, afin de structurer la navigation utilisateur.

**Critères d'acceptation :**
- [ ] CRUD complet sur les catégories depuis `/admin/categories`.
- [ ] Drag-and-drop pour réordonner.
- [ ] Suppression interdite si la catégorie contient des produits actifs.

---

### US-ADM-006 — Voir et gérer les commandes

**Persona :** Admin
**Priorité :** Must
**Estimation :** 5

**Story :**
En tant qu'admin, je veux pouvoir consulter la liste de toutes les commandes
avec filtres (date, statut, client, montant), afin de suivre l'activité
commerciale.

**Critères d'acceptation :**
- [ ] Tableau paginé sur `/admin/orders` avec tri multi-colonnes.
- [ ] Filtres sur statut, date, client, fourchette de montant.
- [ ] Export CSV des commandes filtrées.
- [ ] Détail d'une commande accessible en lecture seule (factures, lignes, paiement).

---

### US-ADM-007 — Mettre à jour le statut d'une commande

**Persona :** Admin
**Priorité :** Must
**Estimation :** 2

**Story :**
En tant qu'admin, je veux pouvoir faire évoluer le statut d'une commande
(en attente → en cours → livrée / annulée), afin de refléter l'avancement
réel et notifier le client.

**Critères d'acceptation :**
- [ ] Sélecteur de statut sur le détail commande.
- [ ] Changement journalisé avec timestamp + ID admin.
- [ ] Email automatique au client à chaque transition (sauf vers `pending`).

---

### US-ADM-008 — Voir et gérer les utilisateurs

**Persona :** Admin
**Priorité :** Should
**Estimation :** 5

**Story :**
En tant qu'admin, je veux pouvoir consulter la liste des utilisateurs
inscrits et désactiver un compte abusif, afin de modérer la base.

**Critères d'acceptation :**
- [ ] Tableau utilisateurs sur `/admin/users` (email, date inscription, statut).
- [ ] Action « Désactiver » + raison obligatoire.
- [ ] Action « Promouvoir admin » avec confirmation à 2 étapes.

---

### US-ADM-009 — Voir un dashboard de KPIs

**Persona :** Admin
**Priorité :** Should
**Estimation :** 5

**Story :**
En tant que responsable produit, je veux voir un dashboard avec les KPIs
clés (CA mois, nombre de commandes, top produits, taux de conversion), afin
de piloter l'activité.

**Critères d'acceptation :**
- [ ] Page `/admin/dashboard` accessible aux admins.
- [ ] Métriques sur 30 / 90 / 365 jours.
- [ ] Graphiques accessibles (alternative tableau pour les lecteurs d'écran).
- [ ] Données fraîches (latence < 5 min).

---

### US-ADM-010 — Consulter les journaux d'accès admin

**Persona :** Admin / Audit
**Priorité :** Could
**Estimation :** 3

**Story :**
En tant qu'admin sécurité, je veux pouvoir consulter le journal des actions
admin (qui, quoi, quand, depuis quelle IP), afin d'auditer en cas
d'incident.

**Critères d'acceptation :**
- [ ] Page `/admin/audit-log` réservée aux admins seniors.
- [ ] Filtres par utilisateur, action, période, IP.
- [ ] Export CSV signé pour les audits externes.
