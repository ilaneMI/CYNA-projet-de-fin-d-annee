import 'server-only';
import { getServiceSupabase } from '@/lib/supabase-service';

/**
 * Journal d'audit admin — Ticket 44.
 *
 * Écrit une ligne dans `public.admin_audit_log` chaque fois qu'un admin
 * effectue une mutation métier via une route /api/admin/*.
 *
 * BEST-EFFORT invariant (contrainte du ticket) :
 *   - Cette fonction ne throw JAMAIS. Elle catch tout en interne et log un
 *     warn côté serveur en cas d'échec.
 *   - Elle ne renvoie AUCUNE valeur (Promise<void>). L'appelant n'a rien à
 *     inspecter et ne peut pas conditionner son comportement à l'échec.
 *   - Conséquence : la mutation métier (RPC / DB update / Stripe) qui
 *     précède cet appel n'est JAMAIS impactée par un échec d'écriture du
 *     log. La contrainte "l'écriture du log ne doit jamais faire échouer
 *     la mutation métier" est structurellement garantie.
 *
 * `import 'server-only'` : impossible de bundler côté navigateur — le
 * client service_role reste server-scoped.
 *
 * Identité de l'admin :
 *   - `actor.id` et `actor.email` proviennent de `getServerSupabase().
 *     auth.getUser()` côté route, donc du JWT signé Supabase. Non
 *     forgeable côté client.
 *   - Le log est écrit via `service_role` qui bypass la RLS. Aucune
 *     autre voie d'écriture n'existe : la table n'a AUCUNE policy
 *     INSERT/UPDATE/DELETE.
 *
 * Non-atomicité assumée : si la mutation réussit et l'insert log échoue,
 * on a une mutation sans trace d'audit. Signalé par `console.warn` avec
 * assez de contexte pour reconstituer manuellement (actor + entity_type
 * + entity_id + summary). Trade-off documenté dans le plan.
 */

export type AuditAction = 'create' | 'update' | 'delete' | 'reorder';
export type AuditEntity =
  | 'product'
  | 'price'
  | 'category'
  | 'carousel_slide'
  | 'home_block';

export async function logAdminAction(params: {
  actor: { id: string; email: string | null };
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string;
  summary: string;
  diff?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const supabase = getServiceSupabase();
    const { error } = await supabase.from('admin_audit_log').insert({
      actor_user_id: params.actor.id,
      actor_email: params.actor.email ?? '',
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      summary: params.summary,
      diff: params.diff ?? null,
    });
    if (error) {
      console.warn(
        `[audit-log] insert failed for ${params.entityType}:${params.entityId} ` +
          `by ${params.actor.email ?? params.actor.id}: ${error.message}. ` +
          `summary="${params.summary}"`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[audit-log] threw for ${params.entityType}:${params.entityId} ` +
        `by ${params.actor.email ?? params.actor.id}: ${message}. ` +
        `summary="${params.summary}"`,
    );
  }
}
