'use client';

import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { BillingAddress, BillingErrors } from './types';
import { hasErrors, validateBilling } from './validation';

type Props = {
  initial: BillingAddress;
  onBack: () => void;
  onContinue: (data: BillingAddress) => void;
};

type FieldName = keyof BillingAddress;

type Field = {
  name: FieldName;
  label: string;
  type: 'text' | 'email' | 'tel';
  autoComplete: string;
  required: boolean;
  className: string; // grid-span helpers
  placeholder?: string;
};

const FIELDS: Field[] = [
  { name: 'firstName', label: 'Prénom', type: 'text', autoComplete: 'given-name', required: true, className: '' },
  { name: 'lastName', label: 'Nom', type: 'text', autoComplete: 'family-name', required: true, className: '' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', required: true, className: 'sm:col-span-2' },
  { name: 'address1', label: 'Adresse 1', type: 'text', autoComplete: 'address-line1', required: true, className: 'sm:col-span-2' },
  { name: 'address2', label: 'Adresse 2 (optionnel)', type: 'text', autoComplete: 'address-line2', required: false, className: 'sm:col-span-2' },
  { name: 'city', label: 'Ville', type: 'text', autoComplete: 'address-level2', required: true, className: '' },
  { name: 'region', label: 'Région', type: 'text', autoComplete: 'address-level1', required: true, className: '' },
  { name: 'postalCode', label: 'Code postal', type: 'text', autoComplete: 'postal-code', required: true, className: '' },
  { name: 'country', label: 'Pays', type: 'text', autoComplete: 'country-name', required: true, className: '' },
  { name: 'phone', label: 'Téléphone', type: 'tel', autoComplete: 'tel', required: true, className: 'sm:col-span-2' },
];

export default function Step2Billing({ initial, onBack, onContinue }: Props) {
  const [form, setForm] = useState<BillingAddress>(initial);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors: BillingErrors = useMemo(() => validateBilling(form), [form]);
  const summaryErrors = useMemo(
    () => Object.entries(errors).filter(([, message]) => Boolean(message)) as [FieldName, string][],
    [errors],
  );

  const handleChange = (name: FieldName) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [name]: event.target.value }));
  };

  const handleBlur = (name: FieldName) => () => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setTouched(
      FIELDS.reduce(
        (acc, field) => {
          acc[field.name] = true;
          return acc;
        },
        {} as Partial<Record<FieldName, boolean>>,
      ),
    );
    if (!hasErrors(errors)) {
      onContinue(form);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6" aria-labelledby="step-2-heading">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 id="step-2-heading" className="mb-1 text-lg font-semibold text-foreground">
          Informations de facturation
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Renseignez vos coordonnées de facturation. Les champs marqués d&apos;un astérisque sont
          obligatoires.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => {
            const errorId = `${field.name}-error`;
            const showError = (touched[field.name] || submitted) && Boolean(errors[field.name]);
            return (
              <div key={field.name} className={field.className}>
                <label htmlFor={field.name} className="mb-1 block text-sm font-medium text-foreground">
                  {field.label}
                  {field.required && (
                    <span aria-hidden="true" className="ml-0.5 text-destructive">
                      *
                    </span>
                  )}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  required={field.required}
                  value={form[field.name]}
                  onChange={handleChange(field.name)}
                  onBlur={handleBlur(field.name)}
                  aria-invalid={showError || undefined}
                  aria-describedby={showError ? errorId : undefined}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {showError && (
                  <p id={errorId} role="alert" className="mt-1 text-sm text-destructive">
                    {errors[field.name]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {submitted && summaryErrors.length > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="mb-2 font-semibold">Veuillez corriger les erreurs suivantes :</p>
          <ul className="list-inside list-disc space-y-1">
            {summaryErrors.map(([name, message]) => (
              <li key={name}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="outline" size="lg" onClick={onBack} className="sm:flex-1">
          Retour
        </Button>
        <Button type="submit" size="lg" className="sm:flex-1">
          Continuer vers le paiement
        </Button>
      </div>
    </form>
  );
}
