import type { BillingAddress, BillingErrors } from './types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Generic loose phone match: digits, spaces, parentheses, dash, dots, and an
// optional leading `+`. Strict E.164 will be enforced server-side when the
// real order flow lands.
const PHONE_REGEX = /^[+]?[\d\s()./-]{6,}$/;
// Loose postal code match: 3 to 10 alphanumeric chars + spaces / dashes.
const POSTAL_REGEX = /^[A-Za-z0-9 \-]{3,10}$/;

export const isEmailValid = (value: string): boolean => EMAIL_REGEX.test(value.trim());

const required = (label: string) => `${label} est requis.`;

export const validateBilling = (form: BillingAddress): BillingErrors => {
  const errors: BillingErrors = {};

  if (!form.firstName.trim()) errors.firstName = required('Le prénom');
  if (!form.lastName.trim()) errors.lastName = required('Le nom');
  if (!form.email.trim()) {
    errors.email = required("L'email");
  } else if (!isEmailValid(form.email)) {
    errors.email = "Format d'email invalide.";
  }
  if (!form.address1.trim()) errors.address1 = required("L'adresse");
  if (!form.city.trim()) errors.city = required('La ville');
  if (!form.region.trim()) errors.region = required('La région');
  if (!form.postalCode.trim()) {
    errors.postalCode = required('Le code postal');
  } else if (!POSTAL_REGEX.test(form.postalCode.trim())) {
    errors.postalCode = 'Code postal invalide.';
  }
  if (!form.country.trim()) errors.country = required('Le pays');
  if (!form.phone.trim()) {
    errors.phone = required('Le téléphone');
  } else if (!PHONE_REGEX.test(form.phone.trim())) {
    errors.phone = 'Numéro de téléphone invalide.';
  }

  return errors;
};

export const hasErrors = (errors: BillingErrors): boolean =>
  Object.values(errors).some((message) => Boolean(message));

export const emptyBilling = (overrides: Partial<BillingAddress> = {}): BillingAddress => ({
  firstName: '',
  lastName: '',
  email: '',
  address1: '',
  address2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  phone: '',
  ...overrides,
});
