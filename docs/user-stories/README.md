# User stories — CYNA

Cahier des user stories du projet CYNA (e-commerce SaaS cybersécurité —
SOC / EDR / XDR / Threat Intelligence). Sert de base pour les sprints,
la priorisation produit et la rédaction des tickets.

## Format

Chaque story suit ce gabarit :

```
### US-<EPIC>-<NN> — <titre court>

**Persona :** Visiteur | Client | Admin | Tech
**Priorité :** Must | Should | Could | Won't (MoSCoW)
**Estimation :** points de complexité (1, 2, 3, 5, 8, 13)
**Statut :** À faire | En cours | Fait

**Story :**
En tant que <persona>, je veux <objectif>, afin de <bénéfice>.

**Critères d'acceptation :**
- [ ] Critère 1
- [ ] Critère 2

**Notes techniques (optionnel) :**
- Implémentation pertinente, contraintes, dépendances.
```

## Conventions

- **Indépendance.** Une story est testable seule. Si elle ne peut pas exister sans
  une autre, la noter en dépendance dans les notes techniques.
- **Verticalité.** Une story = une tranche de valeur visible utilisateur,
  jamais une tâche technique isolée (« mettre en place tel composant »).
- **Critères mesurables.** Les CA évitent les formulations vagues (« facile à
  utiliser ») au profit de critères vérifiables (« la page répond en moins de
  500 ms côté serveur »).
- **Sécurité par défaut.** Toute story qui touche à de la donnée ou à un
  paiement renvoie aux contraintes RGPD / PCI-DSS / RLS du CLAUDE.md.

## Personas

| Persona | Description | Rôle dans le système |
|---|---|---|
| **Visiteur** | Anonyme, découvre l'offre Cyna. | Aucun compte, peut parcourir le catalogue et lancer un achat en mode invité. |
| **Client** | Compte Cyna actif, B2B PME ou ETI. | Achats, gestion de profil, suivi des commandes, support. |
| **Admin** | Équipe Cyna interne. | Gestion du catalogue, des commandes et des utilisateurs. MFA obligatoire. |
| **Tech (interne)** | Cible secondaire des stories cross-cutting. | Observabilité, sécurité, performance. |

## Épopées

1. [Catalogue et découverte](./01-catalogue-and-discovery.md) — navigation, catégories, produit, recherche.
2. [Panier et tunnel d'achat](./02-cart-and-checkout.md) — panier, checkout multi-étapes, paiement, confirmation.
3. [Compte et commandes](./03-account-and-orders.md) — inscription, connexion, profil, mot de passe, historique des commandes.
4. [Administration](./04-admin.md) — gestion catalogue, commandes, utilisateurs, MFA.
5. [Support et outils](./05-support-and-tools.md) — formulaire de contact, FAQ, chatbot SAV.
6. [Transverse](./06-cross-cutting.md) — sécurité, accessibilité, i18n / RTL, performance, observabilité, RGPD.

## Synthèse rapide

| Épopée | # Stories | Must | Should | Could |
|---|---|---|---|---|
| Catalogue et découverte | 12 | 8 | 3 | 1 |
| Panier et tunnel d'achat | 11 | 9 | 2 | 0 |
| Compte et commandes | 12 | 9 | 2 | 1 |
| Administration | 10 | 7 | 2 | 1 |
| Support et outils | 6 | 3 | 2 | 1 |
| Transverse | 12 | 9 | 3 | 0 |
| **Total** | **63** | **45** | **14** | **4** |

Les chiffres sont indicatifs et seront recalibrés au backlog grooming.

## Évolution du document

Ce dossier est versionné dans le repo : toute modification se fait par PR
revue par au moins une autre personne de l'équipe. Les stories archivées
(terminées ou abandonnées) restent dans le fichier avec leur statut mis à
jour — pas de suppression destructive.
