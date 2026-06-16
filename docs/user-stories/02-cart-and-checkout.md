# Épopée 2 — Panier et tunnel d'achat

Permettre à un visiteur ou un client de constituer un panier, le réviser et
finaliser l'achat en quelques étapes claires.

---

### US-CART-001 — Ajouter un produit au panier

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 2
**Statut :** À faire

**Story :**
En tant que visiteur, je veux ajouter un produit au panier depuis la fiche
détail ou la carte produit, afin de constituer ma sélection avant le
paiement.

**Critères d'acceptation :**
- [ ] Bouton « Ajouter au panier » sur la fiche produit et la carte produit.
- [ ] Le bouton est désactivé si le produit est en Rupture de Stock.
- [ ] Toast de confirmation à l'ajout, avec le nom du produit.
- [ ] Le compteur d'articles dans le header se met à jour immédiatement.
- [ ] Le panier persiste après refresh (localStorage tant que pas authentifié,
      base côté serveur quand Supabase est branché).

---

### US-CART-002 — Choisir la durée d'abonnement à l'ajout

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 1

**Story :**
En tant que client, je veux pouvoir choisir une durée d'abonnement (mensuel /
annuel / par utilisateur) avant de mettre dans le panier, afin que le panier
reflète le bon prix dès le départ.

**Critères d'acceptation :**
- [ ] Sélecteur de durée sur la fiche produit, par défaut « mensuel ».
- [ ] Le prix affiché correspond à la durée sélectionnée.
- [ ] La durée choisie est mémorisée dans le panier.

---

### US-CART-003 — Modifier les éléments du panier

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 3

**Story :**
En tant qu'utilisateur, je veux pouvoir ajuster la quantité, changer la
durée d'abonnement ou retirer un article depuis la page panier, afin de
finaliser ma sélection sans repartir au catalogue.

**Critères d'acceptation :**
- [ ] Boutons + / − pour chaque article (libellés explicites).
- [ ] Quantité 0 → article retiré automatiquement avec confirmation.
- [ ] Sélecteur de durée par article (3 options).
- [ ] Bouton « Vider le panier » avec confirmation.

---

### US-CART-004 — Voir le total du panier mis à jour en temps réel

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 1

**Story :**
En tant qu'acheteur, je veux voir le sous-total et le total estimé
recalculés instantanément quand je modifie le panier, afin de connaître
le montant avant de cliquer sur paiement.

**Critères d'acceptation :**
- [ ] Récapitulatif sticky sur desktop, en bas de page sur mobile.
- [ ] Mention « Taxes calculées au paiement ».
- [ ] Mention « Montant indicatif » sous le total.
- [ ] Mise à jour annoncée aux lecteurs d'écran (`aria-live="polite"`).

**Notes techniques :**
- FIXME-SECURITY : ce total est purement indicatif. Le montant débité est
  recalculé serveur-side au branchement Stripe.

---

### US-CART-005 — Lancer le tunnel d'achat

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 2

**Story :**
En tant qu'acheteur prêt à payer, je veux pouvoir lancer le tunnel d'achat
depuis le panier en un clic, afin de finaliser sans friction.

**Critères d'acceptation :**
- [ ] Bouton « Passer au paiement » qui ouvre `/checkout`.
- [ ] Si le panier est vide → redirection automatique vers `/cart`.
- [ ] La redirection respecte l'état d'hydratation (pas de flash sur panier vide).

---

### US-CART-006 — Choisir entre connexion et mode invité

**Persona :** Visiteur
**Priorité :** Must
**Estimation :** 2

**Story :**
En tant que visiteur arrivant sur le checkout, je veux pouvoir choisir entre
me connecter, créer un compte, ou continuer en mode invité avec juste un
email, afin de ne pas être bloqué par la création d'un compte.

**Critères d'acceptation :**
- [ ] Étape 1 du tunnel : choix entre login / register / guest email.
- [ ] L'email invité préremplit l'adresse facturation à l'étape suivante.
- [ ] Si déjà connecté → l'étape 1 est compactée (juste « Continuer »).

---

### US-CART-007 — Saisir une adresse de facturation

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 3

**Story :**
En tant qu'acheteur, je veux saisir une adresse de facturation complète
(prénom, nom, adresse 1/2, ville, région, code postal, pays, téléphone),
afin que la facture soit correctement émise.

**Critères d'acceptation :**
- [ ] Tous les champs obligatoires sont marqués d'un astérisque.
- [ ] Champ « Adresse 2 » optionnel.
- [ ] Validation à la perte de focus : format email, code postal, téléphone.
- [ ] Résumé d'erreurs en `aria-live` au submit si invalide.
- [ ] Tokens `autoComplete` corrects pour autofill navigateur.

---

### US-CART-008 — Choisir un mode de paiement

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 5

**Story :**
En tant qu'acheteur, je veux choisir entre carte bancaire et PayPal pour le
règlement, afin d'utiliser mon moyen de paiement habituel.

**Critères d'acceptation :**
- [ ] Sélecteur de mode (carte ou PayPal).
- [ ] Pour la carte : Stripe Elements monte le formulaire dans une iframe
      sécurisée. **Zéro donnée carte ne transite par nos serveurs.**
- [ ] Pour PayPal : redirection vers le tunnel PayPal et retour callback.
- [ ] Bouton « Confirmer le paiement » désactivé pendant le traitement.

**Notes techniques :**
- FIXME-SECURITY + TODO(stripe) : tant que Stripe n'est pas branché, le
  bouton simule une latence et avance à la confirmation sans débit réel.
- Conforme PCI-DSS par construction : le front ne voit jamais de PAN/CVC.

---

### US-CART-009 — Recevoir une confirmation de commande

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 2

**Story :**
En tant qu'acheteur ayant payé, je veux voir une page de confirmation avec
un numéro de commande et un récapitulatif, afin d'avoir une trace immédiate.

**Critères d'acceptation :**
- [ ] Numéro de commande lisible et copiable.
- [ ] Montant total et email destinataire affichés.
- [ ] Mention « Un email de confirmation a été envoyé ».
- [ ] Boutons « Voir mes commandes » et « Continuer mes achats ».
- [ ] Le panier est vidé après confirmation.

**Notes techniques :**
- TODO(supabase) : l'email réel sera envoyé par Supabase Functions + provider
  mail au branchement.

---

### US-CART-010 — Naviguer librement entre les étapes du tunnel

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 1

**Story :**
En tant qu'acheteur, je veux pouvoir revenir à l'étape précédente du tunnel
sans perdre mes informations, afin de corriger une saisie.

**Critères d'acceptation :**
- [ ] Bouton « Retour » sur les étapes 2 et 3.
- [ ] L'état du formulaire est conservé en revenant en arrière.
- [ ] L'indicateur d'étape (1 sur 4, 2 sur 4...) reflète l'avancement.
- [ ] L'étape en cours est annoncée aux lecteurs d'écran (`aria-current="step"`).

---

### US-CART-011 — Restaurer un panier après refresh ou déconnexion

**Persona :** Visiteur, Client
**Priorité :** Should
**Estimation :** 3

**Story :**
En tant qu'utilisateur, je veux que mon panier soit conservé entre les
sessions (jusqu'à 30 jours), afin de ne pas tout recommencer si je quitte la
page.

**Critères d'acceptation :**
- [ ] Panier persistant en localStorage tant que non authentifié.
- [ ] Au login, fusion entre le panier local et le panier serveur.
- [ ] À la déconnexion, le panier local est purgé (UX explicite).

**Notes techniques :**
- Phase 1 : localStorage uniquement. Phase 2 : table `carts` Supabase + RLS.
