#!/usr/bin/env node
/**
 * tools/seed-product-extra-images.mjs
 *
 * Ajoute 2 images supplémentaires (positions 1 et 2) dans
 * `public.product_images` pour chacun des 9 produits du catalogue, afin
 * de rendre le carrousel page produit réellement démonstrable.
 *
 *   node tools/seed-product-extra-images.mjs
 *
 * Idempotent : pour chaque (product_id, url) prévu, on n'insère que si
 * la paire n'existe pas déjà (test `WHERE NOT EXISTS`). Une re-execution
 * n'ajoute donc rien — on peut le relancer sans risque de doublons.
 *
 * Schéma cible (cf. migration 20260617120000_data_schema.sql) :
 *   product_images (id uuid pk, product_id uuid fk → products,
 *                   url text, alt jsonb, position int default 0,
 *                   created_at timestamptz)
 *   PAS de contrainte unique sur (product_id, url) — d'où le check
 *   applicatif côté script.
 *
 * Position : l'image primaire existante est à position=0. On insère à
 * 1 et 2 — pas de conflit avec l'existant. Si une autre intervention
 * écrit en position 1 ou 2 avec une URL différente, le script ne
 * l'écrasera pas (le NOT EXISTS porte sur l'URL, pas sur la position).
 *
 * Service-role obligatoire : `product_images` n'a pas de policy
 * INSERT pour `authenticated`. Lit `.env.local` (jamais commit).
 *
 * URLs Unsplash thématiques par catégorie :
 *   SOC → control room / dashboards
 *   EDR → endpoint / hardware
 *   XDR → réseau / corrélation
 *   TI  → analyste / threat intel
 */

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  if (!existsSync('.env.local')) {
    console.error('error: .env.local not found. Run from the repo root.');
    process.exit(2);
  }
  const env = {};
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const env = loadEnv();
for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!env[k]) {
    console.error(`error: ${k} missing from .env.local`);
    process.exit(2);
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ----------------------------------------------------------------------------
// Données seed — IDs produits récupérés via SELECT préalable.
// Chaque entrée = product_id + 2 images supplémentaires (positions 1, 2),
// avec alt jsonb i18n (fr+en) — la table accepte alt nullable mais autant
// remplir, c'est de la donnée a11y gratuite.
// ----------------------------------------------------------------------------

const SEED = [
  // ── SOC ────────────────────────────────────────────────────────────────
  {
    slug: 'cyberwatch-soc-pro',
    product_id: '20000000-0000-0000-0000-000000000001',
    extras: [
      { position: 1, url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200', alt: { fr: 'Salle de pilotage SOC, écrans de supervision', en: 'SOC control room with monitoring screens' } },
      { position: 2, url: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1200',  alt: { fr: 'Console analyste SOC avec tableaux de bord', en: 'SOC analyst console with dashboards' } },
    ],
  },
  {
    slug: 'secureops-elite',
    product_id: '20000000-0000-0000-0000-000000000002',
    extras: [
      { position: 1, url: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1200', alt: { fr: 'Centre d’opérations cyber, équipe analystes', en: 'Cyber operations center, analysts team' } },
      { position: 2, url: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=1200',     alt: { fr: 'Visualisation d’alertes en temps réel', en: 'Real-time alert visualisation' } },
    ],
  },
  {
    slug: 'soc-essentiel',
    product_id: '20000000-0000-0000-0000-000000000003',
    extras: [
      { position: 1, url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200', alt: { fr: 'Circuit imprimé, surveillance bas niveau', en: 'Circuit board, low-level monitoring' } },
      { position: 2, url: 'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=1200', alt: { fr: 'Analyste SOC face à des écrans', en: 'SOC analyst in front of screens' } },
    ],
  },

  // ── EDR ────────────────────────────────────────────────────────────────
  {
    slug: 'endpointshield-avance',
    product_id: '20000000-0000-0000-0000-000000000004',
    extras: [
      { position: 1, url: 'https://images.unsplash.com/photo-1496096265110-f83ad7f96608?w=1200', alt: { fr: 'Poste de travail avec cadenas, endpoint sécurisé', en: 'Laptop with lock, secured endpoint' } },
      { position: 2, url: 'https://images.unsplash.com/photo-1551808525-051dbe28d39c?w=1200',     alt: { fr: 'Détail clavier d’un poste protégé', en: 'Close-up keyboard of a protected workstation' } },
    ],
  },
  {
    slug: 'defendpoint-entreprise',
    product_id: '20000000-0000-0000-0000-000000000005',
    extras: [
      { position: 1, url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200', alt: { fr: 'Postes de travail en entreprise', en: 'Enterprise workstations fleet' } },
      { position: 2, url: 'https://images.unsplash.com/photo-1573164574572-cb89e39749b4?w=1200', alt: { fr: 'Analyste sécurité en investigation', en: 'Security analyst investigating' } },
    ],
  },
  {
    slug: 'edr-lite',
    product_id: '20000000-0000-0000-0000-000000000006',
    extras: [
      { position: 1, url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200', alt: { fr: 'Poste léger, alerte EDR', en: 'Lightweight workstation, EDR alert' } },
      { position: 2, url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200',     alt: { fr: 'Code et logs d’endpoint', en: 'Endpoint code and logs' } },
    ],
  },

  // ── XDR ────────────────────────────────────────────────────────────────
  {
    slug: 'unifieddefense-xdr',
    product_id: '20000000-0000-0000-0000-000000000007',
    extras: [
      { position: 1, url: 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=1200', alt: { fr: 'Sécurité cloud, infrastructure répartie', en: 'Cloud security, distributed infrastructure' } },
      { position: 2, url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1200', alt: { fr: 'Corrélation de signaux multi-surfaces', en: 'Multi-surface signal correlation' } },
    ],
  },
  {
    slug: 'xdr-complet',
    product_id: '20000000-0000-0000-0000-000000000008',
    extras: [
      { position: 1, url: 'https://images.unsplash.com/photo-1633265486064-086b219458ec?w=1200', alt: { fr: 'Visualisation réseau XDR, corrélation multi-sources', en: 'XDR network visualisation, multi-source correlation' } },
      { position: 2, url: 'https://images.unsplash.com/photo-1605379399642-870262d3d051?w=1200', alt: { fr: 'Tableau de bord XDR consolidé', en: 'Consolidated XDR dashboard' } },
    ],
  },

  // ── Threat Intelligence ────────────────────────────────────────────────
  {
    slug: 'threatpulse-intelligence',
    product_id: '20000000-0000-0000-0000-000000000010',
    extras: [
      { position: 1, url: 'https://images.unsplash.com/photo-1531030874896-fdef6826f2f7?w=1200', alt: { fr: 'Flux de threat intelligence en temps réel', en: 'Real-time threat intelligence feed' } },
      { position: 2, url: 'https://images.unsplash.com/photo-1614064548237-02f7e7e0f49b?w=1200', alt: { fr: 'Carte mondiale des menaces', en: 'Global threat map' } },
    ],
  },
];

// ----------------------------------------------------------------------------
// Idempotent insert : NOT EXISTS sur (product_id, url) — l'unicité n'est
// pas garantie au schéma, on s'en charge applicativement.
// ----------------------------------------------------------------------------

let created = 0;
let skipped = 0;
let failed = 0;

for (const product of SEED) {
  for (const extra of product.extras) {
    try {
      // Check existence (per (product_id, url)).
      const { data: existing, error: selErr } = await supabase
        .from('product_images')
        .select('id')
        .eq('product_id', product.product_id)
        .eq('url', extra.url)
        .maybeSingle();
      if (selErr) throw new Error(`select: ${selErr.message}`);
      if (existing) {
        skipped++;
        console.log(`= ${product.slug} pos=${extra.position} already present, skipped`);
        continue;
      }

      const { error: insErr } = await supabase.from('product_images').insert({
        product_id: product.product_id,
        url: extra.url,
        alt: extra.alt,
        position: extra.position,
      });
      if (insErr) throw new Error(`insert: ${insErr.message}`);
      created++;
      console.log(`+ ${product.slug} pos=${extra.position}`);
    } catch (err) {
      failed++;
      console.error(`! ${product.slug} pos=${extra.position}: ${err.message}`);
    }
  }
}

console.log(`\ndone. created=${created} skipped=${skipped} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
