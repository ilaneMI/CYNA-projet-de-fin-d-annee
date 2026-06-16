'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import type { Address, AddressErrors } from './types';
import { deleteAddress, emptyAddress, listAddresses, upsertAddress } from './storage';

type FieldName = keyof Omit<Address, 'id'>;

type FieldSpec = {
  name: FieldName;
  label: string;
  type: 'text' | 'tel';
  autoComplete: string;
  required: boolean;
  full: boolean;
};

const FIELDS: FieldSpec[] = [
  { name: 'label', label: 'Étiquette (ex. Domicile)', type: 'text', autoComplete: 'off', required: true, full: true },
  { name: 'firstName', label: 'Prénom', type: 'text', autoComplete: 'given-name', required: true, full: false },
  { name: 'lastName', label: 'Nom', type: 'text', autoComplete: 'family-name', required: true, full: false },
  { name: 'address1', label: 'Adresse 1', type: 'text', autoComplete: 'address-line1', required: true, full: true },
  { name: 'address2', label: 'Adresse 2 (optionnel)', type: 'text', autoComplete: 'address-line2', required: false, full: true },
  { name: 'city', label: 'Ville', type: 'text', autoComplete: 'address-level2', required: true, full: false },
  { name: 'region', label: 'Région', type: 'text', autoComplete: 'address-level1', required: true, full: false },
  { name: 'postalCode', label: 'Code postal', type: 'text', autoComplete: 'postal-code', required: true, full: false },
  { name: 'country', label: 'Pays', type: 'text', autoComplete: 'country-name', required: true, full: false },
  { name: 'phone', label: 'Téléphone', type: 'tel', autoComplete: 'tel', required: true, full: true },
];

const POSTAL_REGEX = /^[A-Za-z0-9 \-]{3,10}$/;
const PHONE_REGEX = /^[+]?[\d\s()./-]{6,}$/;

const validateAddress = (address: Address): AddressErrors => {
  const errors: AddressErrors = {};
  if (!address.label.trim()) errors.label = "L'étiquette est requise.";
  if (!address.firstName.trim()) errors.firstName = 'Le prénom est requis.';
  if (!address.lastName.trim()) errors.lastName = 'Le nom est requis.';
  if (!address.address1.trim()) errors.address1 = "L'adresse est requise.";
  if (!address.city.trim()) errors.city = 'La ville est requise.';
  if (!address.region.trim()) errors.region = 'La région est requise.';
  if (!address.postalCode.trim()) {
    errors.postalCode = 'Le code postal est requis.';
  } else if (!POSTAL_REGEX.test(address.postalCode.trim())) {
    errors.postalCode = 'Code postal invalide.';
  }
  if (!address.country.trim()) errors.country = 'Le pays est requis.';
  if (!address.phone.trim()) {
    errors.phone = 'Le téléphone est requis.';
  } else if (!PHONE_REGEX.test(address.phone.trim())) {
    errors.phone = 'Numéro de téléphone invalide.';
  }
  return errors;
};

const hasErrors = (errors: AddressErrors): boolean => Object.values(errors).some(Boolean);

export default function AddressBookSection() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [draft, setDraft] = useState<Address | null>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setAddresses(listAddresses(currentUser.id));
    setHydrated(true);
  }, [currentUser]);

  const errors = useMemo<AddressErrors>(
    () => (draft ? validateAddress(draft) : {}),
    [draft],
  );

  const handleStartCreate = () => {
    setDraft(emptyAddress());
    setTouched({});
    setSubmitted(false);
  };

  const handleStartEdit = (address: Address) => {
    setDraft({ ...address });
    setTouched({});
    setSubmitted(false);
  };

  const handleCancel = () => {
    setDraft(null);
    setTouched({});
    setSubmitted(false);
  };

  const handleField = (name: FieldName, value: string) => {
    setDraft((prev) => (prev ? { ...prev, [name]: value } : prev));
  };

  const handleBlur = (name: FieldName) => () => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !draft) return;
    setSubmitted(true);
    if (hasErrors(errors)) return;
    const next = upsertAddress(currentUser.id, draft);
    setAddresses(next);
    setDraft(null);
    setTouched({});
    toast({
      title: 'Adresse enregistrée',
      description: `L'étiquette « ${draft.label} » a été enregistrée.`,
    });
  };

  const handleDelete = (address: Address) => {
    if (!currentUser) return;
    if (!window.confirm(`Supprimer l'adresse « ${address.label} » ?`)) return;
    const next = deleteAddress(currentUser.id, address.id);
    setAddresses(next);
    toast({ title: 'Adresse supprimée', description: address.label });
  };

  const summaryErrors = submitted
    ? (Object.entries(errors).filter(([, message]) => Boolean(message)) as [FieldName, string][])
    : [];

  return (
    <section id="addresses" aria-labelledby="addresses-heading" className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="addresses-heading" className="text-xl font-bold text-foreground sm:text-2xl">
            Carnet d&apos;adresses
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enregistrez vos adresses pour les retrouver au moment de la commande.
          </p>
        </div>
        {!draft && (
          <Button type="button" onClick={handleStartCreate} aria-controls="address-form">
            <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
            Ajouter une adresse
          </Button>
        )}
      </header>

      {!hydrated ? (
        <div
          aria-busy="true"
          aria-live="polite"
          className="h-32 animate-pulse rounded-lg border border-border bg-card/40"
        />
      ) : addresses.length === 0 && !draft ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center">
          <MapPin aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            Aucune adresse enregistrée pour le moment.
          </p>
        </div>
      ) : (
        <ul role="list" className="space-y-3">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <p className="mb-1 text-sm font-semibold text-foreground">{address.label}</p>
                <p className="text-sm text-muted-foreground">
                  {address.firstName} {address.lastName}
                  <br />
                  {address.address1}
                  {address.address2 ? `, ${address.address2}` : ''}
                  <br />
                  {address.postalCode} {address.city} — {address.region}
                  <br />
                  {address.country} · {address.phone}
                </p>
              </div>
              <div className="flex gap-2 self-end sm:self-start">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleStartEdit(address)}
                  aria-label={`Modifier l'adresse ${address.label}`}
                >
                  <Pencil aria-hidden="true" className="mr-1 h-4 w-4" />
                  Modifier
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(address)}
                  aria-label={`Supprimer l'adresse ${address.label}`}
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 aria-hidden="true" className="mr-1 h-4 w-4" />
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <form
          id="address-form"
          onSubmit={handleSubmit}
          noValidate
          aria-label="Formulaire d'adresse"
          className="rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            {addresses.some((entry) => entry.id === draft.id) ? 'Modifier l’adresse' : 'Nouvelle adresse'}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map((field) => {
              const errorId = `address-${field.name}-error`;
              const showError = (touched[field.name] || submitted) && Boolean(errors[field.name]);
              return (
                <div key={field.name} className={field.full ? 'sm:col-span-2' : undefined}>
                  <label htmlFor={`address-${field.name}`} className="mb-1 block text-sm font-medium text-foreground">
                    {field.label}
                    {field.required && (
                      <span aria-hidden="true" className="ml-0.5 text-destructive">
                        *
                      </span>
                    )}
                  </label>
                  <input
                    id={`address-${field.name}`}
                    name={field.name}
                    type={field.type}
                    autoComplete={field.autoComplete}
                    required={field.required}
                    value={draft[field.name]}
                    onChange={(event) => handleField(field.name, event.target.value)}
                    onBlur={handleBlur(field.name)}
                    aria-invalid={showError || undefined}
                    aria-describedby={showError ? errorId : undefined}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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

          {summaryErrors.length > 0 && (
            <div
              role="alert"
              aria-live="polite"
              className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <p className="mb-2 font-semibold">Veuillez corriger les erreurs suivantes :</p>
              <ul className="list-inside list-disc space-y-1">
                {summaryErrors.map(([name, message]) => (
                  <li key={name}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" onClick={handleCancel} className="sm:flex-1">
              Annuler
            </Button>
            <Button type="submit" className="sm:flex-1">
              Enregistrer
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
