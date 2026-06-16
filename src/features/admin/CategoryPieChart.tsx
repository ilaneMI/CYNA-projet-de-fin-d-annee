'use client';

import type { CategoryShare } from './demoStats';

const RADIUS = 70;
const CX = 90;
const CY = 90;
const SLICE_CLASSES = ['fill-primary', 'fill-primary/70', 'fill-primary/45', 'fill-primary/25'];

const polar = (angleRadians: number, radius: number) => ({
  x: CX + radius * Math.cos(angleRadians),
  y: CY + radius * Math.sin(angleRadians),
});

const buildArcPath = (startAngle: number, endAngle: number): string => {
  if (endAngle - startAngle >= Math.PI * 2 - 1e-9) {
    // Full circle: draw as a circle with two half arcs to keep SVG happy.
    return `M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 1 1 ${CX + RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 1 1 ${CX - RADIUS} ${CY} Z`;
  }
  const start = polar(startAngle, RADIUS);
  const end = polar(endAngle, RADIUS);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${CX} ${CY} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
};

const formatPercent = (share: number): string => `${Math.round(share * 100)}%`;
const formatPrice = (value: number): string => `$${value.toLocaleString('fr-FR')}`;

type Props = { data: CategoryShare[] };

export default function CategoryPieChart({ data }: Props) {
  if (data.length === 0) return null;

  let angle = -Math.PI / 2; // start at 12 o'clock
  const slices = data.map((entry, index) => {
    const start = angle;
    const span = entry.share * Math.PI * 2;
    const end = start + span;
    angle = end;
    return {
      entry,
      d: buildArcPath(start, end),
      className: SLICE_CLASSES[index % SLICE_CLASSES.length],
    };
  });

  const description = data
    .map((entry) => `${entry.categoryName} : ${formatPercent(entry.share)} (${formatPrice(entry.amount)})`)
    .join('. ');

  return (
    <figure className="space-y-3">
      <svg
        viewBox="0 0 180 180"
        role="img"
        aria-labelledby="pie-chart-title"
        aria-describedby="pie-chart-desc"
        className="mx-auto h-48 w-48"
      >
        <title id="pie-chart-title">Répartition des ventes par catégorie (données démo)</title>
        <desc id="pie-chart-desc">{description}</desc>
        {slices.map(({ entry, d, className }) => (
          <path key={entry.categoryId} d={d} className={`${className} stroke-card`} strokeWidth="1.5" />
        ))}
      </svg>

      <ul aria-label="Légende du camembert" className="grid grid-cols-2 gap-1.5 text-xs">
        {slices.map(({ entry, className }) => (
          <li key={entry.categoryId} className="flex items-center gap-2 text-muted-foreground">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${className}`} aria-hidden="true" />
            <span>
              <span className="text-foreground">{entry.categoryName}</span>{' '}
              <span className="text-muted-foreground">— {formatPercent(entry.share)}</span>
            </span>
          </li>
        ))}
      </ul>

      <table className="sr-only">
        <caption>Répartition des ventes par catégorie (données démo)</caption>
        <thead>
          <tr>
            <th scope="col">Catégorie</th>
            <th scope="col">Part</th>
            <th scope="col">Montant</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.categoryId}>
              <th scope="row">{entry.categoryName}</th>
              <td>{formatPercent(entry.share)}</td>
              <td>{formatPrice(entry.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <figcaption className="text-xs text-muted-foreground">
        Données démo — part de chiffre d&apos;affaires par catégorie.
      </figcaption>
    </figure>
  );
}
