'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { safeRedirectTarget } from '@/features/auth/redirect';
import { isAdmin } from '@/features/admin/guard';
import DashboardSection from '@/features/admin/DashboardSection';
import ProductsAdminSection from '@/features/admin/ProductsAdminSection';
import OrdersAdminSection from '@/features/admin/OrdersAdminSection';

const ADMIN_PATH = '/admin';

const AdminSkeleton = () => (
  <div className="space-y-6" aria-busy="true" aria-live="polite">
    {[0, 1, 2].map((row) => (
      <div
        key={row}
        className="h-44 animate-pulse rounded-lg border border-border bg-card/40"
        aria-hidden="true"
      />
    ))}
    <span className="sr-only">Vérification de votre habilitation administrateur…</span>
  </div>
);

const AccessDenied = ({ email }: { email: string }) => (
  <section
    aria-labelledby="admin-denied-heading"
    className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center shadow-sm"
  >
    <div
      aria-hidden="true"
      className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15"
    >
      <ShieldOff className="h-8 w-8 text-destructive" />
    </div>
    <h1 id="admin-denied-heading" className="text-2xl font-bold text-foreground">
      Accès refusé
    </h1>
    <p className="mt-2 max-w-md text-sm text-muted-foreground sm:mx-auto">
      Vous êtes bien connecté en tant que <span className="font-medium text-foreground">{email}</span>{' '}
      mais ce compte n&apos;a pas les droits d&apos;administration. Contactez votre référent Cyna
      si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
    </p>
    <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
      <Link href="/my-account">
        <Button type="button" variant="outline">
          Retour à mon compte
        </Button>
      </Link>
      <Link href="/">
        <Button type="button">Aller à l&apos;accueil</Button>
      </Link>
    </div>
  </section>
);

export default function AdminView() {
  const router = useRouter();
  const { isAuthenticated, loading, currentUser } = useAuth();
  const allowed = isAdmin(currentUser);

  // FIXME-SECURITY: client-side guard for an admin-only page. This is the
  // single most sensitive route of the app and the layer below is
  // intentionally minimal because the real defence belongs server-side:
  //
  //   - middleware Supabase that verifies the JWT and the `role` claim
  //     before the response is even streamed,
  //   - RLS on every admin table (products, orders, audit log...) so a
  //     compromised client can never read or mutate without server consent,
  //   - mandatory MFA at login + 2-hour max session for the admin role,
  //   - admin actions written to `admin_audit_log` server-side.
  //
  // Until that lands, the snippet below is for UX only — anyone with the
  // dev console can flip `isAuthenticated` and `currentUser.email`, so
  // this code MUST NOT be the only thing standing between an attacker and
  // the back-office.
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      const fromParam = encodeURIComponent(safeRedirectTarget(ADMIN_PATH));
      router.replace(`/login?from=${fromParam}`);
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) {
    return <AdminSkeleton />;
  }

  if (!allowed) {
    return <AccessDenied email={currentUser?.email ?? '—'} />;
  }

  return (
    <div className="space-y-10">
      <div
        role="note"
        className="rounded-md border border-amber-700/40 bg-amber-900/15 p-4 text-sm text-amber-100"
      >
        <p className="font-semibold">⚠️ Garde admin provisoire</p>
        <p className="mt-1 text-amber-100/80">
          Vous voyez cette page parce que votre email est{' '}
          <code className="rounded bg-amber-900/30 px-1">admin@cyna.com</code>. À remplacer
          impérativement par un RBAC vérifié côté serveur (Supabase) + MFA. Ne pas pousser cette
          garde en production telle quelle.
        </p>
      </div>

      <nav aria-label="Sections de l'administration" className="rounded-lg border border-border bg-card/40 p-3 text-sm">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href="#dashboard"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Tableau de bord
            </Link>
          </li>
          <li>
            <Link
              href="#products"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Produits
            </Link>
          </li>
          <li>
            <Link
              href="#orders"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Commandes
            </Link>
          </li>
        </ul>
      </nav>

      <DashboardSection />
      <ProductsAdminSection />
      <OrdersAdminSection />
    </div>
  );
}
