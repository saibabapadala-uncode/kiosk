// src/screens/PaymentScreen.tsx — visual layer only, all logic preserved
import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { IonPage, IonContent } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { usePayment } from '@/hooks/usePayment';
import { usePaymentStore } from '@/store/paymentStore';
import CardReaderScreen from '@/modules/payment/CardReaderScreen';
import PaymentStatus from '@/modules/payment/PaymentStatus';
import { useKioskName } from '@/hooks/useKioskName';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/utils/format';

const COLLECTING_STATES = new Set([
  'idle', 'initializing', 'discovering', 'connecting',
  'ready', 'creating_intent', 'collecting',
]);

export default function PaymentScreen() {
  const { t }       = useTranslation();
  const history     = useHistory();
  const kioskName   = useKioskName();
  const { flowState, error, startPayment, retryPayment, cancelPayment } = usePayment();
  const total           = useCartStore((s) => s.total);
  const connectedReader = usePaymentStore((s) => s.connectedReader);

  useEffect(() => {
    if (connectedReader) {
      startPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedReader]);

  useEffect(() => {
    if (flowState === 'succeeded') history.replace('/confirmation');
    if (flowState === 'canceled')  history.replace('/tip');
  }, [flowState, history]);

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <div className="flex flex-col h-full" style={{ background: 'var(--color-brand-bg)' }}>

          {/* Header */}
          <div
            className="flex-shrink-0 flex items-center justify-between px-6 py-4"
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
            {/* Order total chip */}
            <div
              className="px-4 py-2 rounded-2xl font-bold font-brand text-sm"
              style={{
                background:  'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
                color:       'white',
                boxShadow:   '0 4px 16px rgba(245,158,11,0.30)',
              }}
            >
              {formatPrice(total)}
            </div>
          </div>

          {/* Dynamic content */}
          <div className="flex flex-col flex-1 min-h-0">
            {!connectedReader && (
              <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6 py-8">
                {/* Card reader icon */}
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '2px solid rgba(245,158,11,0.3)' }}>
                  <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none"
                    stroke="var(--color-brand-warning)" strokeWidth={1.5} strokeLinecap="round">
                    <rect x="2" y="6" width="20" height="13" rx="2"/>
                    <path d="M2 10h20"/>
                    <circle cx="6" cy="15" r="1.2" fill="var(--color-brand-warning)" stroke="none"/>
                  </svg>
                </div>

                {/* Message */}
                <div className="text-center">
                  <h2 className="text-lg font-bold font-brand" style={{ color: 'var(--color-brand-text)' }}>
                    {t('payment.noReaderConnected')}
                  </h2>
                  <p className="text-sm font-brand mt-2" style={{ color: 'var(--color-brand-muted)' }}>
                    {t('payment.noReaderHint')}
                  </p>
                </div>

                {/* Connect button */}
                <button
                  type="button"
                  onClick={() => history.push('/settings')}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold font-brand transition-all hover:shadow-md"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
                    color: 'white',
                  }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/>
                    <path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1" fill="white"/>
                  </svg>
                  {t('payment.connectReader')}
                </button>

                {/* Back button */}
                <button
                  type="button"
                  onClick={() => history.replace('/tip')}
                  className="px-6 py-2 rounded-xl text-sm font-bold font-brand transition-colors"
                  style={{
                    background: 'transparent',
                    color: 'var(--color-brand-muted)',
                    border: '1px solid var(--ui-glass-border)',
                  }}
                >
                  {t('payment.backToCart')}
                </button>
              </div>
            )}
            {connectedReader && COLLECTING_STATES.has(flowState) && <CardReaderScreen />}
            {flowState === 'processing' && <PaymentStatus status="processing" />}
            {flowState === 'failed' && (
              <PaymentStatus
                status="failed"
                error={error}
                onRetry={retryPayment}
                onCancel={() => history.replace('/tip')}
              />
            )}
          </div>

          {/* Security footer */}
          <div
            className="flex-shrink-0 flex items-center justify-center gap-2 py-3"
            style={{ borderTop: '1px solid var(--ui-glass-border)' }}
          >
            <svg aria-hidden="true" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ color: 'var(--color-brand-success)' }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span className="text-xs font-brand" style={{ color: 'var(--color-brand-muted)' }}>
              {t('payment.securedBy')}
            </span>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
