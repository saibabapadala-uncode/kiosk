import type { PaymentIntentResult, TerminalReader } from './types';
import flowData from '@/mock/flow.json';

type FlowConfig = {
  useStaticPaymentFlow: boolean;
  readers: TerminalReader[];
  delays: Record<string, number>;
};

const FLOW = flowData as FlowConfig;

export const USE_STATIC_PAYMENT_FLOW = FLOW.useStaticPaymentFlow;
export const STATIC_READERS: TerminalReader[] = FLOW.readers;
export const FLOW_DELAYS = FLOW.delays;

export function getFlowDelay(name: string, fallbackMs: number): number {
  const value = FLOW_DELAYS[name];
  return typeof value === 'number' ? value : fallbackMs;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createStaticPaymentIntent(amount: number): Promise<PaymentIntentResult> {
  await delay(getFlowDelay('paymentIntentMs', 600));
  const suffix = `${Date.now()}`;
  return {
    paymentIntentId: `pi_static_${suffix}`,
    clientSecret: `pi_static_${suffix}_secret_${amount}`,
  };
}

export async function confirmStaticPaymentIntent(paymentIntentId: string): Promise<string> {
  await delay(getFlowDelay('paymentConfirmMs', 900));
  return paymentIntentId;
}
