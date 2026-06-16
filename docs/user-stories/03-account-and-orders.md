# Épopée 3 — Compte et commandes

Permettre aux clients de gérer leur identité, leurs informations et de
suivre leurs achats.

---

### US-ACC-001 — Créer un compte avec email + mot de passe

**Persona :** Visiteur
**Priorité :** Must
**Estimation :** 3
**Statut :** À faire

**Story :**
En tant que visiteur, je veux créer un compte avec mon nom, mon email et un
mot de passe respectant une politique de complexité, afin d'accéder à
l'historique des commandes et au support.

**Critères d'acceptation :**
- [ ] Formulaire sur `/register` avec nom complet, email, mot de passe, confirmation.
- [ ] Politique mot de passe : ≥ 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 spécial.
- [ ] Indicateur de force temps réel + checklist des règles satisfaites.
- [ ] Erreur claire si l'email existe déjà.
- [ ] Après création, message « un email de confirmation va être envoyé ».

**Notes techniques :**
- Phase 1 : `useAuth().register()` (localStorage + SHA-256 provisoire).
- Phase 2 : Supabase Auth (bcrypt + JWT + email de vérification).
- FIXME-SECURITY : règles côté client = UX uniquement, vraies règles serveur.

---

### US-ACC-002 — Confirmer son adresse email

**Persona :** Visiteur en cours d'inscription
**Priorité :** Must
**Estimation :** 2

**Story :**
En tant que nouvel inscrit, je veux recevoir un email avec un lien de
vérification valide 24 h, afin d'activer mon compte.

**Critères d'acceptation :**
- [ ] Email envoyé immédiatement après inscription.
- [ ] Lien à usage unique, expirant après 24 h.
- [ ] Page de confirmation accessible publiquement, qui marque l'email vérifié.
- [ ] Tant que non vérifié : connexion possible mais bandeau persistant.

**Notes techniques :**
- TODO(supabase) : envoi déclenché par Supabase Auth + template Edge Function.

---

### US-ACC-003 — Se connecter à son compte

**Persona :** Client
**Priorité :** Must
**Estimation :** 2

**Story :**
En tant que client existant, je veux me connecter avec mon email et mon mot
de passe, afin d'accéder à mon espace personnel.

**Critères d'acceptation :**
- [ ] Formulaire sur `/login` avec email et mot de passe.
- [ ] Bouton désactivé tant que les champs ne sont pas valides.
- [ ] Erreur claire en cas d'identifiants incorrects.
- [ ] Cases « Se souvenir de moi » (gère la durée de session).
- [ ] Redirection post-login : `?from=` si présent et valide, sinon `/`.
- [ ] Si déjà connecté, redirection automatique depuis `/login`.

---

### US-ACC-004 — Réinitialiser un mot de passe oublié

**Persona :** Client ayant oublié son mot de passe
**Priorité :** Must
**Estimation :** 2

**Story :**
En tant qu'utilisateur qui a oublié son mot de passe, je veux pouvoir
demander un email de réinitialisation, afin de récupérer l'accès à mon
compte.

**Critères d'acceptation :**
- [ ] Lien « Mot de passe oublié » depuis `/login`.
- [ ] Saisie email → message générique « si l'adresse existe, un mail est envoyé ».
- [ ] Email contient un lien à usage unique, expirant après 1 h.
- [ ] Page de réinitialisation : saisie nouveau mdp + confirmation, mêmes règles.

**Notes techniques :**
- Le message générique évite l'énumération des emails enregistrés.

---

### US-ACC-005 — Voir et modifier ses informations personnelles

**Persona :** Client connecté
**Priorité :** Must
**Estimation :** 3

**Story :**
En tant que client, je veux pouvoir consulter et modifier mon nom complet,
mon email et mon mot de passe depuis `/my-account`, afin de garder mes
informations à jour.

**Critères d'acceptation :**
- [ ] Section profil avec champs éditables et bouton « Enregistrer ».
- [ ] Changement d'email : nouvelle vérification déclenchée.
- [ ] Changement de mot de passe : ancien mdp requis + nouvelles règles appliquées.
- [ ] Toast de confirmation sur succès.

---

### US-ACC-006 — Voir l'historique de mes commandes

**Persona :** Client connecté
**Priorité :** Must
**Estimation :** 2

**Story :**
En tant que client, je veux voir la liste de mes commandes passées avec
date, montant et statut, afin de suivre mes achats.

**Critères d'acceptation :**
- [ ] Page `/orders` accessible uniquement aux utilisateurs connectés.
- [ ] Liste paginée (10 par page).
- [ ] Chaque commande affiche numéro, date, total, statut, nombre d'articles.
- [ ] Clic → détail de la commande avec lignes, adresse facturation, mode de paiement.

**Notes techniques :**
- FIXME-SECURITY : la garde côté client est UX, la vraie protection est dans
  les politiques RLS Supabase (`auth.uid() = orders.user_id`).

---

### US-ACC-007 — Télécharger la facture d'une commande

**Persona :** Client connecté
**Priorité :** Should
**Estimation :** 5

**Story :**
En tant que client, je veux pouvoir télécharger une facture PDF pour chaque
commande, afin de la transmettre à ma comptabilité.

**Critères d'acceptation :**
- [ ] Bouton « Télécharger la facture » sur la page détail de la commande.
- [ ] PDF généré côté serveur, conforme aux mentions légales.
- [ ] Nom de fichier : `cyna-facture-<num-commande>.pdf`.

---

### US-ACC-008 — Demander la suppression de mon compte (RGPD)

**Persona :** Client
**Priorité :** Must
**Estimation :** 3

**Story :**
En tant qu'utilisateur soucieux de mes données, je veux pouvoir demander la
suppression définitive de mon compte et de mes données personnelles,
conformément au droit à l'oubli RGPD.

**Critères d'acceptation :**
- [ ] Action « Supprimer mon compte » dans `/my-account`, confirmation à 2 étapes.
- [ ] Suppression effective sous 30 jours.
- [ ] Email de confirmation envoyé à l'utilisateur.
- [ ] Les données nécessaires à la facturation légale (10 ans) sont anonymisées
      plutôt que supprimées.

**Notes techniques :**
- Cron Supabase Edge Function pour exécuter les suppressions différées.

---

### US-ACC-009 — Exporter mes données personnelles (RGPD)

**Persona :** Client
**Priorité :** Should
**Estimation :** 3

**Story :**
En tant qu'utilisateur, je veux pouvoir demander l'export de toutes mes
données personnelles dans un format lisible (JSON), conformément au droit à
la portabilité RGPD.

**Critères d'acceptation :**
- [ ] Bouton « Exporter mes données » dans `/my-account`.
- [ ] Email avec lien de téléchargement sécurisé, valide 7 jours.
- [ ] Archive contient profil, commandes, factures, journaux d'accès.

---

### US-ACC-010 — Se déconnecter

**Persona :** Client connecté
**Priorité :** Must
**Estimation :** 1

**Story :**
En tant qu'utilisateur connecté, je veux pouvoir me déconnecter, afin de
protéger l'accès à mon compte sur un appareil partagé.

**Critères d'acceptation :**
- [ ] Bouton « Déconnexion » dans le menu utilisateur.
- [ ] Session invalidée côté serveur (cookie supprimé).
- [ ] Toast de confirmation et redirection vers `/`.

---

### US-ACC-011 — Activer le 2FA sur son compte

**Persona :** Client soucieux de la sécurité
**Priorité :** Could
**Estimation :** 5

**Story :**
En tant que client, je veux pouvoir activer une double authentification
(TOTP via app Authenticator) sur mon compte, afin de protéger l'accès même
si mon mot de passe fuit.

**Critères d'acceptation :**
- [ ] Section « Sécurité » dans `/my-account` avec activation 2FA.
- [ ] QR code généré + saisie code OTP pour activer.
- [ ] Codes de récupération générés à l'activation.
- [ ] Login 2FA-enabled demande un code OTP après le mot de passe.

---

### US-ACC-012 — Voir mes sessions actives

**Persona :** Client soucieux de la sécurité
**Priorité :** Should
**Estimation :** 2

**Story :**
En tant que client, je veux voir la liste de mes sessions actives (appareil,
IP, dernière activité) et révoquer celles que je ne reconnais pas, afin
de réagir à un éventuel accès non autorisé.

**Critères d'acceptation :**
- [ ] Liste des sessions actives dans `/my-account`.
- [ ] Bouton « Révoquer » par session, confirmation obligatoire.
- [ ] Bouton « Déconnecter toutes les autres sessions ».
