import flowData from '@/mock/flow.json';
import type { TerminalReader } from './types';

type FlowConfig = {
  delays: Record<string, number>;
};

const FLOW = flowData as FlowConfig;

export const FLOW_DELAYS = FLOW.delays;

// Hardcoded false — real Stripe Terminal SDK is always used.
// Keeping the export so files that guard behaviour with this flag compile
// without changes; TypeScript sees `false as const` and treats every
// `if (USE_STATIC_PAYMENT_FLOW)` branch as unreachable dead code.
export const USE_STATIC_PAYMENT_FLOW = false as const;

// Minimal simulator reader used only by the web-platform fallback (browser dev).
export const STATIC_READERS: TerminalReader[] = [
  {
    serialNumber: 'STRM-SIM-001',
    label: 'Stripe Reader M2 (Simulator)',
    deviceType: 'stripeM2',
    batteryLevel: 1,
    simulated: true,
    status: 'online',
  },
];

export function getFlowDelay(name: string, fallbackMs: number): number {
  const value = FLOW_DELAYS[name];
  return typeof value === 'number' ? value : fallbackMs;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createStaticPaymentIntent(
  amount: number,
): Promise<{ paymentIntentId: string; clientSecret: string }> {
  await delay(getFlowDelay('paymentIntentMs', 600));
  const suffix = `${Date.now()}`;
  return {
    paymentIntentId: `pi_sim_${suffix}`,
    clientSecret: `pi_sim_${suffix}_secret_${amount}`,
  };
}

export async function confirmStaticPaymentIntent(paymentIntentId: string): Promise<string> {
  await delay(getFlowDelay('paymentConfirmMs', 900));
  return paymentIntentId;
}
