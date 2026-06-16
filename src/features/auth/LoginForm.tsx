'use client';

import { useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { validateEmail } from '@/lib/auth';

type Props = {
  /** Called once the login succeeds. Receives the email that was used. */
  onSuccess: (email: string) => void;
};

/**
 * Pure login form. All credential handling goes through `useAuth().login()` —
 * we never hash, store or compare passwords here.
 *
 * FIXME-SECURITY: today `useAuth().login()` falls back to a client-side
 * SHA-256 hash in `lib/auth.ts` because Supabase Auth is not wired in yet
 * (the implementation is gated by SUPABASE_ENABLED). The whole flow will be
 * replaced by Supabase Auth (bcrypt + JWT, server-issued cookies). Do NOT
 * add any new hashing or credential storage here.
 */
export default function LoginForm({ onSuccess }: Props) {
  const { login, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  const canSubmit = validateEmail(email) && password.length > 0 && !submitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setFormError('');
    setSubmitting(true);
    // FIXME-SECURITY: `rememberMe` is read but unused — session duration is
    // not configurable with the temporary localStorage session. It will map
    // to Supabase Auth's persistSession option once the integration lands.
    const result = await login(email, password);
    setSubmitting(false);
    if (result.success) {
      onSuccess(email);
      return;
    }
    setFormError(result.error ?? 'Identifiants invalides.');
  };

  const handleReset = async () => {
    if (!validateEmail(resetEmail)) return;
    setResetSubmitting(true);
    await resetPassword(resetEmail);
    setResetSubmitting(false);
    setResetEmail('');
    setResetOpen(false);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-label="Formulaire de connexion">
        <div>
          <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="votre@email.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-foreground">
            Mot de passe
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
            />
            Se souvenir de moi
          </label>
          <button
            type="button"
            onClick={() => setResetOpen((open) => !open)}
            aria-expanded={resetOpen}
            aria-controls="login-reset-region"
            className="self-start text-sm text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:self-auto"
          >
            Mot de passe oublié ?
          </button>
        </div>

        <p
          id="login-error"
          role="alert"
          aria-live="polite"
          className="min-h-[1.5rem] text-sm text-destructive"
        >
          {formError}
        </p>

        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit}
          aria-busy={submitting || undefined}
          aria-describedby={formError ? 'login-error' : undefined}
          className="w-full"
        >
          {submitting ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>

      {resetOpen && (
        <div
          id="login-reset-region"
          role="region"
          aria-label="Réinitialisation du mot de passe"
          className="rounded-md border border-border bg-secondary/30 p-4"
        >
          <div className="mb-3 flex items-start gap-2">
            <Mail aria-hidden="true" className="mt-0.5 h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">
              Saisissez votre email, nous vous enverrons un lien de réinitialisation.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="reset-email" className="sr-only">
              Email pour la réinitialisation
            </label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              placeholder="votre@email.com"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleReset}
              disabled={!validateEmail(resetEmail) || resetSubmitting}
            >
              {resetSubmitting ? 'Envoi…' : 'Envoyer le lien'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
