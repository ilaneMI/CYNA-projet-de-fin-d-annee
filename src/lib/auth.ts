export type PasswordValidation = {
  isValid: boolean;
  errors: string[];
};

export type PasswordRule = 'length' | 'uppercase' | 'lowercase' | 'digit' | 'special';

const RULE_MESSAGE: Record<PasswordRule, string> = {
  length: 'Password must be at least 8 characters long',
  uppercase: 'Password must contain at least one uppercase letter',
  lowercase: 'Password must contain at least one lowercase letter',
  digit: 'Password must contain at least one number',
  special: 'Password must contain at least one special character',
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

/**
 * Provisional client-side SHA-256 hash. TODO: remove when Supabase Auth is wired in.
 * Password hashing must happen server-side (bcrypt/argon2) per CLAUDE.md.
 */
export const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export const generateSessionToken = (): string =>
  Math.random().toString(36).substring(2) + Date.now().toString(36);
