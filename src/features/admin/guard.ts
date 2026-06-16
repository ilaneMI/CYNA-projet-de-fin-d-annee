import type { CurrentUser } from '@/context/AuthContext';

/**
 * Provisional admin email used while we do not have RBAC.
 *
 * FIXME-SECURITY: hardcoded email check is a stopgap. When Supabase Auth
 * lands, this entire mechanism must be replaced by:
 *
 *   1. a `role` column on `users` set to `'admin'` for the back-office team,
 *   2. an RLS-aware Supabase middleware in /admin that verifies the JWT
 *      and rejects non-admin requests at the edge before any UI renders,
 *   3. mandatory MFA / 2FA for the admin role,
 *   4. a 2-hour max session lifetime for admin tokens (vs 7 days for
 *      regular users),
 *   5. an `admin_audit_log` table that records every admin action
 *      (auth.uid(), action, target id, IP, user agent).
 *
 * Until then, the line below is a demo-only gate that anyone with the
 * dev console can bypass — do NOT push this to production as-is.
 */
export const ADMIN_EMAIL = 'admin@cyna.com';

export const isAdmin = (user: CurrentUser | null | undefined): boolean =>
  Boolean(user && user.email === ADMIN_EMAIL);
