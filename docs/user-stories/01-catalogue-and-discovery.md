# Épopée 1 — Catalogue et découverte

Permettre à un visiteur ou un client de découvrir l'offre Cyna, comparer
les solutions et trouver rapidement la réponse à un besoin de sécurité.

---

### US-CAT-001 — Parcourir le catalogue complet

**Persona :** Visiteur
**Priorité :** Must
**Estimation :** 3
**Statut :** À faire

**Story :**
En tant que visiteur, je veux parcourir le catalogue complet des solutions Cyna,
afin de découvrir l'offre avant de m'engager.

**Critères d'acceptation :**
- [ ] La page `/catalogue` affiche tous les produits actifs.
- [ ] Tri par défaut : priorité produit puis disponibilité.
- [ ] Possibilité de filtrer par catégorie, disponibilité, fourchette de prix.
- [ ] La page reste utilisable sur mobile (1 colonne sous 640 px).
- [ ] Recherche textuelle accessible depuis la barre d'en-tête, résultats < 100 ms.

**Notes techniques :**
- Implémentation RSC : `await getProducts(query)` côté serveur.
- Filtres en client island, état dans l'URL pour partage et navigation back.

---

### US-CAT-002 — Découvrir les catégories de solutions

**Persona :** Visiteur
**Priorité :** Must
**Estimation :** 2

**Story :**
En tant que visiteur, je veux voir les grandes catégories (SOC, EDR, XDR,
Threat Intelligence) avec une description claire de chacune, afin d'identifier
le type de solution adapté à mon besoin.

**Critères d'acceptation :**
- [ ] Page d'accueil avec section catégories visibles sans scroll sur desktop.
- [ ] Chaque catégorie a une image, un titre, un résumé en 1-2 phrases.
- [ ] Clic sur une catégorie ouvre `/category/<id>` avec la liste filtrée.
- [ ] Catégorie vide affiche un message « aucun produit dans cette catégorie ».

---

### US-CAT-003 — Voir le détail d'un produit

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 3

**Story :**
En tant que visiteur, je veux consulter la page détaillée d'un produit (description,
spécifications techniques, prix par durée d'abonnement), afin d'évaluer s'il
correspond à mon besoin.

**Critères d'acceptation :**
- [ ] `/product/<id>` affiche nom, description, image, statut de stock.
- [ ] Spécifications techniques sous forme de liste clé/valeur.
- [ ] Onglets de tarification : mensuel, annuel, par utilisateur.
- [ ] Bouton « Ajouter au panier » + bouton « Demander une démo ».
- [ ] Section « Services similaires » (3 produits de la même catégorie).
- [ ] Breadcrumb retour vers la catégorie d'origine.

**Notes techniques :**
- SSG via `generateStaticParams` ; ISR à activer quand Supabase pilotera les produits.
- Image principale via `next/image` avec `priority`.

---

### US-CAT-004 — Filtrer le catalogue par catégorie

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 2

**Story :**
En tant que visiteur, je veux filtrer le catalogue par catégorie (mono ou
multi-sélection), afin de réduire le nombre de produits affichés à ceux qui
m'intéressent.

**Critères d'acceptation :**
- [ ] Filtre catégorie présent sur `/catalogue` et `/search`.
- [ ] Multi-sélection sur `/search`, mono-sélection sur `/catalogue` (UX dédiée).
- [ ] Filtre persistant dans l'URL pour partage et back navigateur.

---

### US-CAT-005 — Filtrer par disponibilité

**Persona :** Visiteur, Client
**Priorité :** Should
**Estimation :** 1

**Story :**
En tant que client B2B, je veux pouvoir n'afficher que les produits en stock
ou avec disponibilité limitée, afin de me focaliser sur ce que je peux acheter
immédiatement.

**Critères d'acceptation :**
- [ ] Filtre disponibilité : En Stock / Limité / Rupture de Stock.
- [ ] Par défaut : tout afficher.
- [ ] Comportement multi-sélect sur `/search`.

---

### US-CAT-006 — Filtrer par fourchette de prix

**Persona :** Client
**Priorité :** Should
**Estimation :** 2

**Story :**
En tant que client avec un budget contraint, je veux filtrer par fourchette
de prix mensuel, afin de cibler les offres compatibles avec mon budget.

**Critères d'acceptation :**
- [ ] Deux champs : minimum et maximum (en $).
- [ ] La fourchette s'applique au prix mensuel.
- [ ] Filtre committé au blur, pas à chaque caractère tapé.

---

### US-CAT-007 — Trier les résultats

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 1

**Story :**
En tant qu'utilisateur du catalogue, je veux trier les résultats par pertinence,
prix croissant/décroissant, alphabétique ou nouveauté, afin d'organiser
l'affichage selon mon critère prioritaire.

**Critères d'acceptation :**
- [ ] Sélecteur de tri accessible au-dessus de la grille.
- [ ] Tri par défaut : priorité produit puis disponibilité.
- [ ] Le tri sélectionné persiste dans l'URL.

---

### US-CAT-008 — Rechercher un produit par mot-clé

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 3

**Story :**
En tant que visiteur, je veux pouvoir saisir un mot-clé dans la barre de
recherche pour trouver un produit par nom, description ou caractéristique
technique, afin de gagner du temps face à un catalogue qui peut grossir.

**Critères d'acceptation :**
- [ ] Barre de recherche présente dans le header sur toutes les pages.
- [ ] Soumission → redirige sur `/search?q=<term>`.
- [ ] Recherche multi-token : tous les tokens doivent matcher (ET implicite).
- [ ] Temps de réponse < 100 ms côté serveur (cible avec pg_trgm Postgres).
- [ ] Résultats triés par pertinence par défaut.

**Notes techniques :**
- Phase 1 : substring match côté demoData / Supabase ilike.
- Phase 2 : index `pg_trgm` pour full-text + ranking.

---

### US-CAT-009 — Voir les produits mis en avant en page d'accueil

**Persona :** Visiteur
**Priorité :** Must
**Estimation :** 2

**Story :**
En tant que visiteur arrivant sur la home, je veux voir une sélection de
produits phares et un carrousel d'accroches, afin de comprendre rapidement
le positionnement de Cyna.

**Critères d'acceptation :**
- [ ] Carrousel hero avec 3 slides minimum, défilement automatique toutes les 5 s.
- [ ] Section « Produits populaires » : 6 produits maximum.
- [ ] Section « Catégories de Sécurité » : 4 catégories cliquables.
- [ ] Section « Pourquoi Cyna » : 4 atouts (protection, IA, scalabilité, support).

---

### US-CAT-010 — Voir le statut de stock sur chaque produit

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 1

**Story :**
En tant qu'acheteur potentiel, je veux voir clairement le statut de
disponibilité de chaque produit (En Stock / Limité / Rupture), afin de
savoir si je peux l'acheter immédiatement.

**Critères d'acceptation :**
- [ ] Badge coloré visible sur la carte produit et la page détail.
- [ ] « Rupture de Stock » désactive le bouton « Ajouter au panier ».
- [ ] « Limité » garde le bouton actif avec mention.

---

### US-CAT-011 — Partager une URL filtrée

**Persona :** Client
**Priorité :** Should
**Estimation :** 1

**Story :**
En tant que client qui veut partager une sélection avec un collègue, je veux
que mes filtres soient encodés dans l'URL, afin de coller un lien qui ouvre
exactement la même vue chez le destinataire.

**Critères d'acceptation :**
- [ ] Tous les filtres (q, category, stock, sort, min, max) en query params.
- [ ] L'ouverture du lien dans un onglet vierge restaure la même vue.
- [ ] Le bouton back navigateur restaure la vue précédente.

---

### US-CAT-012 — Suggestions de produits similaires sur la page produit

**Persona :** Visiteur, Client
**Priorité :** Could
**Estimation :** 2

**Story :**
En tant que prospect lisant une fiche produit, je veux voir 2-3 alternatives
de la même catégorie, afin de comparer rapidement sans repartir à la liste.

**Critères d'acceptation :**
- [ ] 3 produits maximum, hors produit courant.
- [ ] Section masquée si le produit est seul dans sa catégorie.
- [ ] Cartes cliquables, mêmes infos résumées que sur la grille catalogue.
