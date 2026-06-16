'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { safeRedirectTarget } from '@/features/auth/redirect';
import PersonalInfoSection from '@/features/account/PersonalInfoSection';
import AddressBookSection from '@/features/account/AddressBookSection';
import PaymentMethodsSection from '@/features/account/PaymentMethodsSection';

const MY_ACCOUNT_PATH = '/my-account';

const AccountSkeleton = () => (
  <div className="space-y-6" aria-busy="true" aria-live="polite">
    {[0, 1, 2].map((row) => (
      <div
        key={row}
        className="h-48 animate-pulse rounded-lg border border-border bg-card/40"
        aria-hidden="true"
      />
    ))}
    <span className="sr-only">Chargement de votre compte…</span>
  </div>
);

export default function MyAccountView() {
  const router = useRouter();
  const { isAuthenticated, loading, currentUser, logout } = useAuth();

  // FIXME-SECURITY: client-side guard, UX only. The real authorisation
  // check will live in the Supabase middleware that validates the JWT in
  // the session cookie before the page renders. Do NOT rely on this
  // useEffect for security; treat it as a redirect-for-UX.
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      // safeRedirectTarget ensures the `from` we just built is itself a
      // same-origin path (it is, but routed through the guard for
      // symmetry with the rest of the auth flows).
      const fromParam = encodeURIComponent(safeRedirectTarget(MY_ACCOUNT_PATH));
      router.replace(`/login?from=${fromParam}`);
    }
  }, [loading, isAuthenticated, router]);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  if (loading || !isAuthenticated || !currentUser) {
    return <AccountSkeleton />;
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Mon compte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connecté en tant que{' '}
            <span className="font-medium text-foreground">{currentUser.email}</span>
          </p>
        </div>
        <Button type="button" variant="outline" onClick={handleLogout} className="self-start sm:self-auto">
          <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />
          Se déconnecter
        </Button>
      </header>

      <nav aria-label="Sections de mon compte" className="rounded-lg border border-border bg-card/40 p-3 text-sm">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href="#personal-info"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Informations personnelles
            </Link>
          </li>
          <li>
            <Link
              href="#addresses"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Carnet d&apos;adresses
            </Link>
          </li>
          <li>
            <Link
              href="#payment-methods"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Méthodes de paiement
            </Link>
          </li>
          <li>
            <Link
              href="/orders"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Historique des commandes →
            </Link>
          </li>
        </ul>
      </nav>

      <PersonalInfoSection />
      <AddressBookSection />
      <PaymentMethodsSection />
    </div>
  );
}
