# Épopée 5 — Support et outils

Permettre aux visiteurs et clients d'obtenir de l'aide rapidement et
réduire le nombre de tickets entrants grâce à du self-service.

---

### US-SUP-001 — Contacter Cyna via un formulaire

**Persona :** Visiteur, Client
**Priorité :** Must
**Estimation :** 2
**Statut :** À faire

**Story :**
En tant que visiteur ou client, je veux pouvoir contacter Cyna via un
formulaire (sujet, email, message), afin de poser une question
commerciale ou technique.

**Critères d'acceptation :**
- [ ] Page `/tools` (ou `/contact`) avec formulaire.
- [ ] Champs requis : email, sujet, message ; téléphone optionnel.
- [ ] Validation client + serveur (anti-spam type honeypot ou Turnstile).
- [ ] Confirmation à l'envoi + email d'accusé de réception sous 1 minute.
- [ ] Le message arrive dans la file support.

**Notes techniques :**
- Edge Function Supabase qui valide, vérifie le honeypot, insère en base
  `contacts` et déclenche l'envoi mail.

---

### US-SUP-002 — Consulter une FAQ

**Persona :** Visiteur, Client
**Priorité :** Should
**Estimation :** 3

**Story :**
En tant que visiteur avec une question récurrente, je veux trouver une FAQ
catégorisée et cherchable, afin de me dépanner sans contacter le support.

**Critères d'acceptation :**
- [ ] Page `/faq` avec catégories accordéon.
- [ ] Recherche dans la FAQ.
- [ ] Liens vers les questions partageables (`#hash` dans l'URL).

---

### US-SUP-003 — Discuter avec un chatbot d'assistance

**Persona :** Visiteur, Client
**Priorité :** Could
**Estimation :** 8

**Story :**
En tant que visiteur avec une question, je veux pouvoir converser avec un
chatbot capable de répondre aux questions courantes et d'escalader vers le
support humain si besoin, afin d'avoir une réponse rapide 24/7.

**Critères d'acceptation :**
- [ ] Widget chat en bas à droite de toutes les pages publiques.
- [ ] Premier message d'accueil + menu rapide.
- [ ] Escalade humain accessible à tout moment.
- [ ] Conversation persistante côté utilisateur (localStorage / DB si logged).
- [ ] Conforme accessibilité (focus trap, ESC pour fermer).

---

### US-SUP-004 — Demander une démo produit

**Persona :** Visiteur prospect
**Priorité :** Must
**Estimation :** 2

**Story :**
En tant que prospect, je veux pouvoir demander une démo personnalisée depuis
une fiche produit, afin de discuter avec un expert avant de signer.

**Critères d'acceptation :**
- [ ] Bouton « Demander une démo » sur la fiche produit.
- [ ] Formulaire pré-rempli avec le produit, à compléter avec email + société.
- [ ] Confirmation : « Notre équipe commerciale vous contactera sous 24 h ».
- [ ] Notification envoyée au CRM commercial.

---

### US-SUP-005 — Recevoir des notifications de statut commande

**Persona :** Client
**Priorité :** Should
**Estimation :** 3

**Story :**
En tant que client, je veux recevoir un email à chaque évolution de statut
de ma commande, afin de suivre ce qui se passe sans aller dans mon compte.

**Critères d'acceptation :**
- [ ] Email automatique sur transitions : payée, en cours, livrée, annulée.
- [ ] Template responsive, contient un lien direct vers `/orders/<id>`.
- [ ] Option d'opt-out dans les préférences `/my-account`.

---

### US-SUP-006 — Consulter le statut des services Cyna

**Persona :** Client
**Priorité :** Could
**Estimation :** 3

**Story :**
En tant que client opérant un SOC ou EDR, je veux pouvoir consulter en
temps réel le statut des plateformes Cyna que j'utilise, afin de savoir si
un incident en cours impacte mon service.

**Critères d'acceptation :**
- [ ] Page publique `/status` avec état par plateforme.
- [ ] Historique des incidents des 30 derniers jours.
- [ ] Abonnement email/RSS aux notifications d'incident.
