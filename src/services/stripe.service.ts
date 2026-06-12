// src/services/stripe.service.ts
// Orchestrates the complete Stripe Terminal payment flow.
// On web/demo, USE_STATIC_PAYMENT_FLOW auto-progresses through all states
// so customers see a realistic animated payment without physical hardware.

import { Capacitor } from '@capacitor/core';
import {
  initializeAdapter,
  adapterConnectBluetoothReader,
  adapterConnectInternetReader,
  adapterConnectLocalMobileReader,
  adapterGetConnectedReader,
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
import { printOrderReceipt } from './receipt.service';
import { StarPrinterNative } from '@/plugins/star-printer';

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

// Prevents concurrent calls from firing two parallel payment flows.
let paymentInFlight = false;

export async function runPaymentFlow(): Promise<void> {
  if (paymentInFlight) return;

  paymentInFlight = true;
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
    if (Capacitor.isNativePlatform()) {
      // ── Real native Stripe Terminal path ─────────────────────────────────────
      setState('initializing');
      const ok = await initializeAdapter();
      if (!ok) throw new StripeTerminalError('TERMINAL_NOT_INITIALIZED', 'Stripe Terminal failed to initialize.', false);

      payStore.setIsWebFallback(false);

      // Reuse an already-connected reader (kiosk_straunt_storefront pattern: connect once in
      // Settings, keep the reader connected across all payments).  Only reconnect if the SDK
      // reports no active connection — avoids a 15-second BLE re-discovery on every order.
      let activeReader = await adapterGetConnectedReader();

      if (!activeReader) {
        const serialNumber = settings.payment.readerSerialNumber.trim();
        const locationId   = settings.payment.terminalLocationId.trim();
        const method       = (settings.payment.connectionMethod || 'bluetooth') as 'bluetooth' | 'internet' | 'localMobile';

        if (!serialNumber && method !== 'localMobile') {
          throw new StripeTerminalError(
            'READER_NOT_FOUND',
            'No payment reader connected. Open Settings → Payment Devices and connect a reader first.',
            false,
          );
        }

        setState('connecting');
        if (method === 'bluetooth') {
          activeReader = await adapterConnectBluetoothReader(serialNumber, locationId);
        } else if (method === 'internet') {
          activeReader = await adapterConnectInternetReader(serialNumber);
        } else {
          activeReader = await adapterConnectLocalMobileReader(locationId);
        }
      }

      payStore.setConnectedReader(activeReader);

      setState('collecting');
      const amountDollars = (subtotal + taxAmount + tipAmount);

      // Read reader address from settings (set in Settings → Payment tab).
      // Falls back to the address stored on the connected reader object.
      const readerAddress =
        settings.payment.readerSerialNumber.trim() ||
        activeReader?.serialNumber ||
        '';

      const paymentResult = await StarPrinterNative.createAndProcessPayment({
        deviceName:   activeReader?.label ?? readerAddress,
        deviceAddress: readerAddress,
        constructedObj: {
          amount: amountDollars,
          currency: 'usd',
        },
      }) as any;

      if (paymentResult && (paymentResult.status === 'SUCCEEDED' || paymentResult.status === 'REQUIRES_CAPTURE')) {
        setState('processing');
        const confirmedId = paymentResult.id;
        useSessionStore.getState().confirmOrder(confirmedId);
        setState('succeeded');
        void submitOrder({ paymentMethod: 'card' });
        void printOrderReceipt();
      } else {
        throw new Error((paymentResult as any)?.status || 'Payment failed');
      }

    } else {
      // ── Static / web demo path ────────────────────────────────────────────────
      await runStaticFlow(intentParams);
    }
  } catch (err) {
    setErr(err);
    const code = err instanceof StripeTerminalError ? err.code : 'UNKNOWN';
    setState(code === 'PAYMENT_CANCELED' ? 'canceled' : 'failed');
  } finally {
    paymentInFlight = false;
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
