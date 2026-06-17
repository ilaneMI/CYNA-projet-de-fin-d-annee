/**
 * UX-side validators only.
 *
 * Password hashing and the actual credential check live entirely in
 * Supabase Auth (bcrypt server-side, JWT-signed sessions). These
 * helpers exist to surface a same-feedback loop in the form before
 * the request leaves the browser. They are NOT a security boundary —
 * Supabase re-asserts both rules on the server.
 */

export type PasswordValidation = {
  isValid: boolean;
  errors: string[];
};

export const validatePassword = (password: string): PasswordValidation => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Le mot de passe doit contenir au moins 8 caractères.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une majuscule.');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre.');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un caractère spécial.');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
