'use client';

import type { CategoryAverageBasket } from './demoStats';

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 160;
const PADDING_X = 8;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 30;

const SERIES: Array<{
  key: 'monthly' | 'annual' | 'perUser';
  label: string;
  /** Tailwind utility translated to fill colour. */
  className: string;
}> = [
  { key: 'monthly', label: 'Mensuel', className: 'fill-primary' },
  { key: 'annual', label: 'Annuel', className: 'fill-primary/60' },
  { key: 'perUser', label: 'Par utilisateur', className: 'fill-primary/30' },
];

const formatPrice = (value: number) => `$${value.toLocaleString('fr-FR')}`;

type Props = { data: CategoryAverageBasket[] };

export default function CategoryBasketChart({ data }: Props) {
  if (data.length === 0) return null;

  const innerHeight = VIEWBOX_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const innerWidth = VIEWBOX_WIDTH - PADDING_X * 2;
  const groupSlot = innerWidth / data.length;
  const seriesCount = SERIES.length;
  const barWidth = (groupSlot * 0.7) / seriesCount;
  const max = Math.max(
    ...data.flatMap((entry) => [entry.monthly, entry.annual, entry.perUser]),
    1,
  );

  const description = data
    .map(
      (entry) =>
        `${entry.categoryName} : mensuel ${formatPrice(entry.monthly)}, annuel ${formatPrice(entry.annual)}, par utilisateur ${formatPrice(entry.perUser)}`,
    )
    .join('. ');

  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        role="img"
        aria-labelledby="basket-chart-title"
        aria-describedby="basket-chart-desc"
        className="h-48 w-full"
      >
        <title id="basket-chart-title">
          Panier moyen par catégorie et par durée d&apos;abonnement (données démo)
        </title>
        <desc id="basket-chart-desc">{description}</desc>

        <line
          x1={PADDING_X}
          x2={VIEWBOX_WIDTH - PADDING_X}
          y1={VIEWBOX_HEIGHT - PADDING_BOTTOM}
          y2={VIEWBOX_HEIGHT - PADDING_BOTTOM}
          className="stroke-border"
          strokeWidth="1"
        />

        {data.map((entry, index) => {
          const groupX = PADDING_X + groupSlot * index;
          return (
            <g key={entry.categoryId}>
              {SERIES.map((series, seriesIndex) => {
                const value = entry[series.key];
                const height = Math.max(1, (value / max) * innerHeight);
                const x =
                  groupX + (groupSlot - barWidth * seriesCount) / 2 + barWidth * seriesIndex;
                const y = VIEWBOX_HEIGHT - PADDING_BOTTOM - height;
                return (
                  <rect
                    key={series.key}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={height}
                    rx="1"
                    className={series.className}
                    role="presentation"
                  />
                );
              })}
              <text
                x={groupX + groupSlot / 2}
                y={VIEWBOX_HEIGHT - PADDING_BOTTOM + 12}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: '8px' }}
              >
                {entry.categoryName}
              </text>
            </g>
          );
        })}
      </svg>

      <ul aria-hidden="true" className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${series.className}`} aria-hidden="true" />
            {series.label}
          </li>
        ))}
      </ul>

      <table className="sr-only">
        <caption>Panier moyen par catégorie et par durée (données démo)</caption>
        <thead>
          <tr>
            <th scope="col">Catégorie</th>
            <th scope="col">Mensuel</th>
            <th scope="col">Annuel</th>
            <th scope="col">Par utilisateur</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.categoryId}>
              <th scope="row">{entry.categoryName}</th>
              <td>{formatPrice(entry.monthly)}</td>
              <td>{formatPrice(entry.annual)}</td>
              <td>{formatPrice(entry.perUser)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <figcaption className="text-xs text-muted-foreground">
        Données démo — panier moyen sur les 30 derniers jours.
      </figcaption>
    </figure>
  );
}
