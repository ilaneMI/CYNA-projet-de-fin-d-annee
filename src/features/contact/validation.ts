import { validateEmail } from '@/lib/auth';
import type { ContactErrors, ContactMessage } from './types';

const MIN_SUBJECT = 3;
const MIN_MESSAGE = 10;

export const validateContact = (form: ContactMessage): ContactErrors => {
  const errors: ContactErrors = {};
  if (!form.email.trim()) {
    errors.email = "L'email est requis.";
  } else if (!validateEmail(form.email.trim())) {
    errors.email = "Format d'email invalide.";
  }
  if (!form.subject.trim()) {
    errors.subject = 'Le sujet est requis.';
  } else if (form.subject.trim().length < MIN_SUBJECT) {
    errors.subject = `Le sujet doit faire au moins ${MIN_SUBJECT} caractères.`;
  }
  if (!form.message.trim()) {
    errors.message = 'Le message est requis.';
  } else if (form.message.trim().length < MIN_MESSAGE) {
    errors.message = `Le message doit faire au moins ${MIN_MESSAGE} caractères.`;
  }
  return errors;
};

export const hasContactErrors = (errors: ContactErrors): boolean =>
  Object.values(errors).some(Boolean);
