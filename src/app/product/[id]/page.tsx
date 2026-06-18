import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, ChevronLeft } from 'lucide-react';
import {
  getCategoryById,
  getProductById,
  getProducts,
  getProductsByCategory,
  type StockStatus,
} from '@/lib/data';
import ProductCard from '@/components/ProductCard';
import ProductPurchase from './ProductPurchase';

type Params = { id: string };

/**
 * Pre-render one route per product known at build time and let admins add
 * new ones without a redeploy. Failure to reach Supabase at build time
 * degrades gracefully to an empty list so the build still finishes; the
 * missing routes are then generated on demand and cached by ISR.
 */
export async function generateStaticParams(): Promise<Params[]> {
  try {
    const products = await getProducts();
    return products.map((product) => ({ id: product.id }));
  } catch (err) {
    console.warn('[product/[id]] generateStaticParams: Supabase unreachable, deferring all routes to ISR.', err);
    return [];
  }
}

export const dynamicParams = true;
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await getProductById(params.id);
  if (!product) {
    return { title: 'Produit introuvable — Cyna' };
  }
  return {
    title: `${product.name} — Cyna`,
    description: product.description,
  };
}

const STOCK_BADGE: Record<StockStatus, string> = {
  'En Stock': 'border-green-800 bg-green-900/50 text-green-200',
  'Limité': 'border-yellow-800 bg-yellow-900/50 text-yellow-200',
  'Rupture de Stock': 'border-red-800 bg-red-900/50 text-red-200',
};

export default async function ProductPage({ params }: { params: Params }) {
  const product = await getProductById(params.id);
  if (!product) {
    notFound();
  }

  const [siblings, category] = await Promise.all([
    getProductsByCategory(product.category_id),
    getCategoryById(product.category_id),
  ]);

  const similarProducts = siblings.filter((sibling) => sibling.id !== product.id).slice(0, 3);
  const specs = Object.entries(product.technical_specs);

  return (
    <div className="bg-background py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav aria-label="Fil d'Ariane" className="mb-6">
          <Link
            href={category ? `/category/${category.id}` : '/catalogue'}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            {category ? `Retour à ${category.name}` : 'Retour au catalogue'}
          </Link>
        </nav>

        <article className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-lg sm:p-8">
            <h1 className="mb-3 text-2xl font-bold text-foreground sm:text-3xl">{product.name}</h1>

            <p
              className={`mb-6 inline-block rounded-full border px-3 py-1 text-sm font-semibold ${STOCK_BADGE[product.stock_status]}`}
              aria-label={`Disponibilité : ${product.stock_status}`}
            >
              {product.stock_status}
            </p>

            <p className="mb-8 text-muted-foreground">{product.description}</p>

            <ProductPurchase product={product} />
          </div>
        </article>

        {specs.length > 0 && (
          <section
            aria-labelledby="product-specs-heading"
            className="mt-12 rounded-xl border border-border bg-card p-6 shadow-lg sm:p-8"
          >
            <h2 id="product-specs-heading" className="mb-6 text-xl font-bold text-foreground sm:text-2xl">
              Spécifications techniques
            </h2>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {specs.map(([key, value]) => (
                <div key={key} className="flex items-start gap-3">
                  <Check aria-hidden="true" className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                  <div>
                    <dt className="font-semibold text-foreground">{key}</dt>
                    <dd className="text-muted-foreground">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>
        )}

        {similarProducts.length > 0 && (
          <section aria-labelledby="similar-products-heading" className="mt-12">
            <h2 id="similar-products-heading" className="mb-6 text-xl font-bold text-foreground sm:text-2xl">
              Services similaires
            </h2>
            <ul role="list" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similarProducts.map((sibling) => (
                <li key={sibling.id}>
                  <ProductCard product={sibling} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
