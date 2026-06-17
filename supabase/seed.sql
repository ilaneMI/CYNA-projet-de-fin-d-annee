-- Seed catalogue from the existing src/lib/demoData.js stub so the
-- migrated data layer renders something on the public pages. Idempotent:
-- `on conflict do nothing` makes re-runs safe.
--
-- Dollar-quoted strings ($x$…$x$) avoid having to escape French apostrophes.

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
insert into public.categories (id, name, description, image_url) values
  (
    'cat-1',
    'SOC',
    $d$Solutions de Centre des Opérations de Sécurité pour une surveillance complète des menaces et une réponse aux incidents.$d$,
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800'
  ),
  (
    'cat-2',
    'EDR',
    $d$Détection et Réponse aux Endpoints pour une sécurité avancée des terminaux et la détection des menaces.$d$,
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800'
  ),
  (
    'cat-3',
    'XDR',
    $d$Détection et Réponse Étendues offrant une sécurité unifiée à travers toute votre infrastructure.$d$,
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800'
  ),
  (
    'cat-4',
    'Intelligence des Menaces',
    $d$Plateformes avancées de renseignement sur les menaces pour une posture de sécurité proactive.$d$,
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
insert into public.products
  (id, name, description, price_monthly, price_annual, price_per_user, category_id, image_url, stock_status, technical_specs)
values
  -- SOC -----------------------------------------------------------------
  (
    'prod-1', 'CyberWatch SOC Pro',
    $d$Plateforme SOC de niveau entreprise avec surveillance 24/7, détection des menaces par IA et réponse automatisée aux incidents. Inclut l'intégration SIEM, les rapports de conformité et des analystes de sécurité dédiés.$d$,
    2999, 29990, 99, 'cat-1',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800',
    'En Stock',
    $j${"Déploiement":"Cloud/Sur site","Utilisateurs":"Illimité","Stockage":"10TB/mois","Rétention":"1 an","SLA":"99.9% disponibilité","Support":"24/7 Premium"}$j$::jsonb
  ),
  (
    'prod-2', 'SecureOps Elite',
    $d$Solution SOC complète avec analyses avancées, capacités de chasse aux menaces et gestion intégrée des vulnérabilités. Parfait pour les grandes entreprises aux besoins de sécurité complexes.$d$,
    4999, 49990, 149, 'cat-1',
    'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800',
    'En Stock',
    $j${"Déploiement":"Cloud","Utilisateurs":"Illimité","Stockage":"50TB/mois","Rétention":"2 ans","SLA":"99.99% disponibilité","Support":"24/7 Équipe dédiée"}$j$::jsonb
  ),
  (
    'prod-3', 'SOC Essentiel',
    $d$Plateforme SOC d'entrée de gamme pour les PME. Comprend la surveillance de base, les alertes et la gestion des incidents avec une configuration facile et un tableau de bord intuitif.$d$,
    999, 9990, 49, 'cat-1',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
    'Limité',
    $j${"Déploiement":"Cloud","Utilisateurs":"Jusqu'à 50","Stockage":"1TB/mois","Rétention":"90 jours","SLA":"99.5% disponibilité","Support":"Heures ouvrables"}$j$::jsonb
  ),
  -- EDR -----------------------------------------------------------------
  (
    'prod-4', 'EndpointShield Avancé',
    $d$EDR de nouvelle génération avec analyse comportementale, détection par apprentissage automatique et remédiation automatisée. Protège contre les menaces zero-day et les menaces persistantes avancées.$d$,
    1999, 19990, 29, 'cat-2',
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800',
    'En Stock',
    $j${"Support OS":"Windows, Mac, Linux","Déploiement":"Agent Cloud","Taux de détection":"99.7%","Temps de réponse":"< 1 seconde","Intégration":"API, SIEM, SOAR","Mises à jour":"Temps réel"}$j$::jsonb
  ),
  (
    'prod-5', 'DefendPoint Entreprise',
    $d$Solution EDR d'entreprise avec visibilité complète sur tous les terminaux, investigation avancée et outils de chasse aux menaces. Inclut la protection des appareils mobiles et le contrôle des périphériques USB.$d$,
    2499, 24990, 39, 'cat-2',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800',
    'En Stock',
    $j${"Support OS":"Windows, Mac, Linux, iOS, Android","Déploiement":"Cloud/Hybride","Taux de détection":"99.9%","Temps de réponse":"< 500ms","Intégration":"Suite API complète","Mises à jour":"Continu"}$j$::jsonb
  ),
  (
    'prod-6', 'EDR Lite',
    $d$EDR léger pour les PME avec protection essentielle des terminaux, surveillance en temps réel et déploiement simple. Idéal pour les organisations qui débutent leur parcours de sécurité.$d$,
    799, 7990, 19, 'cat-2',
    'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800',
    'En Stock',
    $j${"Support OS":"Windows, Mac","Déploiement":"Cloud","Taux de détection":"98.5%","Temps de réponse":"< 2 secondes","Intégration":"API basique","Mises à jour":"Quotidien"}$j$::jsonb
  ),
  -- XDR -----------------------------------------------------------------
  (
    'prod-7', 'UnifiedDefense XDR',
    $d$Plateforme XDR complète intégrant la sécurité des terminaux, du réseau, du cloud et des emails. Le moteur de corrélation piloté par l'IA identifie les modèles d'attaque sophistiqués à travers toute votre infrastructure.$d$,
    5999, 59990, 79, 'cat-3',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
    'En Stock',
    $j${"Couverture":"Endpoint, Réseau, Cloud, Email","Déploiement":"Cloud-Natif","Moteur IA":"ML Avancé","Intégrations":"200+ Outils de sécurité","Automatisation":"Intégration SOAR complète","Conformité":"SOC2, ISO27001, GDPR"}$j$::jsonb
  ),
  (
    'prod-8', 'XDR Complet',
    $d$Solution XDR tout-en-un avec SIEM, SOAR et renseignement sur les menaces intégrés. Offre une visibilité unifiée et une réponse automatisée à travers votre écosystème de sécurité.$d$,
    7999, 79990, 99, 'cat-3',
    'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800',
    'En Stock',
    $j${"Couverture":"Full Stack","Déploiement":"Cloud/Hybride","Moteur IA":"Deep Learning","Intégrations":"500+ Outils","Automatisation":"Playbooks personnalisés","Conformité":"Tous standards majeurs"}$j$::jsonb
  ),
  -- Threat Intelligence -------------------------------------------------
  (
    'prod-10', 'ThreatPulse Intelligence',
    $d$Plateforme de renseignement sur les menaces premium avec flux en temps réel de sources mondiales, surveillance du deep web et analyses prédictives.$d$,
    3999, 39990, 199, 'cat-4',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
    'En Stock',
    $j${"Sources de flux":"1000+ Globales","Fréquence MAJ":"Temps réel","Indicateurs":"IOCs, TTPs, Campagnes","Dark Web":"Couverture complète","Accès API":"Illimité","Rapports":"Briefings quotidiens"}$j$::jsonb
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- carousel_items
-- ---------------------------------------------------------------------------
insert into public.carousel_items (id, title, description, image_url, cta_text, cta_link, order_index) values
  (
    'carousel-1',
    'Solutions de Sécurité Entreprise',
    $d$Protégez votre organisation avec des plateformes SOC, EDR et XDR de pointe$d$,
    'https://images.unsplash.com/photo-1688413399498-e35ed74b554f?w=1920',
    'Explorer les Solutions',
    '/catalogue',
    1
  ),
  (
    'carousel-2',
    'Intelligence des Menaces Avancée',
    $d$Gardez une longueur d'avance sur les cybermenaces avec le renseignement et l'analyse en temps réel$d$,
    'https://images.unsplash.com/photo-1616432427123-f83774aeea96?w=1920',
    'En Savoir Plus',
    '/category/cat-4',
    2
  ),
  (
    'carousel-3',
    'Opérations de Sécurité 24/7',
    $d$Surveillance et réponse aux incidents en continu pour une tranquillité d'esprit totale$d$,
    'https://images.unsplash.com/photo-1697638164340-6c5fc558bdf2?w=1920',
    'Commencer',
    '/category/cat-1',
    3
  )
on conflict (id) do nothing;
