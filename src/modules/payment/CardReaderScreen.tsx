// src/modules/payment/CardReaderScreen.tsx — visual layer only, all logic preserved
import { usePayment } from '@/hooks/usePayment';
import { USE_STATIC_PAYMENT_FLOW } from '@/services/stripe/static.mock';
import type { PaymentFlowState } from '@/services/stripe/types';

// ─── State labels ────────────────────────────────────────────────────────────

const STATE_LABELS: Partial<Record<PaymentFlowState, string>> = {
  initializing:    'Starting card reader…',
  discovering:     'Looking for card reader…',
  connecting:      'Connecting to reader…',
  creating_intent: 'Preparing your payment…',
  processing:      'Processing payment…',
};

// ─── Gradient spinner ─────────────────────────────────────────────────────────

function GradientSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-8 px-8 text-center">
      {/* Double-ring gradient spinner */}
      <div className="relative w-20 h-20">
        {/* Outer ring track */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ border: '3px solid var(--color-brand-border)' }}
        />
        {/* Spinning arc */}
        <div
          className="absolute inset-0 rounded-full animate-spin-ring"
          style={{
            border:      '3px solid transparent',
            borderTopColor:   'var(--color-brand-primary)',
            borderRightColor: 'var(--color-brand-secondary)',
          }}
        />
        {/* Inner ring */}
        <div
          className="absolute inset-3 rounded-full"
          style={{ border: '2px solid var(--color-brand-surface)' }}
        />
        <div
          className="absolute inset-3 rounded-full animate-spin-ring"
          style={{
            border:           '2px solid transparent',
            borderTopColor:   'var(--color-brand-secondary)',
            animationDuration: '0.6s',
            animationDirection: 'reverse',
          }}
        />
      </div>
      <p className="text-lg font-brand font-semibold" style={{ color: 'var(--color-brand-text)' }}>
        {label}
      </p>
    </div>
  );
}

// ─── NFC / card illustration ──────────────────────────────────────────────────

function NFCIllustration() {
  return (
    <div className="relative flex items-center justify-center w-52 h-52" aria-hidden="true">
      {/* NFC pulse rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-36 h-36 rounded-full animate-nfc-pulse"
          style={{ border: '2px solid var(--color-brand-primary)', opacity: 0.6 }}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-36 h-36 rounded-full animate-nfc-pulse-delay"
          style={{ border: '2px solid var(--color-brand-secondary)', opacity: 0.4 }}
        />
      </div>

      {/* Card */}
      <div
        className="relative z-10 w-40 h-[100px] rounded-2xl"
        style={{
          background:  'linear-gradient(135deg, var(--color-brand-primary) 0%, var(--color-brand-secondary) 100%)',
          boxShadow:   '0 16px 48px rgba(245,158,11,0.40), 0 4px 12px rgba(0,0,0,0.12)',
        }}
      >
        {/* Chip */}
        <div
          className="absolute top-5 left-4 w-8 h-6 rounded"
          style={{ background: 'rgba(255,255,255,0.30)' }}
        />
        {/* Stripe */}
        <div className="absolute top-3 inset-x-0 h-2" style={{ background: 'rgba(0,0,0,0.20)' }} />
        {/* Number dots */}
        {[32, 42, 52, 62].map((x) => (
          <div key={x} className="absolute bottom-5 w-1.5 h-1.5 rounded-full" style={{ left: x, background: 'rgba(255,255,255,0.65)' }} />
        ))}
        {/* NFC arcs */}
        <svg className="absolute bottom-3 right-4 w-8 h-8" viewBox="0 0 32 32" fill="none">
          <path d="M18 8 Q26 16 18 24" stroke="rgba(255,255,255,0.65)" strokeWidth="2" strokeLinecap="round"/>
          <path d="M22 4 Q34 16 22 28" stroke="rgba(255,255,255,0.40)" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}

// ─── Native "tap your card" UI ────────────────────────────────────────────────

function NativeCollectUI({ readerLabel, onCancel }: { readerLabel: string; onCancel: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 px-8 text-center">
      <div
        className="px-4 py-1.5 rounded-full text-xs font-bold font-brand uppercase tracking-wider"
        style={{ background: 'rgba(245,158,11,0.10)', color: 'var(--color-brand-primary)', border: '1px solid rgba(245,158,11,0.28)' }}
      >
        {readerLabel}
      </div>

      <NFCIllustration />

      <div>
        <h2 className="text-2xl lg:text-3xl font-bold font-brand mb-2" style={{ color: 'var(--color-brand-text)' }}>
          Tap, Swipe, or Insert
        </h2>
        <p className="font-brand text-base mb-1" style={{ color: 'var(--color-brand-muted)' }}>
          Present your card to the reader
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: '#f59e0b' }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p className="text-xs font-brand" style={{ color: '#f59e0b' }}>
            Keep your card in place until payment confirms
          </p>
        </div>
      </div>

      <button
        onClick={onCancel}
        aria-label="Cancel payment"
        className="px-8 py-3 rounded-2xl font-brand font-semibold text-sm transition-all active:scale-95"
        style={{
          border: '1.5px solid var(--ui-glass-border)',
          color:  'var(--color-brand-muted)',
          background: 'transparent',
        }}
      >
        Cancel Payment
      </button>
    </div>
  );
}

// ─── Web simulator UI ─────────────────────────────────────────────────────────

function WebSimulatorUI({ onSimulate }: { onSimulate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 px-8 text-center">
      <div
        className="px-3 py-1.5 rounded-full text-xs font-bold font-brand uppercase tracking-wider"
        style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.30)' }}
      >
        ⚡ Dev · Simulator Mode
      </div>

      <NFCIllustration />

      <div>
        <h2 className="text-2xl font-bold font-brand mb-2" style={{ color: 'var(--color-brand-text)' }}>
          Simulated Card Reader
        </h2>
        <p className="font-brand text-sm" style={{ color: 'var(--color-brand-muted)' }}>
          No physical reader detected. Tap below to simulate payment.
        </p>
      </div>

      <button
        onClick={onSimulate}
        aria-label="Simulate payment"
        className="ui-btn-primary px-10 py-4 text-base"
        style={{ borderRadius: 'var(--radius-2xl)' }}
      >
        Simulate Payment
      </button>
    </div>
  );
}

// ─── Public ───────────────────────────────────────────────────────────────────

export default function CardReaderScreen() {
  const { flowState, connectedReader, isWebFallback, cancelPayment, simulateWebPayment } = usePayment();
  const loadingLabel = STATE_LABELS[flowState];

  if (loadingLabel) return <GradientSpinner label={loadingLabel} />;

  if (flowState === 'collecting' || flowState === 'ready') {
    if (isWebFallback && !USE_STATIC_PAYMENT_FLOW) {
      return <WebSimulatorUI onSimulate={simulateWebPayment} />;
    }
    return <NativeCollectUI readerLabel={connectedReader?.label ?? 'Card Reader'} onCancel={cancelPayment} />;
  }

  return null;
}
