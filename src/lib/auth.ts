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

export type PasswordRule = 'length' | 'uppercase' | 'lowercase' | 'digit' | 'special';

const RULE_MESSAGE: Record<PasswordRule, string> = {
  length: 'Le mot de passe doit contenir au moins 8 caractères.',
  uppercase: 'Le mot de passe doit contenir au moins une majuscule.',
  lowercase: 'Le mot de passe doit contenir au moins une minuscule.',
  digit: 'Le mot de passe doit contenir au moins un chiffre.',
  special: 'Le mot de passe doit contenir au moins un caractère spécial.',
};

const RULE_TESTERS: Record<PasswordRule, (password: string) => boolean> = {
  length: (password) => password.length >= 8,
  uppercase: (password) => /[A-Z]/.test(password),
  lowercase: (password) => /[a-z]/.test(password),
  digit: (password) => /[0-9]/.test(password),
  special: (password) => /[!@#$%^&*(),.?":{}|<>]/.test(password),
};

export const PASSWORD_RULES: PasswordRule[] = ['length', 'uppercase', 'lowercase', 'digit', 'special'];

export const checkPasswordRules = (password: string): Record<PasswordRule, boolean> => {
  return PASSWORD_RULES.reduce(
    (acc, rule) => {
      acc[rule] = RULE_TESTERS[rule](password);
      return acc;
    },
    {} as Record<PasswordRule, boolean>,
  );
};

export const validatePassword = (password: string): PasswordValidation => {
  const status = checkPasswordRules(password);
  const errors = PASSWORD_RULES.filter((rule) => !status[rule]).map((rule) => RULE_MESSAGE[rule]);
  return { isValid: errors.length === 0, errors };
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
