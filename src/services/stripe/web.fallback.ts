// src/services/stripe/web.fallback.ts
// Simulated terminal for web/dev when no physical reader is available.

import type { CreatePaymentIntentParams, PaymentIntentResult } from './types';
import {
  STATIC_READERS,
  confirmStaticPaymentIntent,
  createStaticPaymentIntent,
  delay,
  getFlowDelay,
} from './static.mock';

export const WEB_SIMULATOR_READER = STATIC_READERS[0];

export async function webCreatePaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<PaymentIntentResult> {
  return createStaticPaymentIntent(params.amount);
}

export async function webConfirmPaymentIntent(
  paymentIntentId: string,
): Promise<string> {
  return confirmStaticPaymentIntent(paymentIntentId);
}

/** Simulates a brief card-collection delay for realistic UX in dev/staging */
export function simulateCardDelay(ms = getFlowDelay('collectPaymentMs', 2_000)): Promise<void> {
  return delay(ms);
}
