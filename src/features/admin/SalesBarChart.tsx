'use client';

import type { DailySales } from './demoStats';

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 140;
const PADDING_Y = 18;
const PADDING_X = 6;
const formatPrice = (value: number) => `$${value.toLocaleString('fr-FR')}`;

const formatDay = (iso: string): string => {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit' }).format(date);
};

type Props = { data: DailySales[] };

export default function SalesBarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Aucune donnée à afficher.
      </p>
    );
  }

  const max = Math.max(...data.map((entry) => entry.amount), 1);
  const innerHeight = VIEWBOX_HEIGHT - PADDING_Y * 2;
  const barCount = data.length;
  const slot = (VIEWBOX_WIDTH - PADDING_X * 2) / barCount;
  const barWidth = slot * 0.6;

  const description = data
    .map((entry) => `${formatDay(entry.date)} : ${formatPrice(entry.amount)}`)
    .join('. ');

  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        role="img"
        aria-labelledby="sales-bar-title"
        aria-describedby="sales-bar-desc"
        className="h-44 w-full text-foreground"
      >
        <title id="sales-bar-title">Ventes des 7 derniers jours (données démo)</title>
        <desc id="sales-bar-desc">{description}</desc>

        <line
          x1={PADDING_X}
          x2={VIEWBOX_WIDTH - PADDING_X}
          y1={VIEWBOX_HEIGHT - PADDING_Y}
          y2={VIEWBOX_HEIGHT - PADDING_Y}
          className="stroke-border"
          strokeWidth="1"
        />

        {data.map((entry, index) => {
          const height = Math.max(2, (entry.amount / max) * innerHeight);
          const x = PADDING_X + slot * index + (slot - barWidth) / 2;
          const y = VIEWBOX_HEIGHT - PADDING_Y - height;
          return (
            <g key={entry.date}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx="2"
                className="fill-primary"
                role="presentation"
              />
              <text
                x={x + barWidth / 2}
                y={VIEWBOX_HEIGHT - PADDING_Y + 12}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: '8px' }}
              >
                {formatDay(entry.date)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Accessible textual alternative — visible to assistive tech only. */}
      <table className="sr-only">
        <caption>Ventes des 7 derniers jours (données démo)</caption>
        <thead>
          <tr>
            <th scope="col">Jour</th>
            <th scope="col">Montant</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.date}>
              <th scope="row">{formatDay(entry.date)}</th>
              <td>{formatPrice(entry.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <figcaption className="text-xs text-muted-foreground">
        Données démo — ventes journalières simulées.
      </figcaption>
    </figure>
  );
}
