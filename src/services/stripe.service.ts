// src/services/stripe.service.ts
// Orchestrates the complete Stripe Terminal payment flow.
// On web/demo, USE_STATIC_PAYMENT_FLOW auto-progresses through all states
// so customers see a realistic animated payment without physical hardware.

import { Capacitor } from '@capacitor/core';
import {
  initializeAdapter,
  adapterDiscoverReaders,
  adapterConnectReader,
  adapterDisconnect,
  adapterCreatePaymentIntent,
  adapterCollectPayment,
  adapterConfirm,
  adapterCancelCollect,
} from './stripe/terminal.adapter';
import {
  webCreatePaymentIntent,
  webConfirmPaymentIntent,
  WEB_SIMULATOR_READER,
} from './stripe/web.fallback';
import {
  USE_STATIC_PAYMENT_FLOW,
  delay,
  getFlowDelay,
} from './stripe/static.mock';
import {
  StripeTerminalError,
  TERMINAL_ERROR_MESSAGES,
  type CreatePaymentIntentParams,
  type TerminalReader,
  type PaymentFlowState,
} from './stripe/types';
import { usePaymentStore } from '@/store/paymentStore';
import { useCartStore } from '@/store/cartStore';
import { useSessionStore } from '@/store/sessionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { submitOrder } from './order.service';

export type { TerminalReader, PaymentFlowState };
export { TERMINAL_ERROR_MESSAGES };

// ─── Helpers ───────────────────────────────────────────────────────────────────

function setState(s: PaymentFlowState) {
  usePaymentStore.getState().setFlowState(s);
}

function setErr(err: unknown) {
  const store = usePaymentStore.getState();
  if (err instanceof StripeTerminalError) {
    store.setError(TERMINAL_ERROR_MESSAGES[err.code]);
  } else if (err instanceof Error) {
    store.setError(err.message);
  } else {
    store.setError('An unexpected error occurred');
  }
}

// ─── Main payment orchestration ────────────────────────────────────────────────

export async function runPaymentFlow(): Promise<void> {
  const payStore  = usePaymentStore.getState();
  const settings  = useSettingsStore.getState();
  const { subtotal, taxAmount, tipAmount } = useCartStore.getState();
  const { orderId, brandId } = useSessionStore.getState();

  payStore.reset();

  const totalCents = Math.round((subtotal + taxAmount + tipAmount) * 100);
  const intentParams: CreatePaymentIntentParams = {
    amount:   totalCents,
    currency: 'usd',
    metadata: { brandId, channel: 'kiosk', locationId: settings.locationId, orderId: orderId ?? '' },
  };

  try {
    if (Capacitor.isNativePlatform() && !USE_STATIC_PAYMENT_FLOW) {
      // ── Real native Stripe Terminal path ─────────────────────────────────────
      setState('initializing');
      const ok = await initializeAdapter();
      if (!ok) { await runStaticFlow(intentParams); return; }

      payStore.setIsWebFallback(false);

      setState('discovering');
      const readers = await adapterDiscoverReaders(settings.payment.terminalLocationId);
      const targetSerial = settings.payment.readerSerialNumber.trim();
      const reader: TerminalReader | undefined = targetSerial
        ? readers.find((r) => r.serialNumber === targetSerial)
        : readers.find((r) => r.status === 'online') ?? readers[0];

      if (!reader) throw new StripeTerminalError('READER_NOT_FOUND', 'No reader found. Please contact staff.', false);

      setState('connecting');
      await adapterConnectReader(reader.serialNumber);
      payStore.setConnectedReader(reader);

      setState('creating_intent');
      const intent = await adapterCreatePaymentIntent(intentParams);
      payStore.setPaymentIntentId(intent.paymentIntentId);

      setState('collecting');
      await adapterCollectPayment(intent.clientSecret);

      setState('processing');
      const confirmedId = await adapterConfirm();
      useSessionStore.getState().confirmOrder(confirmedId);
      setState('succeeded');
      void submitOrder();
      await adapterDisconnect();

    } else {
      // ── Static / web demo path ────────────────────────────────────────────────
      await runStaticFlow(intentParams);
    }
  } catch (err) {
    setErr(err);
    const code = err instanceof StripeTerminalError ? err.code : 'UNKNOWN';
    setState(code === 'PAYMENT_CANCELED' ? 'canceled' : 'failed');
  }
}

/**
 * Auto-progresses through a realistic animated payment flow.
 * Used in web/demo mode so customers see the full card-reader experience
 * without physical hardware.
 */
async function runStaticFlow(intentParams: CreatePaymentIntentParams): Promise<void> {
  const payStore = usePaymentStore.getState();
  payStore.setIsWebFallback(true);
  payStore.setConnectedReader(WEB_SIMULATOR_READER);

  // 1 — brief connecting pause (reader "wakes up")
  setState('connecting');
  await delay(getFlowDelay('connectReaderMs', 900));

  // 2 — preparing payment intent
  setState('creating_intent');
  const intent = await webCreatePaymentIntent(intentParams);
  payStore.setPaymentIntentId(intent.paymentIntentId);
  await delay(350);

  // 3 — customer "taps/swipes" card (CardReaderScreen shows the animated UI)
  setState('collecting');
  await delay(getFlowDelay('collectPaymentMs', 2_400));

  // 4 — processing
  setState('processing');
  const confirmedId = await webConfirmPaymentIntent(intent.paymentIntentId);
  await delay(getFlowDelay('paymentConfirmMs', 1_100));

  // 5 — success
  useSessionStore.getState().confirmOrder(confirmedId);
  setState('succeeded');
  void submitOrder();
}

/** Legacy: called by the old "Pay Now" simulator button (kept for compatibility). */
export async function runWebPayment(): Promise<void> {
  const { subtotal, taxAmount, tipAmount } = useCartStore.getState();
  const { orderId, brandId } = useSessionStore.getState();
  const settings = useSettingsStore.getState();

  await runStaticFlow({
    amount: Math.round((subtotal + taxAmount + tipAmount) * 100),
    currency: 'usd',
    metadata: { brandId, channel: 'kiosk', locationId: settings.locationId, orderId: orderId ?? '' },
  });
}

export async function cancelPaymentFlow(): Promise<void> {
  await adapterCancelCollect();
  usePaymentStore.getState().setFlowState('canceled');
}

export type { StripeTerminalError };
