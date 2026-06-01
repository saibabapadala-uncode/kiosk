// src/modules/kiosk/IdleWarning.tsx — visual layer only, all logic preserved
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface IdleWarningProps {
  isVisible: boolean;
  secondsRemaining: number;
  onDismiss: () => void;
}

const TOTAL_SECONDS = 10;
const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ringColor(s: number): string {
  if (s > 5) return 'var(--color-brand-primary)';
  if (s > 2) return 'var(--color-brand-accent)';
  return 'var(--color-brand-error)';
}

export default function IdleWarning({ isVisible, secondsRemaining, onDismiss }: IdleWarningProps) {
  const { t }    = useTranslation();
  const cardRef  = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef, isVisible);
  const depleted = CIRCUMFERENCE * ((TOTAL_SECONDS - secondsRemaining) / TOTAL_SECONDS);

  return (
    <div
      aria-modal="true"
      aria-live="assertive"
      aria-label="Idle warning"
      className={[
        'fixed inset-0 z-[9100] flex items-center justify-center p-6 transition-opacity duration-300',
        isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      ].join(' ')}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={onDismiss}
        style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}
      />

      {/* Card */}
      <div
        ref={cardRef}
        className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm p-8 text-center"
        style={{
          background:    'var(--color-ui-card)',
          border:        '1px solid var(--ui-glass-border)',
          borderRadius:  'var(--radius-2xl)',
          boxShadow:     'var(--ui-shadow)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* SVG countdown ring */}
        <div className="relative" aria-hidden="true">
          <svg width="120" height="120" viewBox="0 0 104 104">
            <circle cx="52" cy="52" r={RADIUS} fill="none" stroke="var(--color-brand-border)" strokeWidth="6"/>
            <circle
              cx="52" cy="52" r={RADIUS}
              fill="none"
              stroke={ringColor(secondsRemaining)}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={depleted}
              style={{ transform: 'rotate(-90deg)', transformOrigin: '52px 52px', transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center"
            aria-live="polite" aria-atomic="true">
            <span className="text-4xl font-bold font-brand" style={{ color: ringColor(secondsRemaining) }}>
              {secondsRemaining}
            </span>
          </div>
        </div>

        {/* Text */}
        <div>
          <h2 className="text-xl font-bold font-brand mb-1" style={{ color: 'var(--color-brand-text)' }}>
            {t('idle.stillThere')}
          </h2>
          <p className="text-sm font-brand leading-snug" style={{ color: 'var(--color-brand-muted)' }}>
            {t('idle.willClear', { count: secondsRemaining })}
          </p>
        </div>

        {/* Button */}
        <button
          onClick={onDismiss}
          aria-label={t('idle.imHere')}
          className="ui-btn-primary w-full py-4 text-lg"
          style={{ borderRadius: 'var(--radius-2xl)' }}
        >
          {t('idle.imHere')}
        </button>

        <p className="text-xs font-brand" style={{ color: 'var(--color-brand-muted)' }}>
          {t('idle.tapToContinue')}
        </p>
      </div>
    </div>
  );
}
