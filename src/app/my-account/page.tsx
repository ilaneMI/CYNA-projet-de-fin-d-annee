import type { Metadata } from 'next';
import MyAccountView from './MyAccountView';

export const metadata: Metadata = {
  title: 'Mon compte — Cyna',
  description: 'Gérez vos informations personnelles, vos adresses et vos méthodes de paiement.',
  robots: { index: false, follow: false },
};

export default function MyAccountPage() {
  return (
    <div className="bg-background py-10 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <MyAccountView />
      </div>
    </div>
  );
}
