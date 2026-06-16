'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { isEmailValid } from './validation';

type Props = {
  guestEmail: string;
  onContinueAsGuest: (email: string) => void;
  onContinueAsAuth: () => void;
};

export default function Step1Authentication({ guestEmail, onContinueAsGuest, onContinueAsAuth }: Props) {
  const { isAuthenticated, currentUser } = useAuth();
  const [emailDraft, setEmailDraft] = useState(guestEmail);
  const [touched, setTouched] = useState(false);

  // FIXME-SECURITY: this branch trusts the client-side `isAuthenticated` flag
  // to decide who is the customer. With Supabase Auth + middleware, the
  // server will assert identity from the JWT on every checkout API call —
  // the client decision below is only for UX, never for authorization.
  if (isAuthenticated && currentUser) {
    return (
      <section aria-labelledby="step-1-auth-heading" className="space-y-6">
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-6">
          <h2 id="step-1-auth-heading" className="mb-2 text-lg font-semibold text-foreground">
            Connecté en tant que
          </h2>
          <p className="text-foreground">{currentUser.email}</p>
        </div>
        <Button type="button" size="lg" className="w-full" onClick={onContinueAsAuth}>
          Continuer vers la facturation
        </Button>
      </section>
    );
  }

  const trimmedEmail = emailDraft.trim();
  const emailError = touched && !isEmailValid(trimmedEmail) ? "Format d'email invalide." : '';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (isEmailValid(trimmedEmail)) {
      onContinueAsGuest(trimmedEmail);
    }
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="step-1-login-heading" className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 id="step-1-login-heading" className="mb-3 text-lg font-semibold text-foreground">
          Vous avez un compte ?
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Connectez-vous pour récupérer votre historique et préremplir vos coordonnées.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/login" className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              Connexion
            </Button>
          </Link>
          <Link href="/register" className="flex-1">
            <Button type="button" variant="outline" className="w-full">
              Créer un compte
            </Button>
          </Link>
        </div>
      </section>

      <div className="relative flex items-center">
        <div className="flex-1 border-t border-border" aria-hidden="true" />
        <span className="px-3 text-xs uppercase tracking-wide text-muted-foreground">Ou</span>
        <div className="flex-1 border-t border-border" aria-hidden="true" />
      </div>

      <section aria-labelledby="step-1-guest-heading" className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 id="step-1-guest-heading" className="mb-3 text-lg font-semibold text-foreground">
          Continuer en tant qu&apos;invité
        </h2>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="guest-email" className="mb-1 block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="guest-email"
              type="email"
              autoComplete="email"
              required
              value={emailDraft}
              onChange={(event) => setEmailDraft(event.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={Boolean(emailError) || undefined}
              aria-describedby={emailError ? 'guest-email-error' : undefined}
              placeholder="votre@email.com"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p id="guest-email-error" role="alert" aria-live="polite" className="mt-1 min-h-[1.25rem] text-sm text-destructive">
              {emailError}
            </p>
          </div>
          <Button
            type="submit"
            size="lg"
            variant="secondary"
            className="w-full"
            disabled={!isEmailValid(trimmedEmail)}
          >
            Continuer
          </Button>
        </form>
      </section>
    </div>
  );
}
