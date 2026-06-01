// src/modules/payment/ReceiptScreen.tsx — visual layer only, all logic preserved
import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/store/cartStore';
import { useSessionStore } from '@/store/sessionStore';
import { usePaymentStore } from '@/store/paymentStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useBrand } from '@/hooks/useBrand';
import { api } from '@/services/api.service';
import { USE_STATIC_PAYMENT_FLOW, delay, getFlowDelay } from '@/services/stripe/static.mock';
import { formatPrice } from '@/utils/format';

type ReceiptStep = 'options' | 'sending' | 'sent' | 'error';

// ─── Email form ────────────────────────────────────────────────────────────────

function EmailForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [email, setEmail]     = useState('');
  const [step, setStep]       = useState<ReceiptStep>('options');
  const [errorMsg, setErrorMsg] = useState('');

  async function sendEmail() {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setStep('sending'); setErrorMsg('');
    try {
      if (USE_STATIC_PAYMENT_FLOW) {
        await delay(getFlowDelay('receiptEmailMs', 600));
      } else {
        await api.post(`/orders/${orderId}/receipt/email`, { email: trimmed });
      }
      setStep('sent');
    } catch {
      setStep('error');
      setErrorMsg('Could not send receipt. Please try another method.');
    }
  }

  if (step === 'sending') return (
    <div className="flex items-center gap-2 font-brand text-sm" style={{ color: 'var(--color-brand-muted)' }}>
      <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin-ring"
        style={{ borderColor: 'var(--color-brand-border)', borderTopColor: 'var(--color-brand-primary)' }} />
      Sending receipt…
    </div>
  );

  if (step === 'sent') return (
    <p className="font-brand text-sm font-semibold" style={{ color: 'var(--color-brand-success)' }}>
      ✓ Receipt sent to {email}
    </p>
  );

  if (step === 'error') return (
    <p className="font-brand text-sm" style={{ color: 'var(--color-brand-error)' }}>{errorMsg}</p>
  );

  return (
    <div className="flex flex-col gap-3 w-full">
      <label htmlFor="receipt-email" className="text-sm font-brand font-semibold" style={{ color: 'var(--color-brand-text)' }}>
        Email Receipt
      </label>
      <div className="flex gap-2">
        <input
          id="receipt-email" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendEmail()}
          placeholder="you@example.com" autoComplete="email"
          className="flex-1 px-4 py-3 font-brand text-base focus:outline-none"
          style={{
            background:   'var(--color-ui-surface-alt)',
            borderRadius: 'var(--radius-xl)',
            border:       '1.5px solid var(--ui-glass-border)',
            color:        'var(--color-brand-text)',
          }}
        />
        <button onClick={sendEmail} className="ui-btn-primary px-5 text-sm" style={{ minHeight: 'auto', padding: '0.75rem 1.25rem', borderRadius: 'var(--radius-xl)' }}>
          Send
        </button>
      </div>
      {errorMsg && <p role="alert" className="text-xs font-brand" style={{ color: 'var(--color-brand-error)' }}>{errorMsg}</p>}
      <button onClick={onDone} className="text-xs font-brand transition-colors" style={{ color: 'var(--color-brand-muted)' }}>
        Skip receipt
      </button>
    </div>
  );
}

// ─── Print button ─────────────────────────────────────────────────────────────

function PrintButton({ orderId }: { orderId: string }) {
  const printerIp = useSettingsStore((s) => s.kiosk.receiptPrinterIp);
  const [status, setStatus] = useState<'idle' | 'printing' | 'done' | 'err'>('idle');

  if (!printerIp) return null;

  async function print() {
    setStatus('printing');
    try {
      if (USE_STATIC_PAYMENT_FLOW) { await delay(getFlowDelay('receiptPrintMs', 700)); }
      else { await api.post(`/orders/${orderId}/receipt/print`, { printerIp }); }
      setStatus('done');
    } catch { setStatus('err'); }
  }

  return (
    <button onClick={print} disabled={status === 'printing' || status === 'done'}
      className="w-full py-4 rounded-2xl font-brand font-semibold text-base transition-all active:scale-95 disabled:opacity-50"
      style={{ border: '1.5px solid var(--ui-glass-border)', color: 'var(--color-brand-text)', background: 'transparent' }}>
      {status === 'printing' ? '🖨 Printing…' : status === 'done' ? '✓ Printed' : status === 'err' ? '⚠ Print failed — try again' : '🖨 Print Receipt'}
    </button>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ReceiptScreen() {
  const { t } = useTranslation();
  const history = useHistory();
  const { environment } = useBrand();
  const orderId    = useSessionStore((s) => s.orderId);
  const total      = useCartStore((s) => s.total);
  const clearCart  = useCartStore((s) => s.clearCart);
  const resetSession = useSessionStore((s) => s.resetSession);
  const resetPayment = usePaymentStore((s) => s.reset);
  const [showEmail, setShowEmail] = useState(false);

  function startNewOrder() {
    clearCart(); resetSession(); resetPayment();
    history.replace('/attract');
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-brand-bg)' }}>

      {/* Success header */}
      <div
        className="flex flex-col items-center pt-10 pb-6 px-8 text-center flex-shrink-0"
        style={{ background: 'linear-gradient(180deg, rgba(34,197,94,0.08) 0%, transparent 100%)', borderBottom: '1px solid var(--ui-glass-border)' }}
      >
        {/* Check circle */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
          style={{
            background:  'linear-gradient(135deg, var(--color-brand-success), #16a34a)',
            boxShadow:   '0 8px 32px rgba(34,197,94,0.35)',
          }}
        >
          <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="10,24 20,34 38,14" className="animate-check-draw"/>
          </svg>
        </div>

        <h1 className="text-2xl lg:text-3xl font-bold font-brand mb-1" style={{ color: 'var(--color-brand-text)' }}>
          {t('receipt.title')}
        </h1>
        <p className="font-brand text-base" style={{ color: 'var(--color-brand-muted)' }}>
          {t('receipt.thankYou', { brand: environment.displayName })}
        </p>

        {orderId && (
          <div
            className="mt-4 px-5 py-3 rounded-2xl"
            style={{ background: 'var(--color-ui-card)', border: '1px solid var(--ui-glass-border)' }}
          >
            <p className="text-xs font-brand mb-0.5" style={{ color: 'var(--color-brand-muted)' }}>
              {t('receipt.orderNumber')}
            </p>
            <p className="text-lg font-bold font-brand tracking-widest" style={{ color: 'var(--color-brand-text)' }}>
              {orderId}
            </p>
          </div>
        )}

        <p className="mt-4 text-2xl font-bold font-brand" style={{ color: 'var(--color-brand-primary)' }}>
          {t('receipt.totalPaid', { total: formatPrice(total) })}
        </p>
      </div>

      {/* Options */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4">
        <h2 className="text-base font-bold font-brand" style={{ color: 'var(--color-brand-text)' }}>
          {t('receipt.receiptQuestion')}
        </h2>

        {showEmail ? (
          <EmailForm orderId={orderId ?? ''} onDone={() => setShowEmail(false)} />
        ) : (
          <>
            <button
              onClick={() => setShowEmail(true)}
              className="ui-btn-primary w-full py-4 text-base"
              style={{ borderRadius: 'var(--radius-2xl)' }}
            >
              {t('receipt.emailReceipt')}
            </button>
            <PrintButton orderId={orderId ?? ''} />
            <button onClick={startNewOrder} className="text-sm font-brand transition-colors mt-1" style={{ color: 'var(--color-brand-muted)' }}>
              {t('receipt.noThanks')}
            </button>
          </>
        )}
      </div>

      {/* Start new order */}
      <div className="flex-shrink-0 px-6 pb-8 pt-3" style={{ borderTop: '1px solid var(--ui-glass-border)' }}>
        <button
          onClick={startNewOrder}
          aria-label="Start a new order"
          className="w-full py-4 font-brand font-bold text-lg transition-all active:scale-95"
          style={{
            borderRadius: 'var(--radius-2xl)',
            border:       '2px solid var(--color-brand-primary)',
            color:        'var(--color-brand-primary)',
            background:   'transparent',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-brand-primary)';
            (e.currentTarget as HTMLButtonElement).style.color      = 'white';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color      = 'var(--color-brand-primary)';
          }}
        >
          {t('receipt.startNew')}
        </button>
      </div>
    </div>
  );
}
