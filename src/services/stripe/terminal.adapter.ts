// src/services/stripe/terminal.adapter.ts
// Thin wrapper around the local Capacitor Stripe Terminal plugin.

import { api } from '@/services/api.service';
import { StripeTerminalNative } from '@/plugins/stripe-terminal';
import type { TerminalReader as PluginTerminalReader } from '@/plugins/stripe-terminal';
import {
  STATIC_READERS,
  USE_STATIC_PAYMENT_FLOW,
  confirmStaticPaymentIntent,
  createStaticPaymentIntent,
  delay,
  getFlowDelay,
} from './static.mock';
import {
  StripeTerminalError,
  type CreatePaymentIntentParams,
  type PaymentIntentResult,
  type TerminalReader,
} from './types';

let plugin: typeof StripeTerminalNative | null = null;
let initialized = false;
let staticPaymentIntentId = '';

function mapReader(reader: PluginTerminalReader): TerminalReader {
  return {
    serialNumber: reader.serialNumber,
    label: reader.label || reader.serialNumber,
    deviceType: reader.deviceType || 'unknown',
    batteryLevel: reader.batteryLevel >= 0 ? reader.batteryLevel : undefined,
    simulated: reader.isSimulated,
    locationId: reader.locationId,
    status: reader.status ?? 'unknown',
    ipAddress: reader.ipAddress,
  };
}

function getReadyPlugin(): typeof StripeTerminalNative {
  if (!plugin || !initialized) {
    throw new StripeTerminalError('TERMINAL_NOT_INITIALIZED', 'Terminal not initialized', false);
  }
  return plugin;
}

export async function initializeAdapter(): Promise<boolean> {
  if (initialized) return true;

  if (USE_STATIC_PAYMENT_FLOW) {
    initialized = true;
    return true;
  }

  plugin = StripeTerminalNative;

  try {
    await plugin.initialize();
    initialized = true;
    return true;
  } catch (err) {
    console.error('[StripeTerminal] init failed:', err);
    return false;
  }
}

export async function adapterDiscoverReaders(locationId: string): Promise<TerminalReader[]> {
  if (USE_STATIC_PAYMENT_FLOW) {
    await delay(getFlowDelay('discoverReadersMs', 700));
    return STATIC_READERS.map((reader) => ({ ...reader, locationId }));
  }

  const terminal = getReadyPlugin();

  const readers = await new Promise<PluginTerminalReader[]>((resolve, reject) => {
    let settled = false;
    let listener: { remove(): Promise<void> } | null = null;

    const finish = (nextReaders: PluginTerminalReader[]) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      void listener?.remove();
      resolve(nextReaders);
    };

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      void listener?.remove();
      reject(err);
    };

    const timeout = window.setTimeout(() => finish([]), 5_000);

    terminal.addListener('readersDiscovered', ({ readers }) => finish(readers))
      .then((handle) => {
        listener = handle;
        return terminal.discoverReaders({
          method: 'internet',
          locationId,
          simulated: false,
        });
      })
      .catch(fail);
  });

  return readers.map(mapReader);
}

export async function adapterConnectReader(serialNumber: string): Promise<void> {
  if (USE_STATIC_PAYMENT_FLOW) {
    await delay(getFlowDelay('connectReaderMs', 600));
    const reader = STATIC_READERS.find((r) => r.serialNumber === serialNumber);
    if (!reader) {
      throw new StripeTerminalError('READER_NOT_FOUND', 'Could not connect to reader', true);
    }
    return;
  }

  const terminal = getReadyPlugin();

  try {
    await terminal.connectInternetReader({ serialNumber });
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (msg.includes('offline') || msg.includes('not found')) {
      throw new StripeTerminalError('READER_OFFLINE', 'Reader is offline', false);
    }
    throw new StripeTerminalError('READER_NOT_FOUND', msg || 'Could not connect to reader', true);
  }
}

export async function adapterDisconnect(): Promise<void> {
  if (USE_STATIC_PAYMENT_FLOW) return;
  if (!plugin) return;
  try {
    await plugin.disconnectReader();
  } catch {
    // best effort
  }
}

export async function adapterCreatePaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<PaymentIntentResult> {
  if (USE_STATIC_PAYMENT_FLOW) {
    const intent = await createStaticPaymentIntent(params.amount);
    staticPaymentIntentId = intent.paymentIntentId;
    return intent;
  }

  const { data } = await api.post<PaymentIntentResult>('/stripe/payment-intent', {
    amount: params.amount,
    currency: params.currency,
    metadata: params.metadata,
  });
  return data;
}

export async function adapterCollectPayment(clientSecret: string): Promise<void> {
  if (USE_STATIC_PAYMENT_FLOW) {
    await delay(getFlowDelay('collectPaymentMs', 1_500));
    return;
  }

  const terminal = getReadyPlugin();

  try {
    await terminal.collectPaymentMethod({ clientSecret });
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (msg.includes('declined')) {
      throw new StripeTerminalError('CARD_DECLINED', 'Card was declined', true);
    }
    if (msg.includes('cancel') || msg.includes('abort')) {
      throw new StripeTerminalError('PAYMENT_CANCELED', 'Payment was canceled', true);
    }
    if (msg.includes('insufficient')) {
      throw new StripeTerminalError('INSUFFICIENT_FUNDS', 'Insufficient funds', true);
    }
    if (msg.includes('expired')) {
      throw new StripeTerminalError('CARD_EXPIRED', 'Card expired', true);
    }
    if (msg.includes('network') || msg.includes('timeout')) {
      throw new StripeTerminalError('NETWORK_ERROR', 'Network error', true);
    }
    throw new StripeTerminalError('UNKNOWN', msg || 'Collection error', true);
  }
}

export async function adapterConfirm(): Promise<string> {
  if (USE_STATIC_PAYMENT_FLOW) {
    return confirmStaticPaymentIntent(staticPaymentIntentId || `pi_static_confirmed_${Date.now()}`);
  }

  const terminal = getReadyPlugin();

  try {
    const result = await terminal.confirmPaymentIntent();
    return result.id;
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (msg.includes('declined')) {
      throw new StripeTerminalError('CARD_DECLINED', 'Card was declined', true);
    }
    throw new StripeTerminalError('UNKNOWN', msg || 'Confirm error', true);
  }
}

export async function adapterCancelCollect(): Promise<void> {
  if (USE_STATIC_PAYMENT_FLOW) return;
  if (!plugin || !initialized) return;
  try {
    await plugin.cancelCollect();
  } catch {
    // best effort
  }
}
