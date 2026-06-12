// src/screens/PaymentScreen.tsx
import { useEffect, useCallback } from 'react';
import { useHistory }             from 'react-router-dom';
import { IonPage, IonContent }    from '@ionic/react';

import { usePaymentStore }        from '@/store/paymentStore';
import { useCartStore }           from '@/store/cartStore';
import { formatPrice }            from '@/utils/format';
import { useKioskName }           from '@/hooks/useKioskName';
import { useTranslation }         from 'react-i18next';
import {
  runPaymentFlow,
  cancelPaymentFlow,
}                                 from '@/services/stripe.service';
import { adapterCancelCollect }   from '@/services/stripe/terminal.adapter';

import PaymentMethodSelector      from '@/modules/payment/PaymentMethodSelector';
import PhonePayScreen             from '@/modules/payment/PhonePayScreen';
import QrPayScreen                from '@/modules/payment/QrPayScreen';
import CardReaderScreen           from '@/modules/payment/CardReaderScreen';
import PaymentStatus              from '@/modules/payment/PaymentStatus';

const COLLECTING_STATES = new Set([
  'idle', 'initializing', 'discovering', 'connecting',
  'ready', 'creating_intent', 'collecting',
]);

// ─── Card payment sub-screen ──────────────────────────────────────────────────
// Mounts only when selectedMethod === 'card'. Starts payment once on mount
// via a [] dependency effect — no loops, no startedRef needed.

function CardPayView({ onBack }: { onBack: () => void }) {
  const { t }       = useTranslation();
  const history     = useHistory();
  const kioskName   = useKioskName();
  const total       = useCartStore((s) => s.total);

  // Targeted selectors — does NOT subscribe to the entire store, preventing
  // re-renders from unrelated store changes from re-evaluating effect deps.
  const flowState       = usePaymentStore((s) => s.flowState);
  const error           = usePaymentStore((s) => s.error);
  const connectedReader = usePaymentStore((s) => s.connectedReader);

  // Start payment exactly once on mount. runPaymentFlow() has a paymentInFlight
  // guard so even if this somehow fires twice the second call is a no-op.
  // Cleanup cancels any in-progress card collection when the user navigates away.
  useEffect(() => {
    void runPaymentFlow();
    return () => { void adapterCancelCollect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigate on terminal outcomes. flowState is 'idle' when this component
  // first mounts (PaymentMethodSelector.reset() guarantees this), so neither
  // branch fires on mount — only on actual state transitions.
  useEffect(() => {
    if (flowState === 'succeeded') history.replace('/confirmation');
    if (flowState === 'canceled')  history.replace('/tip');
  }, [flowState, history]);

  const handleCancel = useCallback(async () => {
    if (flowState === 'idle' || flowState === 'failed') {
      onBack();
      return;
    }
    await cancelPaymentFlow();
  }, [flowState, onBack]);

  const handleRetry = useCallback(() => {
    usePaymentStore.getState().reset();
    void runPaymentFlow();
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-brand-bg)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--ui-glass-border)' }}
      >
        <div>
          <p className="text-xs font-brand uppercase tracking-widest" style={{ color: 'var(--color-brand-muted)' }}>
            {kioskName}
          </p>
          <h1 className="text-lg font-bold font-brand" style={{ color: 'var(--color-brand-text)' }}>
            {t('payment.title')}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Order total chip */}
          <div className="px-4 py-2 rounded-2xl font-bold font-brand text-sm"
            style={{
              background: 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
              color: 'white',
              boxShadow: '0 4px 16px rgba(245,158,11,0.30)',
            }}>
            {formatPrice(total)}
          </div>

          {/* Cancel/back button */}
          <button type="button" onClick={handleCancel}
            aria-label={flowState === 'idle' ? t('common.back') : t('payment.cancel')}
            className="flex items-center gap-1.5 text-sm font-brand font-semibold"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-brand-muted)',
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
            {flowState === 'idle' ? t('common.back') : t('payment.cancel')}
          </button>
        </div>
      </div>

      {/* Dynamic content */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* ── Connecting / initializing — let CardReaderScreen show the spinner ── */}
        {COLLECTING_STATES.has(flowState) && <CardReaderScreen />}

        {/* ── No reader after flow settled to idle/failed (not during connecting) ── */}
        {!connectedReader && (flowState === 'idle' || flowState === 'failed') && (
          <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 py-8">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.1)', border: '2px solid rgba(245,158,11,0.3)' }}>
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none"
                stroke="var(--color-brand-warning)" strokeWidth={1.5} strokeLinecap="round">
                <rect x="2" y="6" width="20" height="13" rx="2"/>
                <path d="M2 10h20"/>
                <circle cx="6" cy="15" r="1.2" fill="var(--color-brand-warning)" stroke="none"/>
              </svg>
            </div>

            <div className="text-center">
              <h2 className="text-lg font-bold font-brand" style={{ color: 'var(--color-brand-text)' }}>
                {t('payment.noReaderConnected')}
              </h2>
              <p className="text-sm font-brand mt-2" style={{ color: 'var(--color-brand-muted)' }}>
                {t('payment.noReaderHint')}
              </p>
            </div>

            <button type="button" onClick={() => history.push('/settings')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold font-brand transition-all hover:shadow-md"
              style={{
                background: 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
                color: 'white',
                border: 'none', cursor: 'pointer',
              }}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round">
                <path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/>
                <path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1" fill="white"/>
              </svg>
              {t('payment.connectReader')}
            </button>

            <button type="button" onClick={onBack}
              className="px-6 py-2 rounded-xl text-sm font-bold font-brand"
              style={{
                background: 'transparent', color: 'var(--color-brand-muted)',
                border: '1px solid var(--ui-glass-border)', cursor: 'pointer',
              }}>
              {t('payment.backToCart')}
            </button>
          </div>
        )}

        {flowState === 'processing' && <PaymentStatus status="processing" />}
        {flowState === 'failed' && (
          <PaymentStatus
            status="failed"
            error={error}
            onRetry={handleRetry}
            onCancel={() => history.replace('/tip')}
          />
        )}
      </div>

      {/* Security footer */}
      <div
        className="flex-shrink-0 flex items-center justify-center gap-2 py-3"
        style={{ borderTop: '1px solid var(--ui-glass-border)' }}
      >
        <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2} strokeLinecap="round"
          style={{ color: 'var(--color-brand-success)' }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span className="text-xs font-brand" style={{ color: 'var(--color-brand-muted)' }}>
          {t('payment.securedBy')}
        </span>
      </div>
    </div>
  );
}

// ─── Root payment screen ──────────────────────────────────────────────────────

export default function PaymentScreen() {
  const history        = useHistory();
  const selectedMethod = usePaymentStore((s) => s.selectedMethod);
  const setMethod      = usePaymentStore((s) => s.setSelectedMethod);

  // Clear method on unmount so the selector shows fresh next time.
  useEffect(() => {
    return () => { setMethod(null); };
  }, [setMethod]);

  const handleBack = useCallback(() => {
    void cancelPaymentFlow();
    usePaymentStore.getState().reset();
    setMethod(null);
  }, [setMethod]);

  const handleBackToTip = useCallback(() => {
    usePaymentStore.getState().reset();
    history.replace('/tip');
  }, [history]);

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

          {/* ── Method selector ── */}
          {!selectedMethod && (
            <PaymentMethodSelector onBack={handleBackToTip} />
          )}

          {/* ── Card terminal ── */}
          {selectedMethod === 'card' && (
            <CardPayView onBack={handleBack} />
          )}

          {/* ── Phone pay ── */}
          {selectedMethod === 'phone' && (
            <PhonePayScreen onBack={handleBack} />
          )}

          {/* ── QR pay ── */}
          {selectedMethod === 'qr' && (
            <QrPayScreen onBack={handleBack} />
          )}

        </div>
      </IonContent>
    </IonPage>
  );
}
