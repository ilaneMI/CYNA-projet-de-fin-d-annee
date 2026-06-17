-- Seed catalogue from src/lib/demoData.js into the normalized Lot A schema.
-- Idempotent: deterministic UUIDs let ON CONFLICT (id) DO NOTHING re-run safely.
--
-- UUID scheme:
--   10000000-...-00000000000X  → categories       (X = 1..4)
--   20000000-...-00000000000NN → products         (NN = 01..08, 10)
--   30000000-...-00000000000NN → product_images   (1 per product)
--   41000000-...-00000000000NN → prices monthly+flat
--   42000000-...-00000000000NN → prices annual+flat
--   43000000-...-00000000000NN → prices monthly+per_user
--   50000000-...-00000000000X  → carousel_slides
--
-- All text is stored under the "fr" jsonb key (en/ar/he will be added by
-- the i18n lot). Amounts are integer centimes (×100 from the JS demoData).

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
insert into public.categories (id, slug, name, description, image_url, display_order)
values
  (
    '10000000-0000-0000-0000-000000000001'::uuid,
    'soc',
    jsonb_build_object('fr', 'SOC'),
    jsonb_build_object('fr',
      $d$Solutions de Centre des Opérations de Sécurité pour une surveillance complète des menaces et une réponse aux incidents.$d$
    ),
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800',
    1
  ),
  (
    '10000000-0000-0000-0000-000000000002'::uuid,
    'edr',
    jsonb_build_object('fr', 'EDR'),
    jsonb_build_object('fr',
      $d$Détection et Réponse aux Endpoints pour une sécurité avancée des terminaux et la détection des menaces.$d$
    ),
    'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800',
    2
  ),
  (
    '10000000-0000-0000-0000-000000000003'::uuid,
    'xdr',
    jsonb_build_object('fr', 'XDR'),
    jsonb_build_object('fr',
      $d$Détection et Réponse Étendues offrant une sécurité unifiée à travers toute votre infrastructure.$d$
    ),
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
    3
  ),
  (
    '10000000-0000-0000-0000-000000000004'::uuid,
    'intelligence-des-menaces',
    jsonb_build_object('fr', 'Intelligence des Menaces'),
    jsonb_build_object('fr',
      $d$Plateformes avancées de renseignement sur les menaces pour une posture de sécurité proactive.$d$
    ),
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
    4
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
insert into public.products
  (id, category_id, slug, name, description, specs, availability)
values
  -- SOC --------------------------------------------------------------------
  (
    '20000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000001'::uuid,
    'cyberwatch-soc-pro',
    jsonb_build_object('fr', 'CyberWatch SOC Pro'),
    jsonb_build_object('fr',
      $d$Plateforme SOC de niveau entreprise avec surveillance 24/7, détection des menaces par IA et réponse automatisée aux incidents. Inclut l'intégration SIEM, les rapports de conformité et des analystes de sécurité dédiés.$d$
    ),
    $s${"Déploiement":"Cloud/Sur site","Utilisateurs":"Illimité","Stockage":"10TB/mois","Rétention":"1 an","SLA":"99.9% disponibilité","Support":"24/7 Premium"}$s$::jsonb,
    'in_stock'
  ),
  (
    '20000000-0000-0000-0000-000000000002'::uuid,
    '10000000-0000-0000-0000-000000000001'::uuid,
    'secureops-elite',
    jsonb_build_object('fr', 'SecureOps Elite'),
    jsonb_build_object('fr',
      $d$Solution SOC complète avec analyses avancées, capacités de chasse aux menaces et gestion intégrée des vulnérabilités. Parfait pour les grandes entreprises aux besoins de sécurité complexes.$d$
    ),
    $s${"Déploiement":"Cloud","Utilisateurs":"Illimité","Stockage":"50TB/mois","Rétention":"2 ans","SLA":"99.99% disponibilité","Support":"24/7 Équipe dédiée"}$s$::jsonb,
    'in_stock'
  ),
  (
    '20000000-0000-0000-0000-000000000003'::uuid,
    '10000000-0000-0000-0000-000000000001'::uuid,
    'soc-essentiel',
    jsonb_build_object('fr', 'SOC Essentiel'),
    jsonb_build_object('fr',
      $d$Plateforme SOC d'entrée de gamme pour les PME. Comprend la surveillance de base, les alertes et la gestion des incidents avec une configuration facile et un tableau de bord intuitif.$d$
    ),
    $s${"Déploiement":"Cloud","Utilisateurs":"Jusqu'à 50","Stockage":"1TB/mois","Rétention":"90 jours","SLA":"99.5% disponibilité","Support":"Heures ouvrables"}$s$::jsonb,
    'limited'
  ),
  -- EDR --------------------------------------------------------------------
  (
    '20000000-0000-0000-0000-000000000004'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid,
    'endpointshield-avance',
    jsonb_build_object('fr', 'EndpointShield Avancé'),
    jsonb_build_object('fr',
      $d$EDR de nouvelle génération avec analyse comportementale, détection par apprentissage automatique et remédiation automatisée. Protège contre les menaces zero-day et les menaces persistantes avancées.$d$
    ),
    $s${"Support OS":"Windows, Mac, Linux","Déploiement":"Agent Cloud","Taux de détection":"99.7%","Temps de réponse":"< 1 seconde","Intégration":"API, SIEM, SOAR","Mises à jour":"Temps réel"}$s$::jsonb,
    'in_stock'
  ),
  (
    '20000000-0000-0000-0000-000000000005'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid,
    'defendpoint-entreprise',
    jsonb_build_object('fr', 'DefendPoint Entreprise'),
    jsonb_build_object('fr',
      $d$Solution EDR d'entreprise avec visibilité complète sur tous les terminaux, investigation avancée et outils de chasse aux menaces. Inclut la protection des appareils mobiles et le contrôle des périphériques USB.$d$
    ),
    $s${"Support OS":"Windows, Mac, Linux, iOS, Android","Déploiement":"Cloud/Hybride","Taux de détection":"99.9%","Temps de réponse":"< 500ms","Intégration":"Suite API complète","Mises à jour":"Continu"}$s$::jsonb,
    'in_stock'
  ),
  (
    '20000000-0000-0000-0000-000000000006'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid,
    'edr-lite',
    jsonb_build_object('fr', 'EDR Lite'),
    jsonb_build_object('fr',
      $d$EDR léger pour les PME avec protection essentielle des terminaux, surveillance en temps réel et déploiement simple. Idéal pour les organisations qui débutent leur parcours de sécurité.$d$
    ),
    $s${"Support OS":"Windows, Mac","Déploiement":"Cloud","Taux de détection":"98.5%","Temps de réponse":"< 2 secondes","Intégration":"API basique","Mises à jour":"Quotidien"}$s$::jsonb,
    'in_stock'
  ),
  -- XDR --------------------------------------------------------------------
  (
    '20000000-0000-0000-0000-000000000007'::uuid,
    '10000000-0000-0000-0000-000000000003'::uuid,
    'unifieddefense-xdr',
    jsonb_build_object('fr', 'UnifiedDefense XDR'),
    jsonb_build_object('fr',
      $d$Plateforme XDR complète intégrant la sécurité des terminaux, du réseau, du cloud et des emails. Le moteur de corrélation piloté par l'IA identifie les modèles d'attaque sophistiqués à travers toute votre infrastructure.$d$
    ),
    $s${"Couverture":"Endpoint, Réseau, Cloud, Email","Déploiement":"Cloud-Natif","Moteur IA":"ML Avancé","Intégrations":"200+ Outils de sécurité","Automatisation":"Intégration SOAR complète","Conformité":"SOC2, ISO27001, GDPR"}$s$::jsonb,
    'in_stock'
  ),
  (
    '20000000-0000-0000-0000-000000000008'::uuid,
    '10000000-0000-0000-0000-000000000003'::uuid,
    'xdr-complet',
    jsonb_build_object('fr', 'XDR Complet'),
    jsonb_build_object('fr',
      $d$Solution XDR tout-en-un avec SIEM, SOAR et renseignement sur les menaces intégrés. Offre une visibilité unifiée et une réponse automatisée à travers votre écosystème de sécurité.$d$
    ),
    $s${"Couverture":"Full Stack","Déploiement":"Cloud/Hybride","Moteur IA":"Deep Learning","Intégrations":"500+ Outils","Automatisation":"Playbooks personnalisés","Conformité":"Tous standards majeurs"}$s$::jsonb,
    'in_stock'
  ),
  -- Threat Intelligence ----------------------------------------------------
  (
    '20000000-0000-0000-0000-000000000010'::uuid,
    '10000000-0000-0000-0000-000000000004'::uuid,
    'threatpulse-intelligence',
    jsonb_build_object('fr', 'ThreatPulse Intelligence'),
    jsonb_build_object('fr',
      $d$Plateforme de renseignement sur les menaces premium avec flux en temps réel de sources mondiales, surveillance du deep web et analyses prédictives.$d$
    ),
    $s${"Sources de flux":"1000+ Globales","Fréquence MAJ":"Temps réel","Indicateurs":"IOCs, TTPs, Campagnes","Dark Web":"Couverture complète","Accès API":"Illimité","Rapports":"Briefings quotidiens"}$s$::jsonb,
    'in_stock'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- product_images (1 par produit, position 0)
-- ---------------------------------------------------------------------------
insert into public.product_images (id, product_id, url, position) values
  ('30000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800', 0),
  ('30000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800', 0),
  ('30000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000003'::uuid, 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800', 0),
  ('30000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800', 0),
  ('30000000-0000-0000-0000-000000000005'::uuid, '20000000-0000-0000-0000-000000000005'::uuid, 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800', 0),
  ('30000000-0000-0000-0000-000000000006'::uuid, '20000000-0000-0000-0000-000000000006'::uuid, 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800', 0),
  ('30000000-0000-0000-0000-000000000007'::uuid, '20000000-0000-0000-0000-000000000007'::uuid, 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800', 0),
  ('30000000-0000-0000-0000-000000000008'::uuid, '20000000-0000-0000-0000-000000000008'::uuid, 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800', 0),
  ('30000000-0000-0000-0000-000000000010'::uuid, '20000000-0000-0000-0000-000000000010'::uuid, 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800', 0)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- prices — 3 lignes par produit (monthly+flat, annual+flat, monthly+per_user).
-- Centimes = montant euro × 100 (cf. modele-donnees-CYNA.md §1 décision 4).
-- ---------------------------------------------------------------------------
insert into public.prices (id, product_id, billing_interval, unit_type, unit_amount, currency) values
  -- monthly + flat
  ('41000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 'monthly', 'flat',  299900, 'eur'),
  ('41000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'monthly', 'flat',  499900, 'eur'),
  ('41000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000003'::uuid, 'monthly', 'flat',   99900, 'eur'),
  ('41000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 'monthly', 'flat',  199900, 'eur'),
  ('41000000-0000-0000-0000-000000000005'::uuid, '20000000-0000-0000-0000-000000000005'::uuid, 'monthly', 'flat',  249900, 'eur'),
  ('41000000-0000-0000-0000-000000000006'::uuid, '20000000-0000-0000-0000-000000000006'::uuid, 'monthly', 'flat',   79900, 'eur'),
  ('41000000-0000-0000-0000-000000000007'::uuid, '20000000-0000-0000-0000-000000000007'::uuid, 'monthly', 'flat',  599900, 'eur'),
  ('41000000-0000-0000-0000-000000000008'::uuid, '20000000-0000-0000-0000-000000000008'::uuid, 'monthly', 'flat',  799900, 'eur'),
  ('41000000-0000-0000-0000-000000000010'::uuid, '20000000-0000-0000-0000-000000000010'::uuid, 'monthly', 'flat',  399900, 'eur'),
  -- annual + flat
  ('42000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 'annual',  'flat', 2999000, 'eur'),
  ('42000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'annual',  'flat', 4999000, 'eur'),
  ('42000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000003'::uuid, 'annual',  'flat',  999000, 'eur'),
  ('42000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 'annual',  'flat', 1999000, 'eur'),
  ('42000000-0000-0000-0000-000000000005'::uuid, '20000000-0000-0000-0000-000000000005'::uuid, 'annual',  'flat', 2499000, 'eur'),
  ('42000000-0000-0000-0000-000000000006'::uuid, '20000000-0000-0000-0000-000000000006'::uuid, 'annual',  'flat',  799000, 'eur'),
  ('42000000-0000-0000-0000-000000000007'::uuid, '20000000-0000-0000-0000-000000000007'::uuid, 'annual',  'flat', 5999000, 'eur'),
  ('42000000-0000-0000-0000-000000000008'::uuid, '20000000-0000-0000-0000-000000000008'::uuid, 'annual',  'flat', 7999000, 'eur'),
  ('42000000-0000-0000-0000-000000000010'::uuid, '20000000-0000-0000-0000-000000000010'::uuid, 'annual',  'flat', 3999000, 'eur'),
  -- monthly + per_user
  ('43000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid, 'monthly', 'per_user',  9900, 'eur'),
  ('43000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000002'::uuid, 'monthly', 'per_user', 14900, 'eur'),
  ('43000000-0000-0000-0000-000000000003'::uuid, '20000000-0000-0000-0000-000000000003'::uuid, 'monthly', 'per_user',  4900, 'eur'),
  ('43000000-0000-0000-0000-000000000004'::uuid, '20000000-0000-0000-0000-000000000004'::uuid, 'monthly', 'per_user',  2900, 'eur'),
  ('43000000-0000-0000-0000-000000000005'::uuid, '20000000-0000-0000-0000-000000000005'::uuid, 'monthly', 'per_user',  3900, 'eur'),
  ('43000000-0000-0000-0000-000000000006'::uuid, '20000000-0000-0000-0000-000000000006'::uuid, 'monthly', 'per_user',  1900, 'eur'),
  ('43000000-0000-0000-0000-000000000007'::uuid, '20000000-0000-0000-0000-000000000007'::uuid, 'monthly', 'per_user',  7900, 'eur'),
  ('43000000-0000-0000-0000-000000000008'::uuid, '20000000-0000-0000-0000-000000000008'::uuid, 'monthly', 'per_user',  9900, 'eur'),
  ('43000000-0000-0000-0000-000000000010'::uuid, '20000000-0000-0000-0000-000000000010'::uuid, 'monthly', 'per_user', 19900, 'eur')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- carousel_slides
-- cta_link de carousel-2 / carousel-3 ré-écrits avec les slugs canoniques.
-- ---------------------------------------------------------------------------
insert into public.carousel_slides (id, title, subtitle, image_url, cta_text, cta_link, display_order)
values
  (
    '50000000-0000-0000-0000-000000000001'::uuid,
    jsonb_build_object('fr', 'Solutions de Sécurité Entreprise'),
    jsonb_build_object('fr',
      $d$Protégez votre organisation avec des plateformes SOC, EDR et XDR de pointe$d$
    ),
    'https://images.unsplash.com/photo-1688413399498-e35ed74b554f?w=1920',
    jsonb_build_object('fr', 'Explorer les Solutions'),
    '/catalogue',
    1
  ),
  (
    '50000000-0000-0000-0000-000000000002'::uuid,
    jsonb_build_object('fr', 'Intelligence des Menaces Avancée'),
    jsonb_build_object('fr',
      $d$Gardez une longueur d'avance sur les cybermenaces avec le renseignement et l'analyse en temps réel$d$
    ),
    'https://images.unsplash.com/photo-1616432427123-f83774aeea96?w=1920',
    jsonb_build_object('fr', 'En Savoir Plus'),
    '/category/intelligence-des-menaces',
    2
  ),
  (
    '50000000-0000-0000-0000-000000000003'::uuid,
    jsonb_build_object('fr', 'Opérations de Sécurité 24/7'),
    jsonb_build_object('fr',
      $d$Surveillance et réponse aux incidents en continu pour une tranquillité d'esprit totale$d$
    ),
    'https://images.unsplash.com/photo-1697638164340-6c5fc558bdf2?w=1920',
    jsonb_build_object('fr', 'Commencer'),
    '/category/soc',
    3
  )
on conflict (id) do nothing;
