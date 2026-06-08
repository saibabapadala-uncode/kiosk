// src/modules/payment/PaymentStatus.tsx — visual layer only
import { useTranslation } from 'react-i18next';

interface PaymentStatusProps {
  status: 'processing' | 'succeeded' | 'failed';
  error?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
}

// ─── Processing ────────────────────────────────────────────────────────────────

function Processing() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" aria-label="Processing payment"
      className="flex flex-col items-center justify-center flex-1 gap-8 px-8 text-center">

      {/* Gradient spinner ring */}
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 112 112">
          <circle cx="56" cy="56" r="48" fill="none" stroke="var(--color-brand-border)" strokeWidth="6"/>
          <circle
            cx="56" cy="56" r="48"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="301"
            strokeDashoffset="75"
            style={{
              stroke: 'var(--color-brand-primary)',
              animation: 'spin-ring 1.1s linear infinite',
              transformOrigin: '56px 56px',
            }}
          />
        </svg>
        {/* Inner icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--color-brand-primary)' }}>
            <rect x="1" y="4" width="22" height="16" rx="2"/>
            <line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
        </div>
      </div>

      <div>
        <p className="text-2xl font-bold font-brand mb-2" style={{ color: 'var(--color-brand-text)' }}>
          {t('payment.processing')}
        </p>
        <p className="text-sm font-brand" style={{ color: 'var(--color-brand-muted)' }}>
          {t('payment.doNotRemove')}
        </p>
      </div>
    </div>
  );
}

// ─── Succeeded ─────────────────────────────────────────────────────────────────

function Succeeded() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" aria-label="Payment successful"
      className="flex flex-col items-center justify-center flex-1 gap-8 px-8 text-center">

      {/* Success ring */}
      <div className="relative w-28 h-28">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:  'var(--color-brand-success)',
            boxShadow:   '0 8px 40px rgba(34,197,94,0.35)',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 48 48" className="w-16 h-16" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="10,24 20,34 38,14" className="animate-check-draw"/>
          </svg>
        </div>
      </div>

      <div>
        <p className="text-2xl font-bold font-brand mb-2" style={{ color: 'var(--color-brand-text)' }}>
          {t('payment.approved')}
        </p>
        <p className="text-sm font-brand" style={{ color: 'var(--color-brand-muted)' }}>
          {t('payment.removeCard')}
        </p>
      </div>
    </div>
  );
}

// ─── Failed ────────────────────────────────────────────────────────────────────

function Failed({ error, onRetry, onCancel }: { error?: string | null; onRetry?: () => void; onCancel?: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" aria-live="assertive"
      className="flex flex-col items-center justify-center flex-1 gap-6 px-8 text-center">

      {/* Error icon */}
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(255,107,107,0.12)', border: '2px solid rgba(255,107,107,0.25)' }}
      >
        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ color: 'var(--color-brand-error)' }}>
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </div>

      <div>
        <p className="text-2xl font-bold font-brand mb-2" style={{ color: 'var(--color-brand-text)' }}>
          {t('payment.failed')}
        </p>
        {error && (
          <p className="font-brand text-base mb-1" style={{ color: 'var(--color-brand-error)' }}>
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        {onRetry && (
          <button onClick={onRetry} className="ui-btn-primary flex-1 py-4 text-base font-bold" style={{ borderRadius: 'var(--radius-2xl)' }}>
            {t('payment.tryAgain')}
          </button>
        )}
        {onCancel && (
          <button onClick={onCancel} className="flex-1 py-4 rounded-2xl font-brand font-bold text-base transition-all active:scale-95 border"
            style={{ border: '1.5px solid var(--ui-glass-border)', color: 'var(--color-brand-text)', background: 'transparent' }}>
            {t('payment.goBack')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Public ───────────────────────────────────────────────────────────────────

export default function PaymentStatus({ status, error, onRetry, onCancel }: PaymentStatusProps) {
  if (status === 'processing') return <Processing />;
  if (status === 'succeeded') return <Succeeded />;
  return <Failed error={error} onRetry={onRetry} onCancel={onCancel} />;
}
