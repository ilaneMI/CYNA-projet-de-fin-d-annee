'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { validateEmail, validatePassword } from '@/lib/auth';
import { useToast } from '@/components/ui/use-toast';

export type UserRole = 'client' | 'admin';

export type CurrentUser = {
  id: string;
  email: string;
  full_name?: string;
  /** Role from public.profiles. Drives the admin gate (sub-step 3). */
  role: UserRole;
};

type Result<T = unknown> = { success: true; data?: T } | { success: false; error: string };

type AuthContextValue = {
  currentUser: CurrentUser | null;
  isAuthenticated: boolean;
  /** SSR hydration anti-mismatch flag: true until the initial session is resolved. */
  loading: boolean;
  register: (email: string, password: string, fullName: string) => Promise<Result>;
  login: (email: string, password: string) => Promise<Result>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<Result>;
  updateProfile: (updates: Partial<CurrentUser>) => Promise<Result>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<Result>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Erreur inconnue';

/**
 * Maps Supabase auth error strings (English) to the French UI messages
 * the app was already showing. Unknown errors fall through unchanged.
 */
const mapAuthError = (raw: string): string => {
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'Identifiants invalides.';
  }
  if (m.includes('already registered') || m.includes('user already')) {
    return 'Un compte existe déjà avec cet email.';
  }
  if (m.includes('email not confirmed')) {
    return 'Email non confirmé. Vérifiez votre boîte de réception.';
  }
  if (m.includes('email rate limit') || m.includes('too many requests')) {
    return 'Trop de tentatives. Réessayez dans quelques minutes.';
  }
  return raw;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: UserRole;
};

/**
 * Reads the per-user metadata from public.profiles. The RLS policy
 * `profiles_self_or_admin_read` already gates this to the calling user
 * (or admins), so no extra check is needed here.
 */
const fetchProfile = async (userId: string, email: string): Promise<CurrentUser | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as ProfileRow;
  return {
    id: row.id,
    email,
    full_name: row.full_name ?? undefined,
    role: row.role,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    // Resolve the initial session at mount, then keep it in sync with
    // refresh-token rotations and sign-outs from other tabs.
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session?.user) {
        const profile = await fetchProfile(session.user.id, session.user.email ?? '');
        if (!mounted) return;
        if (profile) {
          setCurrentUser(profile);
          setIsAuthenticated(true);
        }
      }
      setLoading(false);
    })();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id, session.user.email ?? '');
          if (!mounted) return;
          if (profile) {
            setCurrentUser(profile);
            setIsAuthenticated(true);
          }
        } else {
          if (!mounted) return;
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      })();
    });

    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
    };
  }, []);

  const register = async (email: string, password: string, fullName: string): Promise<Result> => {
    try {
      if (!validateEmail(email)) {
        throw new Error("Format d'email invalide.");
      }
      const policy = validatePassword(password);
      if (!policy.isValid) {
        throw new Error(policy.errors.join('. '));
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw new Error(mapAuthError(error.message));

      // The profile row is created by the on_auth_user_created trigger.
      // With "Confirm email" disabled in the dashboard, the session is
      // returned immediately; onAuthStateChange picks it up and fetches
      // the profile.
      toast({
        title: 'Inscription réussie !',
        description: 'Vous êtes maintenant connecté.',
      });
      return { success: true, data };
    } catch (err) {
      const message = errorMessage(err);
      toast({ title: "Échec de l'inscription", description: message, variant: 'destructive' });
      return { success: false, error: message };
    }
  };

  const login = async (email: string, password: string): Promise<Result> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(mapAuthError(error.message));
      // currentUser / isAuthenticated populated by onAuthStateChange.
      toast({ title: 'Bon retour !', description: 'Vous êtes connecté.' });
      return { success: true, data };
    } catch (err) {
      const message = errorMessage(err);
      toast({ title: 'Échec de la connexion', description: message, variant: 'destructive' });
      return { success: false, error: message };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
      // onAuthStateChange clears the user.
      toast({ title: 'Déconnecté', description: 'Vous êtes déconnecté.' });
    } catch (err) {
      toast({
        title: 'Échec de la déconnexion',
        description: errorMessage(err),
        variant: 'destructive',
      });
    }
  };

  const resetPassword = async (email: string): Promise<Result> => {
    try {
      if (!validateEmail(email)) {
        throw new Error("Format d'email invalide.");
      }
      // redirectTo doit être une URL ABSOLUE et présente dans la
      // allow-list "Redirect URLs" du dashboard Supabase, sinon le service
      // retombe sur le Site URL et perd notre token côté /reset-password.
      // `window.location.origin` est correct sur les 3 surfaces (dev,
      // staging, prod) tant que chacune a son origin déclarée dans la
      // dashboard config.
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/reset-password`
          : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw new Error(mapAuthError(error.message));
      // Pas de toast ici : la page appelante affiche un message NEUTRE
      // anti-énumération ("si un compte existe…"). Un toast "email envoyé"
      // confirmerait l'existence du compte à un attaquant qui sait lire un
      // toast — autant garder le canal unique.
      return { success: true };
    } catch (err) {
      const message = errorMessage(err);
      // Erreur réseau / format : on remonte sans toast, la page gère.
      return { success: false, error: message };
    }
  };

  const updateProfile = async (updates: Partial<CurrentUser>): Promise<Result> => {
    try {
      if (!currentUser) throw new Error('Non authentifié.');

      // The column grants on public.profiles only allow `authenticated`
      // to update `full_name`. Any other field (role, is_active, email)
      // is silently dropped here so the SQL call never gets rejected.
      const allowed: { full_name?: string | null } = {};
      if ('full_name' in updates) {
        allowed.full_name = updates.full_name ?? null;
      }

      if (Object.keys(allowed).length > 0) {
        const { error } = await supabase
          .from('profiles')
          .update(allowed)
          .eq('id', currentUser.id);
        if (error) throw new Error(error.message);
      }

      const next = await fetchProfile(currentUser.id, currentUser.email);
      if (next) setCurrentUser(next);

      toast({
        title: 'Profil mis à jour',
        description: 'Vos informations ont été mises à jour.',
      });
      return { success: true };
    } catch (err) {
      const message = errorMessage(err);
      toast({ title: 'Échec de la mise à jour', description: message, variant: 'destructive' });
      return { success: false, error: message };
    }
  };

  const updatePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<Result> => {
    try {
      if (!currentUser) throw new Error('Non authentifié.');

      const policy = validatePassword(newPassword);
      if (!policy.isValid) {
        throw new Error(policy.errors.join('. '));
      }

      // Supabase has no "verify current password" primitive — re-sign-in
      // with the supplied current password before applying the new one.
      // A successful signIn refreshes the session; a failure means the
      // current password was wrong and we surface the same FR message
      // the previous client-side flow used.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword,
      });
      if (signInErr) {
        throw new Error('Mot de passe actuel incorrect.');
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw new Error(mapAuthError(updateErr.message));

      toast({
        title: 'Mot de passe mis à jour',
        description: 'Votre mot de passe a été changé.',
      });
      return { success: true };
    } catch (err) {
      const message = errorMessage(err);
      toast({
        title: 'Échec du changement de mot de passe',
        description: message,
        variant: 'destructive',
      });
      return { success: false, error: message };
    }
  };

  const value: AuthContextValue = {
    currentUser,
    isAuthenticated,
    loading,
    register,
    login,
    logout,
    resetPassword,
    updateProfile,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
