'use client';

import { useState, type FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

/**
 * Zone danger — demande de suppression de compte (RGPD).
 *
 * Non destructif côté client : ne supprime rien, ne clôt pas la session.
 * Crée une entrée dans `contact_messages` avec un sujet préfixé `[RGPD]`
 * qu'un admin voit dans `MessagesAdminSection` et traite via le runbook
 * `docs/RGPD-suppression-compte.md`.
 *
 * Re-auth par `signInWithPassword` — même pattern que `updatePassword` dans
 * AuthContext (ligne 289-295) : le SDK swap les tokens en place, la session
 * courante n'est pas cassée.
 */

const RGPD_SUBJECT = '[RGPD] Demande de suppression de compte';
const RGPD_MESSAGE_BODY =
  "Demande de suppression de compte au titre du droit à l'effacement RGPD.";

export default function AccountDeletionSection() {
  const t = useTranslations('account.deletion');
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const resetModal = () => {
    setPassword('');
    setError('');
    setBusy(false);
  };

  const closeModal = () => {
    setOpen(false);
    resetModal();
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!currentUser) return;
    if (!password) {
      setError(t('error.passwordRequired'));
      return;
    }
    setError('');
    setBusy(true);

    // 1) Re-auth : vérifie l'identité sans casser la session (SDK swap
    //    tokens en place, comportement identique à updatePassword).
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password,
    });
    if (signInErr) {
      setBusy(false);
      setError(t('error.passwordIncorrect'));
      return;
    }

    // 2) INSERT contact_messages. RLS INSERT policy autorise
    //    user_id = auth.uid() ; status default 'new' côté DB.
    const { error: insertErr } = await supabase.from('contact_messages').insert({
      user_id: currentUser.id,
      name: currentUser.full_name ?? currentUser.email,
      email: currentUser.email,
      subject: RGPD_SUBJECT,
      message: RGPD_MESSAGE_BODY,
    });
    setBusy(false);
    if (insertErr) {
      setError(t('error.submitFailed'));
      return;
    }

    toast({
      title: t('toast.success.title'),
      description: t('toast.success.description'),
    });
    closeModal();
  }

  return (
    <section
      id="account-deletion"
      aria-labelledby="account-deletion-heading"
      className="space-y-4"
    >
      <header>
        <h2
          id="account-deletion-heading"
          className="text-xl font-bold text-foreground"
        >
          {t('heading')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subheading')}</p>
      </header>

      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
        <p className="text-sm text-foreground">{t('explanation')}</p>
        <div className="mt-4">
          <Button
            type="button"
            variant="destructive"
            onClick={() => setOpen(true)}
          >
            {t('button')}
          </Button>
        </div>
      </div>

      <Dialog.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : closeModal())}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border border-border bg-card p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10"
              >
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </span>
              <div className="flex-1 space-y-1.5">
                <Dialog.Title className="text-base font-semibold text-foreground">
                  {t('modal.title')}
                </Dialog.Title>
                <Dialog.Description className="text-sm text-muted-foreground">
                  {t('modal.description')}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label={t('modal.cancel')}
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="deletion-password"
                  className="text-sm font-medium text-foreground"
                >
                  {t('modal.passwordLabel')}
                </label>
                <input
                  id="deletion-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('modal.passwordPlaceholder')}
                  disabled={busy}
                  aria-describedby={error ? 'deletion-error' : undefined}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {error && (
                <p
                  id="deletion-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={busy}
                  className={cn(buttonVariants({ variant: 'outline', size: 'default' }))}
                >
                  {t('modal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={busy || !password}
                  className={cn(buttonVariants({ variant: 'destructive', size: 'default' }))}
                >
                  {busy ? t('modal.busy') : t('modal.confirm')}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
