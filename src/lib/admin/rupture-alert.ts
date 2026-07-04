import 'server-only';
import { getServiceSupabase } from '@/lib/supabase-service';
import { sendRuptureAlert } from '@/lib/email/resend';

/**
 * Ticket 45 — Alerte rupture stock, best-effort strict.
 *
 * BEST-EFFORT INVARIANT (contrainte du ticket, identique au ticket 39) :
 *   - Ces fonctions ne throw JAMAIS. try/catch interne, tout se termine
 *     par un console.warn au pire.
 *   - Elles retournent Promise<void>. L'appelant n'a rien à inspecter
 *     et ne peut pas conditionner son comportement à un échec.
 *   - Conséquence : la mutation métier (RPC admin_update_product) qui
 *     précède ces appels n'est JAMAIS impactée par un échec de l'alerte.
 *
 * ANTI-SPAM : cycle rupture → retour → rupture.
 *   - Claim atomique sur products.rupture_alerted_at (UPDATE … IS NULL
 *     RETURNING). Un seul run gagne, les autres passent en no-op.
 *   - Reset explicite quand availability sort de 'out_of_stock' → NULL,
 *     ce qui ré-arme la prochaine alerte.
 *
 * Écriture via service_role : la RLS de products n'autorise aucune
 * écriture pour authenticated (le PATCH classique passe par la RPC
 * SECURITY DEFINER). service_role bypass la RLS et écrit directement
 * cette colonne d'infra, cohérent avec le pattern webhook.
 */

export async function tryClaimAndSendRuptureAlert(params: {
  actor: { id: string; email: string | null };
  productId: string;
  productName: string;
}): Promise<void> {
  try {
    const supabase = getServiceSupabase();

    // Claim atomique : un seul run peut poser rupture_alerted_at à un
    // instant t où il était null. Les runs concurrents (double clic,
    // replay) voient claimed = null et sautent l'envoi.
    const { data: claimed, error: claimErr } = await supabase
      .from('products')
      .update({ rupture_alerted_at: new Date().toISOString() })
      .eq('id', params.productId)
      .is('rupture_alerted_at', null)
      .select('id')
      .maybeSingle();

    if (claimErr) {
      console.warn(
        `[rupture-alert] claim failed for product ${params.productId}: ${claimErr.message}. Skipping send.`,
      );
      return;
    }
    if (!claimed) {
      // Déjà alerté sur ce cycle rupture → retour → rupture.
      console.info(
        `[rupture-alert] product ${params.productId} already alerted, skipping send.`,
      );
      return;
    }

    try {
      await sendRuptureAlert({
        productName: params.productName,
        productId: params.productId,
        actorEmail: params.actor.email,
      });
      console.info(
        `[rupture-alert] sent for product ${params.productId} (${params.productName}) by ${params.actor.email ?? params.actor.id}`,
      );
    } catch (sendErr) {
      // Le claim est déjà posé. On accepte de perdre l'email plutôt
      // que d'envoyer 2 fois (trade-off documenté ticket 39). Un
      // renvoi manuel = SET rupture_alerted_at = NULL via service_role.
      const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      console.warn(
        `[rupture-alert] send failed for ${params.productId} AFTER claim: ${msg}. To resend, reset rupture_alerted_at to NULL manually.`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[rupture-alert] threw for ${params.productId}: ${msg}`);
  }
}

export async function resetRuptureAlertFlag(productId: string): Promise<void> {
  try {
    const supabase = getServiceSupabase();
    // .not('rupture_alerted_at', 'is', null) évite un UPDATE inutile
    // (0 lignes touchées vs. bruit dans les logs Supabase).
    const { error } = await supabase
      .from('products')
      .update({ rupture_alerted_at: null })
      .eq('id', productId)
      .not('rupture_alerted_at', 'is', null);
    if (error) {
      console.warn(
        `[rupture-alert] reset failed for product ${productId}: ${error.message}. Non-blocking.`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[rupture-alert] reset threw for ${productId}: ${msg}`);
  }
}
