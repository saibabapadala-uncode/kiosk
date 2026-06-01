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
    'No card reader found at this location. Please contact staff.',
  READER_OFFLINE:
    'Card reader is offline. Please contact staff.',
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
    'Network error. Please check the connection and try again.',
  TIMEOUT:
    'Payment timed out. Please try again.',
  ALREADY_CONNECTED:
    'Already connected to a reader.',
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
