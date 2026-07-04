import type { Metadata } from 'next';
import CartView from './CartView';

export const metadata: Metadata = {
  title: 'Panier — Cyna',
  description: 'Vérifiez les solutions Cyna sélectionnées avant de procéder au paiement.',
  // Cart is user-specific and reads from localStorage at runtime — keep it out
  // of search indexes.
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartView />;
}
