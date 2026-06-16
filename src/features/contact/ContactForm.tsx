'use client';

import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ContactErrors, ContactMessage } from './types';
import { hasContactErrors, validateContact } from './validation';

const emptyForm = (): ContactMessage => ({ email: '', subject: '', message: '' });

export default function ContactForm() {
  const [form, setForm] = useState<ContactMessage>(emptyForm);
  const [touched, setTouched] = useState<Partial<Record<keyof ContactMessage, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const errors: ContactErrors = useMemo(() => validateContact(form), [form]);

  const handleChange =
    (name: keyof ContactMessage) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [name]: event.target.value }));
    };

  const handleBlur = (name: keyof ContactMessage) => () => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (hasContactErrors(errors)) return;
    setSending(true);

    // TODO(supabase): POST to an Edge Function that validates the payload,
    // checks a honeypot / Turnstile token, inserts a row in
    // `contact_messages` (RLS: insert-only for `anon`), and notifies the
    // backoffice (email + Slack). Until then this is a UX-only placeholder
    // — nothing actually leaves the browser.
    await new Promise((resolve) => setTimeout(resolve, 800));

    setSending(false);
    setForm(emptyForm());
    setTouched({});
    setSubmitted(false);
    setConfirmation(
      "Merci ! Votre message a bien été enregistré localement. Le branchement Supabase enverra la notification au support.",
    );
  };

  const fields: Array<{
    name: keyof ContactMessage;
    label: string;
    type: 'email' | 'text' | 'textarea';
    autoComplete: string;
    placeholder: string;
  }> = [
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'votre@email.com' },
    {
      name: 'subject',
      label: 'Sujet',
      type: 'text',
      autoComplete: 'off',
      placeholder: 'Comment pouvons-nous vous aider ?',
    },
    {
      name: 'message',
      label: 'Message',
      type: 'textarea',
      autoComplete: 'off',
      placeholder: 'Décrivez votre besoin…',
    },
  ];

  return (
    <section
      aria-labelledby="contact-heading"
      className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <header className="mb-6">
        <h2 id="contact-heading" className="text-xl font-bold text-foreground sm:text-2xl">
          Contactez-nous
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Notre équipe vous répond sous 24 heures ouvrées.
        </p>
      </header>

      {confirmation ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm text-foreground"
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <div>
            <p>{confirmation}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setConfirmation(null)}
            >
              Envoyer un autre message
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-label="Formulaire de contact"
          data-contact="placeholder"
          className="space-y-5"
        >
          {fields.map((field) => {
            const errorId = `contact-${field.name}-error`;
            const showError = (touched[field.name] || submitted) && Boolean(errors[field.name]);
            const inputClass =
              'w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary';

            return (
              <div key={field.name}>
                <label htmlFor={`contact-${field.name}`} className="mb-1 block text-sm font-medium text-foreground">
                  {field.label}
                  <span aria-hidden="true" className="ml-0.5 text-destructive">
                    *
                  </span>
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    id={`contact-${field.name}`}
                    name={field.name}
                    rows={6}
                    required
                    value={form[field.name]}
                    onChange={handleChange(field.name)}
                    onBlur={handleBlur(field.name)}
                    aria-invalid={showError || undefined}
                    aria-describedby={showError ? errorId : undefined}
                    placeholder={field.placeholder}
                    className={`${inputClass} resize-vertical`}
                  />
                ) : (
                  <input
                    id={`contact-${field.name}`}
                    name={field.name}
                    type={field.type}
                    autoComplete={field.autoComplete}
                    required
                    value={form[field.name]}
                    onChange={handleChange(field.name)}
                    onBlur={handleBlur(field.name)}
                    aria-invalid={showError || undefined}
                    aria-describedby={showError ? errorId : undefined}
                    placeholder={field.placeholder}
                    className={inputClass}
                  />
                )}
                {showError && (
                  <p id={errorId} role="alert" className="mt-1 text-sm text-destructive">
                    {errors[field.name]}
                  </p>
                )}
              </div>
            );
          })}

          <Button type="submit" size="lg" disabled={sending} aria-busy={sending || undefined} className="w-full">
            <Send aria-hidden="true" className="mr-2 h-4 w-4" />
            {sending ? 'Envoi…' : 'Envoyer le message'}
          </Button>

          <p className="text-xs text-muted-foreground">
            En envoyant ce formulaire, vous acceptez que Cyna utilise vos coordonnées pour
            répondre à votre demande. Vos données seront conservées 12 mois (RGPD).
          </p>
        </form>
      )}
    </section>
  );
}
