// src/hooks/useStripeTerminalNative.ts
// Full native Stripe Terminal hook — replaces the adapter-based flow for
// native (Capacitor) builds. On web the plugin falls back to the simulator.
import { useCallback, useEffect, useRef } from 'react';
import { StripeTerminalNative } from '@/plugins/stripe-terminal';
import type { TerminalReader, CollectPaymentOptions } from '@/plugins/stripe-terminal';
import { usePaymentStore } from '@/store/paymentStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSessionStore } from '@/store/sessionStore';
import { useCartStore } from '@/store/cartStore';
import { api } from '@/services/api.service';
import { submitOrder } from '@/services/order.service';
import { logger } from '@/utils/logger';
import type { PaymentFlowState } from '@/services/stripe/types';
import { USE_STATIC_PAYMENT_FLOW, createStaticPaymentIntent } from '@/services/stripe/static.mock';

function setState(s: PaymentFlowState) { usePaymentStore.getState().setFlowState(s); }
function setErr(msg: string) { usePaymentStore.getState().setError(msg); }

export function useStripeTerminalNative() {
  const listenerRefs = useRef<Array<{ remove(): Promise<void> }>>([]);

  // ── Register event listeners once ──────────────────────────────────────────
  useEffect(() => {
    let isCleanedUp = false;

    async function subscribe() {
      try {
        const ls = await Promise.all([
          StripeTerminalNative.addListener('readersDiscovered', ({ readers }) => {
            logger.info(`[ST] discovered ${readers.length} reader(s)`);
          }),

          StripeTerminalNative.addListener('readerConnectionStatusChange', ({ status }) => {
            logger.info(`[ST] connection status: ${status}`);
            if (status === 'not_connected') {
              const { flowState } = usePaymentStore.getState();
              if (flowState === 'collecting' || flowState === 'processing') {
                setErr('Card reader disconnected during payment. Please try again.');
                usePaymentStore.getState().setFlowState('failed');
              }
            }
          }),

          StripeTerminalNative.addListener('paymentStatusChange', ({ status }) => {
            logger.debug(`[ST] payment status: ${status}`);
          }),

          StripeTerminalNative.addListener('readerDisplayMessage', ({ message }) => {
            logger.info(`[ST] display: ${message}`);
          }),

          StripeTerminalNative.addListener('readerInputOptions', ({ options }) => {
            logger.debug(`[ST] input options: ${options.join(', ')}`);
          }),

          StripeTerminalNative.addListener('offlineStatusChange', (data) => {
            logger.warn('[ST] offline status', data);
          }),

          StripeTerminalNative.addListener('unexpectedReaderDisconnect', ({ reader }) => {
            logger.warn(`[ST] unexpected disconnect: ${reader.serialNumber}`);
            usePaymentStore.getState().setConnectedReader(null);
          }),
        ]);

        if (isCleanedUp) {
          ls.forEach((l) => void l.remove());
        } else {
          listenerRefs.current = ls;
        }
      } catch (err) {
        logger.error('[ST] listener setup failed', err);
      }
    }

    void subscribe();
    return () => {
      isCleanedUp = true;
      listenerRefs.current.forEach((l) => void l.remove());
      listenerRefs.current = [];
    };
  }, []);

  // ── Initialize ─────────────────────────────────────────────────────────────
  const initialize = useCallback(async () => {
    setState('initializing');
    await StripeTerminalNative.initialize();
    logger.info('[ST] initialized');
  }, []);

  // ── Full payment flow ───────────────────────────────────────────────────────
  const runPayment = useCallback(async () => {
    const { subtotal, taxAmount, tipAmount } = useCartStore.getState();
    const { orderId, brandId } = useSessionStore.getState();
    const settings = useSettingsStore.getState();
    const totalCents = Math.round((subtotal + taxAmount + tipAmount) * 100);

    usePaymentStore.getState().reset();

    try {
      // Initialize
      setState('initializing');
      await StripeTerminalNative.initialize();

      // Discover
      setState('discovering');
      const discoveryMethod = settings.payment.readerSerialNumber.startsWith('SIM')
        ? 'localMobile'
        : 'bluetooth';

      await StripeTerminalNative.discoverReaders({
        method: discoveryMethod,
        locationId: settings.payment.terminalLocationId,
        simulated: false,
      });

      // Wait briefly for discovery result (in production, expose a picker UI)
      await new Promise((r) => setTimeout(r, 2_000));

      // Connect
      setState('connecting');
      let reader: TerminalReader;
      if (discoveryMethod === 'bluetooth') {
        reader = await StripeTerminalNative.connectBluetoothReader({
          serialNumber: settings.payment.readerSerialNumber,
          locationId: settings.payment.terminalLocationId,
        });
      } else {
        reader = await StripeTerminalNative.connectLocalMobileReader({
          locationId: settings.payment.terminalLocationId,
        });
      }
      usePaymentStore.getState().setConnectedReader({
        serialNumber: reader.serialNumber,
        label: reader.label,
        deviceType: reader.deviceType,
        status: reader.status,
        batteryLevel: reader.batteryLevel,
        simulated: reader.isSimulated,
      });

      // Create PaymentIntent via backend
      setState('creating_intent');
      const intent = USE_STATIC_PAYMENT_FLOW
        ? await createStaticPaymentIntent(totalCents)
        : (await api.post<{ clientSecret: string; paymentIntentId: string }>(
          '/stripe/payment-intent',
          {
            amount: totalCents,
            currency: 'usd',
            metadata: {
              brandId,
              channel: 'kiosk',
              locationId: settings.locationId,
              orderId: orderId ?? '',
            },
          },
        )).data;
      usePaymentStore.getState().setPaymentIntentId(intent.paymentIntentId);

      // Collect
      setState('collecting');
      await StripeTerminalNative.retrievePaymentIntent({ clientSecret: intent.clientSecret });
      const collectOptions: CollectPaymentOptions = { clientSecret: intent.clientSecret };
      await StripeTerminalNative.collectPaymentMethod(collectOptions);

      // Confirm
      setState('processing');
      const result = await StripeTerminalNative.confirmPaymentIntent();
      useSessionStore.getState().confirmOrder(result.id);
      setState('succeeded');
      void submitOrder();

      logger.info(`[ST] payment succeeded: ${result.id}`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed';
      setErr(msg);
      logger.error('[ST] payment flow error', err);
      const code = (err as { code?: string })?.code;
      setState(code === 'canceled' ? 'canceled' : 'failed');
    }
  }, []);

  const cancel = useCallback(async () => {
    await StripeTerminalNative.cancelCollect().catch(() => undefined);
    await StripeTerminalNative.cancelDiscovery().catch(() => undefined);
    usePaymentStore.getState().setFlowState('canceled');
  }, []);

  return { initialize, runPayment, cancel };
}
