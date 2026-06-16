'use client';

import { Check } from 'lucide-react';
import type { CheckoutStep } from './types';

const STEPS: { number: CheckoutStep; title: string }[] = [
  { number: 1, title: 'Authentification' },
  { number: 2, title: 'Facturation' },
  { number: 3, title: 'Paiement' },
  { number: 4, title: 'Confirmation' },
];

type Props = { current: CheckoutStep };

export default function StepIndicator({ current }: Props) {
  return (
    <ol aria-label="Étapes du paiement" className="flex items-center">
      {STEPS.map((step, index) => {
        const isComplete = current > step.number;
        const isCurrent = current === step.number;
        return (
          <li
            key={step.number}
            className={index < STEPS.length - 1 ? 'flex flex-1 items-center' : 'flex items-center'}
          >
            <div className="flex flex-col items-center">
              <div
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors sm:h-12 sm:w-12 sm:text-base ${
                  isComplete
                    ? 'bg-primary text-primary-foreground'
                    : isCurrent
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/30'
                      : 'bg-secondary text-muted-foreground'
                }`}
              >
                {isComplete ? <Check aria-hidden="true" className="h-5 w-5" /> : step.number}
                <span className="sr-only">
                  {isComplete ? 'Étape terminée :' : isCurrent ? 'Étape en cours :' : 'Étape :'} {step.title}
                </span>
              </div>
              <span
                className={`mt-2 hidden text-xs sm:block ${
                  isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                aria-hidden="true"
                className={`mx-2 h-0.5 flex-1 transition-colors ${
                  isComplete ? 'bg-primary' : 'bg-secondary'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
