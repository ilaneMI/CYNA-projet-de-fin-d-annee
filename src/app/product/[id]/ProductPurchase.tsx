'use client';

import { useState } from 'react';
import { FileText, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useCart, type SubscriptionDuration } from '@/context/CartContext';
import type { Product } from '@/lib/data';

const PRICE_BY_PLAN: Record<SubscriptionDuration, (p: Product) => number> = {
  monthly: (p) => p.price_monthly,
  annual: (p) => p.price_annual,
  per_user: (p) => p.price_per_user,
};

const PRICE_LABEL: Record<SubscriptionDuration, string> = {
  monthly: '/mois',
  annual: '/an',
  per_user: '/utilisateur/mois',
};

const formatPrice = (value: number) => `$${value.toLocaleString('fr-FR')}`;

type Props = { product: Product };

export default function ProductPurchase({ product }: Props) {
  const [plan, setPlan] = useState<SubscriptionDuration>('monthly');
  const { addToCart, isInCart } = useCart();
  const { toast } = useToast();

  const isOutOfStock = product.stock_status === 'Rupture de Stock';
  const alreadyInCart = isInCart(product.id);

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addToCart(product, plan, 1);
  };

  const handleRequestDemo = () => {
    // TODO(api): wire this to a contact endpoint (Supabase Edge Function or
    // /api/contact) once the demo-request flow is implemented. For now it's
    // purely a UX placeholder.
    toast({
      title: 'Demande de démo envoyée',
      description: 'Notre équipe commerciale vous contactera dans les 24 heures.',
    });
  };

  return (
    <div className="space-y-8">
      <Tabs
        value={plan}
        onValueChange={(value) => setPlan(value as SubscriptionDuration)}
        aria-label="Plans tarifaires"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monthly">Mensuel</TabsTrigger>
          <TabsTrigger value="annual">Annuel</TabsTrigger>
          <TabsTrigger value="per_user">Par utilisateur</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-6 text-center">
          <p className="text-4xl font-bold text-primary">{formatPrice(PRICE_BY_PLAN.monthly(product))}</p>
          <p className="text-muted-foreground">{PRICE_LABEL.monthly}</p>
        </TabsContent>
        <TabsContent value="annual" className="mt-6 text-center">
          <p className="text-4xl font-bold text-primary">{formatPrice(PRICE_BY_PLAN.annual(product))}</p>
          <p className="text-muted-foreground">{PRICE_LABEL.annual}</p>
          <p className="mt-2 text-sm text-green-400">Économisez 17% annuellement</p>
        </TabsContent>
        <TabsContent value="per_user" className="mt-6 text-center">
          <p className="text-4xl font-bold text-primary">{formatPrice(PRICE_BY_PLAN.per_user(product))}</p>
          <p className="text-muted-foreground">{PRICE_LABEL.per_user}</p>
          <p className="mt-2 text-sm text-muted-foreground/80">Prix flexible pour toute taille d&apos;équipe</p>
        </TabsContent>
      </Tabs>

      <div className="space-y-3">
        <Button
          type="button"
          size="lg"
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          aria-disabled={isOutOfStock}
          aria-pressed={!isOutOfStock && alreadyInCart}
          className="w-full py-6 text-lg shadow-lg"
        >
          <ShoppingCart aria-hidden="true" className="mr-2 h-5 w-5" />
          {isOutOfStock
            ? 'Produit indisponible'
            : alreadyInCart
              ? 'Déjà dans le panier'
              : 'Ajouter au panier'}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={handleRequestDemo}
          className="w-full border-primary py-6 text-lg text-primary hover:bg-primary/10"
        >
          <FileText aria-hidden="true" className="mr-2 h-5 w-5" />
          Demander une démo
        </Button>
      </div>
    </div>
  );
}
