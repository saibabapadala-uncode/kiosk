// src/screens/PaymentScreen.tsx — visual layer only, all logic preserved
import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { IonPage, IonContent } from '@ionic/react';
import { usePayment } from '@/hooks/usePayment';
import CardReaderScreen from '@/modules/payment/CardReaderScreen';
import PaymentStatus from '@/modules/payment/PaymentStatus';
import { useBrand } from '@/hooks/useBrand';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/utils/format';

const COLLECTING_STATES = new Set([
  'idle', 'initializing', 'discovering', 'connecting',
  'ready', 'creating_intent', 'collecting',
]);

export default function PaymentScreen() {
  const history = useHistory();
  const { environment } = useBrand();
  const { flowState, error, startPayment, retryPayment, cancelPayment } = usePayment();
  const total = useCartStore((s) => s.total);

  useEffect(() => {
    startPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                {environment.displayName}
              </p>
              <h1 className="text-lg font-bold font-brand" style={{ color: 'var(--color-brand-text)' }}>
                Secure Payment
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
            {COLLECTING_STATES.has(flowState) && <CardReaderScreen />}
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
              Secured by Stripe Terminal — PCI DSS compliant
            </span>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
