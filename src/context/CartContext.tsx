'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useToast } from '@/components/ui/use-toast';
import type { Product } from '@/lib/data';
import { useAuth } from '@/context/AuthContext';

export type SubscriptionDuration = 'monthly' | 'annual' | 'per_user';

export type CartItem = Product & {
  subscriptionDuration: SubscriptionDuration;
  quantity: number;
  cartId: string;
};

type CartContextValue = {
  cartItems: CartItem[];
  /** False during SSR and the first client paint, true after the localStorage read. */
  hydrated: boolean;
  addToCart: (product: Product, subscriptionDuration?: SubscriptionDuration, quantity?: number) => void;
  removeFromCart: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  updateSubscriptionDuration: (cartId: string, duration: SubscriptionDuration) => void;
  clearCart: () => void;
  getItemPrice: (item: CartItem) => number;
  getCartTotal: () => number;
  getCartItemCount: () => number;
  isInCart: (productId: string) => boolean;
};

// Per-user namespacing: the cart is keyed by the authenticated user id
// (anonymous visitors share a single bucket). Before this, the bare 'cart'
// key was shared across every account on the same browser, so user B
// could see user A's items after a logout/login on the same machine
// (ANO-C01).
const LEGACY_CART_KEY = 'cart';
const ANONYMOUS_CART_KEY = 'cart:anonymous';
const userCartKey = (userId: string): string => `cart:${userId}`;

function readCart(key: string): CartItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(key: string, items: CartItem[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

/**
 * Coalesce two cart snapshots: items with the same product id + duration
 * have their quantities summed; everything else is kept. Used when an
 * anonymous visitor signs in and we fold cart:anonymous into the new
 * cart:{userId} so they don't lose what they just added.
 */
function mergeCarts(target: CartItem[], incoming: CartItem[]): CartItem[] {
  const out: CartItem[] = target.map((it) => ({ ...it }));
  for (const item of incoming) {
    const idx = out.findIndex(
      (r) => r.id === item.id && r.subscriptionDuration === item.subscriptionDuration,
    );
    if (idx >= 0) {
      out[idx] = { ...out[idx], quantity: out[idx].quantity + item.quantity };
    } else {
      out.push({ ...item });
    }
  }
  return out;
}

const CartContext = createContext<CartContextValue | null>(null);

export const useCart = (): CartContextValue => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser, loading: authLoading } = useAuth();
  const userId = currentUser?.id ?? null;

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const { toast } = useToast();

  // The userId the in-memory cart was last loaded for. `undefined` means
  // we have not done the first load yet (legacy migration still pending).
  const loadedForRef = useRef<string | null | undefined>(undefined);
  // When we swap the active cart on a userId change, the next pass of the
  // write effect would otherwise rewrite the PREVIOUS user's cartItems
  // into the NEW key (the setCartItems from the hydrate effect has not
  // flushed yet). This ref tells the write effect to skip that one stray
  // flush. Without it, B's cart would get overwritten by A's items at the
  // moment auth flips to B.
  const skipNextWriteRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    const targetKey = userId === null ? ANONYMOUS_CART_KEY : userCartKey(userId);

    // First run on this client: handle the legacy bare 'cart' key left
    // by older builds. If the user is anonymous, fold its contents into
    // cart:anonymous; if a user is logged in we cannot safely attribute
    // it to anyone, so we just drop it.
    if (loadedForRef.current === undefined) {
      const legacy = localStorage.getItem(LEGACY_CART_KEY);
      if (legacy !== null) {
        if (userId === null) {
          try {
            const parsed = JSON.parse(legacy) as unknown;
            if (Array.isArray(parsed) && parsed.length > 0) {
              const merged = mergeCarts(
                readCart(ANONYMOUS_CART_KEY),
                parsed as CartItem[],
              );
              writeCart(ANONYMOUS_CART_KEY, merged);
            }
          } catch {
            /* legacy payload corrupted — just drop it */
          }
        }
        localStorage.removeItem(LEGACY_CART_KEY);
      }
    }

    const previous = loadedForRef.current;

    // Anonymous → user transition: fold cart:anonymous into cart:{userId}
    // so a visitor that just added items doesn't lose them by signing in.
    if (previous === null && userId !== null) {
      const anon = readCart(ANONYMOUS_CART_KEY);
      if (anon.length > 0) {
        const merged = mergeCarts(readCart(targetKey), anon);
        writeCart(targetKey, merged);
        localStorage.removeItem(ANONYMOUS_CART_KEY);
      }
    }

    skipNextWriteRef.current = true;
    setCartItems(readCart(targetKey));
    loadedForRef.current = userId;
    setHydrated(true);
  }, [authLoading, userId]);

  useEffect(() => {
    if (!hydrated || authLoading) return;
    if (skipNextWriteRef.current) {
      skipNextWriteRef.current = false;
      return;
    }
    const targetKey = userId === null ? ANONYMOUS_CART_KEY : userCartKey(userId);
    writeCart(targetKey, cartItems);
  }, [cartItems, hydrated, authLoading, userId]);

  const addToCart: CartContextValue['addToCart'] = (product, subscriptionDuration = 'monthly', quantity = 1) => {
    // Defensive guard: out-of-stock products must never reach the cart,
    // even if a UI button was bypassed (URL action, stale state, future
    // route handler). 'Limité' still allows purchase per business rules.
    if (product.stock_status === 'Rupture de Stock') {
      toast({
        title: 'Produit indisponible',
        description: `${product.name} est actuellement en rupture de stock.`,
        variant: 'destructive',
      });
      return;
    }
    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.id === product.id && item.subscriptionDuration === subscriptionDuration,
      );
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        toast({ title: 'Cart updated', description: `${product.name} quantity increased.` });
        return updated;
      }
      const newItem: CartItem = {
        ...product,
        subscriptionDuration,
        quantity,
        cartId: `${product.id}-${subscriptionDuration}-${Date.now()}`,
      };
      toast({ title: 'Added to cart', description: `${product.name} has been added to your cart.` });
      return [...prev, newItem];
    });
  };

  const removeFromCart = (cartId: string) => {
    setCartItems((prev) => {
      const item = prev.find((i) => i.cartId === cartId);
      if (item) {
        toast({
          title: 'Removed from cart',
          description: `${item.name} has been removed from your cart.`,
        });
      }
      return prev.filter((i) => i.cartId !== cartId);
    });
  };

  const updateQuantity = (cartId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartId);
      return;
    }
    setCartItems((prev) => prev.map((item) => (item.cartId === cartId ? { ...item, quantity } : item)));
  };

  const updateSubscriptionDuration = (cartId: string, duration: SubscriptionDuration) => {
    setCartItems((prev) =>
      prev.map((item) => (item.cartId === cartId ? { ...item, subscriptionDuration: duration } : item)),
    );
  };

  const clearCart = () => {
    setCartItems([]);
    toast({ title: 'Cart cleared', description: 'All items have been removed from your cart.' });
  };

  const getItemPrice = (item: CartItem): number => {
    switch (item.subscriptionDuration) {
      case 'annual':
        return item.price_annual ?? 0;
      case 'per_user':
        return item.price_per_user ?? 0;
      case 'monthly':
      default:
        return item.price_monthly ?? 0;
    }
  };

  const getCartTotal = () =>
    cartItems.reduce((total, item) => total + getItemPrice(item) * item.quantity, 0);

  const getCartItemCount = () =>
    cartItems.reduce((count, item) => count + item.quantity, 0);

  const isInCart = (productId: string) => cartItems.some((item) => item.id === productId);

  const value: CartContextValue = {
    cartItems,
    hydrated,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateSubscriptionDuration,
    clearCart,
    getItemPrice,
    getCartTotal,
    getCartItemCount,
    isInCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
