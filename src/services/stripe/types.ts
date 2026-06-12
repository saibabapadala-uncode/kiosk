// src/services/stripe/types.ts

export interface TerminalReader {
  serialNumber: string;
  label: string;
  deviceType: string;
  batteryLevel?: number;
  simulated: boolean;
  locationId?: string;
  status: 'online' | 'offline' | 'unknown';
  ipAddress?: string;
}

export interface CreatePaymentIntentParams {
  /** Amount in cents (e.g. 1099 = $10.99) */
  amount: number;
  currency: 'usd';
  metadata: {
    brandId: string;
    channel: 'kiosk';
    locationId: string;
    orderId: string;
  };
}

export interface PaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
}

// ─── Error taxonomy ────────────────────────────────────────────────────────────

export type TerminalErrorCode =
  | 'TERMINAL_NOT_INITIALIZED'
  | 'READER_NOT_FOUND'
  | 'READER_OFFLINE'
  | 'READER_BUSY'
  | 'CARD_DECLINED'
  | 'INSUFFICIENT_FUNDS'
  | 'CARD_EXPIRED'
  | 'INCORRECT_PIN'
  | 'PAYMENT_CANCELED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'ALREADY_CONNECTED'
  // ── Permission / hardware errors ──────────────────────────────────────────
  | 'BLUETOOTH_DISABLED'
  | 'BLUETOOTH_PERMISSION_DENIED'
  | 'LOCATION_PERMISSION_DENIED'
  | 'NFC_UNAVAILABLE'
  | 'UNKNOWN';

export class StripeTerminalError extends Error {
  constructor(
    public readonly code: TerminalErrorCode,
    message: string,
    /** Whether the user can retry the same payment flow */
    public readonly retryable: boolean = true,
  ) {
    super(message);
    this.name = 'StripeTerminalError';
  }
}

export const TERMINAL_ERROR_MESSAGES: Record<TerminalErrorCode, string> = {
  TERMINAL_NOT_INITIALIZED:
    'Card reader system not ready. Please contact staff.',
  READER_NOT_FOUND:
    'No card reader found. Make sure it is powered on and nearby.',
  READER_OFFLINE:
    'Card reader is offline. Power it on and try again.',
  READER_BUSY:
    'Card reader is busy. Please wait a moment and try again.',
  CARD_DECLINED:
    'Your card was declined. Please try a different card.',
  INSUFFICIENT_FUNDS:
    'Insufficient funds. Please try a different card.',
  CARD_EXPIRED:
    'Your card has expired. Please use a different card.',
  INCORRECT_PIN:
    'Incorrect PIN entered. Please try again.',
  PAYMENT_CANCELED:
    'Payment was canceled.',
  NETWORK_ERROR:
    'No internet connection. Check your network and try again.',
  TIMEOUT:
    'Connection timed out. Make sure the reader is on and nearby, then try again.',
  ALREADY_CONNECTED:
    'A reader is already connected.',
  BLUETOOTH_DISABLED:
    'Bluetooth is turned off. Please enable Bluetooth in your device settings.',
  BLUETOOTH_PERMISSION_DENIED:
    'Bluetooth permission is required to connect a card reader. Please allow it in Settings.',
  LOCATION_PERMISSION_DENIED:
    'Location access is required to scan for Bluetooth devices on Android. Please allow it in Settings.',
  NFC_UNAVAILABLE:
    'NFC is not available on this device. Tap to Pay is not supported.',
  UNKNOWN:
    'An unexpected error occurred. Please try again.',
};

// ─── Payment flow states ───────────────────────────────────────────────────────

export type PaymentFlowState =
  | 'idle'
  | 'initializing'      // loading Capacitor plugin
  | 'discovering'       // scanning for readers
  | 'connecting'        // establishing reader connection
  | 'ready'             // reader connected, waiting to start
  | 'creating_intent'   // calling backend for PaymentIntent
  | 'collecting'        // reader waiting for card (tap/swipe/dip)
  | 'processing'        // confirming the PaymentIntent
  | 'succeeded'
  | 'failed'
  | 'canceled';
