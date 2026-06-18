'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Bannière de consentement cookies.
 *
 * Storage : localStorage (clé `cyna-cookie-consent`, valeurs `'accepted'` |
 * `'rejected'`). Choix de localStorage plutôt qu'un cookie première partie
 * parce que (1) aucun script tiers n'est encore chargé donc la valeur n'a
 * pas besoin d'être lue côté serveur au rendu SSR, (2) cela évite la
 * configuration SameSite/Secure d'un cookie pour un usage purement client,
 * (3) le bouton « Supprimer les données du site » du navigateur réinitialise
 * la bannière naturellement.
 *
 * NOTE : tant que le site ne charge aucun tracker tiers, cette bannière
 * n'est qu'une mise en conformité de forme — elle enregistre le choix sans
 * rien gater. Quand des trackers seront ajoutés (Plausible, Matomo, etc.),
 * leur chargement devra être conditionné à la lecture de cette même clé.
 */

const STORAGE_KEY = 'cyna-cookie-consent';
type Choice = 'accepted' | 'rejected';

export default function CookieConsent() {
  // Rendered only after mount to avoid SSR/CSR mismatch on a value that
  // lives in the browser. Server output is empty; the banner is injected
  // by the first client effect when no choice has been recorded yet.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== 'accepted' && stored !== 'rejected') {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const decide = (choice: Choice) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Storage unavailable (private mode, quota). Close the banner anyway
      // so it does not trap the user; it will reappear on next load.
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 shadow-2xl backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5 lg:px-8">
        <div className="flex-1">
          <h2 id="cookie-consent-title" className="text-base font-semibold text-foreground">
            Cookies & confidentialité
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nous mémorisons votre choix dans votre navigateur (stockage local) afin de ne plus
            vous afficher ce bandeau. Aucun traceur publicitaire ni mesure d’audience tierce
            n’est déposé.{' '}
            <Link
              href="/confidentialite"
              className="text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              En savoir plus dans la politique de confidentialité.
            </Link>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <button
            type="button"
            onClick={() => decide('rejected')}
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Tout refuser
          </button>
          <button
            type="button"
            onClick={() => decide('accepted')}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  );
}
