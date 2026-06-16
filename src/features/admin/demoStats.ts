/**
 * Demo statistics rendered in the admin dashboard.
 *
 * These numbers are NOT real. They are kept in-source so the page can be
 * walked end-to-end without a backend and so reviewers can clearly see the
 * placeholder nature of the figures. Every chart that consumes them is
 * captioned "Données démo" so the UI matches the data.
 *
 * When Supabase + Stripe lands, these helpers are deleted and replaced by
 * server-side aggregates (materialised views or scheduled Edge Functions
 * writing to a `daily_sales` table).
 */

export type DailySales = {
  date: string; // YYYY-MM-DD
  amount: number;
};

export type CategoryAverageBasket = {
  categoryId: string;
  categoryName: string;
  monthly: number;
  annual: number;
  perUser: number;
};

export type CategoryShare = {
  categoryId: string;
  categoryName: string;
  share: number; // 0..1
  amount: number;
};

const SHORT_NAMES: Record<string, string> = {
  'cat-1': 'SOC',
  'cat-2': 'EDR',
  'cat-3': 'XDR',
  'cat-4': 'Intelligence',
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const subtractDays = (iso: string, days: number): string => {
  const d = new Date(iso);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

/** Seven-day rolling sales window ending today. Numbers are illustrative. */
export const demoSalesSeries = (): DailySales[] => {
  const today = todayIso();
  const base = [4200, 5100, 3800, 6200, 7400, 5900, 8100];
  return base.map((amount, index) => ({
    date: subtractDays(today, 6 - index),
    amount,
  }));
};

export const demoAverageBaskets = (): CategoryAverageBasket[] => [
  { categoryId: 'cat-1', categoryName: SHORT_NAMES['cat-1'], monthly: 2999, annual: 29990, perUser: 99 },
  { categoryId: 'cat-2', categoryName: SHORT_NAMES['cat-2'], monthly: 1599, annual: 15990, perUser: 29 },
  { categoryId: 'cat-3', categoryName: SHORT_NAMES['cat-3'], monthly: 6999, annual: 69990, perUser: 89 },
  { categoryId: 'cat-4', categoryName: SHORT_NAMES['cat-4'], monthly: 3999, annual: 39990, perUser: 199 },
];

export const demoCategoryShares = (): CategoryShare[] => {
  const raw = [
    { categoryId: 'cat-1', amount: 28000 },
    { categoryId: 'cat-2', amount: 18500 },
    { categoryId: 'cat-3', amount: 33500 },
    { categoryId: 'cat-4', amount: 12500 },
  ];
  const total = raw.reduce((sum, entry) => sum + entry.amount, 0);
  return raw.map((entry) => ({
    ...entry,
    categoryName: SHORT_NAMES[entry.categoryId] ?? entry.categoryId,
    share: entry.amount / total,
  }));
};
