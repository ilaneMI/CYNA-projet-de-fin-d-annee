/**
 * tools/test-f3-aal1.mjs
 *
 * Prouve le durcissement F3 : un admin AAL1 (connecté par mot de passe,
 * SANS avoir validé son TOTP sur cette session) ne peut PAS lire les
 * tables/RPC admin durcies. Un admin AAL2 pourrait ; cet outil ne teste
 * QUE la branche AAL1 pour prouver le refus par la RLS + la RPC.
 *
 * Read-only strict :
 *   - Un signInWithPassword (crée un JWT côté Supabase Auth, aucune
 *     écriture sur nos tables métier).
 *   - Trois lectures : select audit log, select orders, rpc dashboard KPIs.
 *   - Zéro insert/update/delete.
 *
 * Aucun credential n'est hardcodé — tout vient de .env.local.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Lancement :
 *
 *   1. Complète .env.local avec :
 *        NEXT_PUBLIC_SUPABASE_URL=<déjà présent>
 *        NEXT_PUBLIC_SUPABASE_ANON_KEY=<déjà présent>
 *        TEST_ADMIN_EMAIL=<email d'un compte admin>
 *        TEST_ADMIN_PASSWORD=<mot de passe du compte admin>
 *
 *   2. node tools/test-f3-aal1.mjs
 *
 *   3. Optionnel : retirer TEST_ADMIN_PASSWORD de .env.local après le
 *      test (variable sensible, pas de raison de la garder).
 * ─────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loader minimal (zéro dépendance dotenv) ────────────────────────
// Parse .env.local à la main : KEY=value, ignore commentaires + lignes
// vides, retire les quotes autour de la value. Ne touche pas aux
// variables déjà posées dans process.env (respecte l'override CLI).
function loadEnvLocal() {
  const envPath = resolve(__dirname, '..', '.env.local');
  let raw;
  try {
    raw = readFileSync(envPath, 'utf-8');
  } catch {
    console.warn(`[env] ${envPath} introuvable — process.env only.`);
    return;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

// ── ANSI couleurs minimales ────────────────────────────────────────────
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const passTag = () => `${GREEN}${BOLD}PASS${RESET}`;
const failTag = () => `${RED}${BOLD}FAIL${RESET}`;
const info = (s) => `${CYAN}${s}${RESET}`;
const warn = (s) => `${YELLOW}${s}${RESET}`;
const bad = (s) => `${RED}${s}${RESET}`;
const good = (s) => `${GREEN}${s}${RESET}`;

// ── Validation env ────────────────────────────────────────────────────
const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'TEST_ADMIN_EMAIL',
  'TEST_ADMIN_PASSWORD',
];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(bad(`✗ Variables d'environnement manquantes : ${missing.join(', ')}`));
  console.error(warn('Attendues dans .env.local :'));
  for (const k of REQUIRED_ENV) console.error(`   ${k}=...`);
  process.exit(2);
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  console.log(info('[F3 test] .env.local chargé.'));
  console.log(info(`[F3 test] Supabase URL   : ${process.env.NEXT_PUBLIC_SUPABASE_URL}`));
  console.log(info(`[F3 test] Compte testé   : ${process.env.TEST_ADMIN_EMAIL}`));

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // ── 1. Sign-in mot de passe (AAL1 par construction) ─────────────────
  console.log(info('[F3 test] signInWithPassword…'));
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  });
  if (signInErr) {
    console.error(bad(`✗ Sign-in échoué : ${signInErr.message}`));
    process.exit(2);
  }
  const userId = signInData.user?.id;
  if (!userId) {
    console.error(bad('✗ signInWithPassword n\'a pas renvoyé de user.id.'));
    process.exit(2);
  }
  console.log(info(`[F3 test] Signed in. user_id = ${userId}`));

  // ── 2. Confirmer que la session est AAL1 (pas de challenge+verify TOTP) ──
  const { data: aal, error: aalErr } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalErr) {
    console.error(bad(`✗ getAuthenticatorAssuranceLevel : ${aalErr.message}`));
    process.exit(2);
  }
  console.log(
    info(
      `[F3 test] Session AAL   : currentLevel=${aal.currentLevel} nextLevel=${aal.nextLevel}`,
    ),
  );
  if (aal.currentLevel !== 'aal1') {
    console.error(
      bad(
        `✗ Session n'est pas en AAL1 (currentLevel=${aal.currentLevel}). Test invalide.`,
      ),
    );
    process.exit(2);
  }

  // ── 3. Sanity check : le compte est bien admin en base ──────────────
  // Sinon les 3 tests passeraient pour la mauvaise raison (non-admin
  // n'a de toute façon aucun droit admin).
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', userId)
    .maybeSingle();
  if (profileErr) {
    console.error(bad(`✗ Lecture profile échouée : ${profileErr.message}`));
    process.exit(2);
  }
  console.log(
    info(
      `[F3 test] Rôle en base  : role=${profile?.role} is_active=${profile?.is_active}`,
    ),
  );
  if (profile?.role !== 'admin' || profile.is_active !== true) {
    console.error(
      bad(
        `✗ TEST_ADMIN_EMAIL n'est pas un admin actif (role=${profile?.role}). Le test perdrait sa validité — un non-admin échouerait aussi mais pour une autre raison.`,
      ),
    );
    process.exit(2);
  }

  console.log();

  const results = [];

  // ── Test 1/3 : admin_audit_log (admin-read pure, F3 groupe 1) ──────
  console.log(info(`${BOLD}--- Test 1/3 : admin_audit_log ---${RESET}`));
  console.log(`Query : supabase.from('admin_audit_log').select('id')`);
  const t1 = await supabase.from('admin_audit_log').select('id');
  const t1Rows = (t1.data ?? []).length;
  console.log(`Rows returned : ${t1Rows}`);
  console.log(`Error         : ${t1.error?.message ?? '<none>'}`);
  const t1Pass = !t1.error && t1Rows === 0;
  console.log(t1Pass ? passTag() : failTag());
  if (!t1Pass) {
    if (t1.error) {
      console.log(bad(`   → Erreur inattendue : ${t1.error.message}`));
    } else {
      console.log(
        bad(
          `   → F3 CASSÉ : un admin AAL1 voit ${t1Rows} ligne(s) du journal d'audit.`,
        ),
      );
    }
  }
  results.push({ name: 'admin_audit_log read (0 rows attendu)', pass: t1Pass });

  console.log();

  // ── Test 2/3 : orders (owner-or-admin, F3 groupe 3) ────────────────
  // Un admin AAL1 doit voir UNIQUEMENT ses propres commandes (branche
  // owner). Si le résultat contient au moins une ligne avec un user_id
  // différent, la branche admin AAL1 est ouverte → F3 cassé.
  console.log(info(`${BOLD}--- Test 2/3 : orders (owner-or-admin) ---${RESET}`));
  console.log(`Query : supabase.from('orders').select('id, user_id')`);
  const t2 = await supabase.from('orders').select('id, user_id');
  const t2Rows = t2.data ?? [];
  const foreign = t2Rows.filter((r) => r.user_id !== userId);
  const owned = t2Rows.length - foreign.length;
  console.log(`Rows returned : ${t2Rows.length}`);
  console.log(`Owned by this admin : ${owned}`);
  console.log(`Owned by others     : ${foreign.length}`);
  console.log(`Error         : ${t2.error?.message ?? '<none>'}`);
  const t2Pass = !t2.error && foreign.length === 0;
  console.log(t2Pass ? passTag() : failTag());
  if (!t2Pass) {
    if (t2.error) {
      console.log(bad(`   → Erreur inattendue : ${t2.error.message}`));
    } else {
      console.log(
        bad(
          `   → F3 CASSÉ : un admin AAL1 voit ${foreign.length} commande(s) appartenant à d'autres users. Fuite RGPD potentielle.`,
        ),
      );
    }
  }
  if (t2Pass && owned === 0) {
    console.log(
      warn(
        '   ⚠ Note : ce compte admin a 0 commande propre — la preuve tient sur "0 commande étrangère lue", pas sur un cas positif. Idéalement TEST_ADMIN_EMAIL a au moins 1 commande.',
      ),
    );
  }
  results.push({
    name: 'orders owner-filter (0 ligne étrangère attendue)',
    pass: t2Pass,
  });

  console.log();

  // ── Test 3/3 : admin_dashboard_kpis RPC (F3 groupe 4) ──────────────
  console.log(info(`${BOLD}--- Test 3/3 : admin_dashboard_kpis RPC ---${RESET}`));
  console.log(`Call  : supabase.rpc('admin_dashboard_kpis', { p_days: 7 })`);
  const t3 = await supabase.rpc('admin_dashboard_kpis', { p_days: 7 });
  const t3DataPreview = JSON.stringify(t3.data)?.slice(0, 120) ?? '<none>';
  console.log(`Data          : ${t3.data === null ? '<null>' : t3DataPreview}`);
  console.log(`Error code    : ${t3.error?.code ?? '<none>'}`);
  console.log(`Error message : ${t3.error?.message ?? '<none>'}`);
  const t3Pass = t3.error?.code === '42501';
  console.log(t3Pass ? passTag() : failTag());
  if (!t3Pass) {
    if (t3.error) {
      console.log(
        bad(
          `   → Attendait code 42501, obtenu code=${t3.error.code}. Investiguer is_admin_aal2().`,
        ),
      );
    } else {
      console.log(
        bad(
          `   → F3 CASSÉ : la RPC a répondu sans erreur. Un admin AAL1 peut appeler admin_dashboard_kpis.`,
        ),
      );
    }
  }
  results.push({
    name: 'admin_dashboard_kpis refusée avec 42501',
    pass: t3Pass,
  });

  // ── Récap ───────────────────────────────────────────────────────────
  console.log();
  console.log('═'.repeat(60));
  console.log(`${BOLD}RÉCAP F3 hardening — session admin AAL1${RESET}`);
  for (const r of results) {
    const tag = r.pass ? passTag() : failTag();
    console.log(`  ${tag}  ${r.name}`);
  }
  console.log('═'.repeat(60));
  const allPass = results.every((r) => r.pass);
  if (allPass) {
    console.log(good(`${BOLD}Overall : F3 durcissement VALIDÉ ✅${RESET}`));
    process.exit(0);
  } else {
    console.log(bad(`${BOLD}Overall : F3 CASSÉ — investigation requise ✗${RESET}`));
    process.exit(1);
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(bad(`✗ Erreur non catchée : ${msg}`));
  process.exit(2);
});
