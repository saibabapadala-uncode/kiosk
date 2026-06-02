// src/services/stripe/terminal.adapter.ts
// Thin wrapper around the Capacitor Stripe Terminal plugin.
// Supports Bluetooth (M2), Internet, and Local Mobile connection modes.

import { api } from '@/services/api.service';
import { StripeTerminalNative } from '@/plugins/stripe-terminal';
import type { TerminalReader as PluginReader } from '@/plugins/stripe-terminal';
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

// ─── Mapping ──────────────────────────────────────────────────────────────────

function mapReader(r: PluginReader): TerminalReader {
  return {
    serialNumber: r.serialNumber,
    label:        r.label || r.serialNumber,
    deviceType:   r.deviceType || 'unknown',
    batteryLevel: r.batteryLevel >= 0 ? r.batteryLevel : undefined,
    simulated:    r.isSimulated,
    locationId:   r.locationId,
    status:       r.status ?? 'unknown',
    ipAddress:    r.ipAddress,
  };
}

function getPlugin(): typeof StripeTerminalNative {
  if (!plugin || !initialized) {
    throw new StripeTerminalError('TERMINAL_NOT_INITIALIZED', 'Terminal not initialized', false);
  }
  return plugin;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export async function initializeAdapter(): Promise<boolean> {
  if (initialized) return true;
  if (USE_STATIC_PAYMENT_FLOW) { initialized = true; return true; }

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

// ─── Discovery ────────────────────────────────────────────────────────────────
// Bluetooth (M2) needs a longer timeout — BLE scanning takes more time than
// an HTTP-based internet discovery.

export async function adapterDiscoverReaders(
  locationId: string,
  method: 'bluetooth' | 'internet' | 'localMobile' = 'bluetooth',
): Promise<TerminalReader[]> {
  if (USE_STATIC_PAYMENT_FLOW) {
    await delay(getFlowDelay('discoverReadersMs', 700));
    return STATIC_READERS.map((r) => ({ ...r, locationId }));
  }

  const terminal = getPlugin();
  const TIMEOUT_MS = method === 'bluetooth' ? 15_000 : 5_000;

  const readers = await new Promise<PluginReader[]>((resolve, reject) => {
    let settled = false;
    let listener: { remove(): Promise<void> } | null = null;

    const finish = (list: PluginReader[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      void listener?.remove();
      void terminal.cancelDiscovery().catch(() => {});
      resolve(list);
    };
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      void listener?.remove();
      reject(err);
    };

    const timeoutId = setTimeout(() => finish([]), TIMEOUT_MS);

    terminal.addListener('readersDiscovered', ({ readers: found }) => finish(found))
      .then((handle) => {
        listener = handle;
        return terminal.discoverReaders({ method, locationId, simulated: false });
      })
      .catch(fail);
  });

  return readers.map(mapReader);
}

// ─── Bluetooth connection — Stripe Reader M2 ──────────────────────────────────

export async function adapterConnectBluetoothReader(
  serialNumber: string,
  locationId: string,
): Promise<TerminalReader> {
  if (USE_STATIC_PAYMENT_FLOW) {
    await delay(getFlowDelay('connectReaderMs', 600));
    return {
      serialNumber,
      label:        `Stripe Reader M2 (${serialNumber.slice(-6)})`,
      deviceType:   'stripeM2',
      status:       'online',
      simulated:    true,
      batteryLevel: 0.85,
    };
  }

  const terminal = getPlugin();
  try {
    const reader = await terminal.connectBluetoothReader({ serialNumber, locationId });
    return mapReader(reader);
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (msg.includes('already') || msg.includes('connected')) {
      throw new StripeTerminalError('ALREADY_CONNECTED', 'Reader is already connected', false);
    }
    if (msg.includes('offline') || msg.includes('not found') || msg.includes('range')) {
      throw new StripeTerminalError(
        'READER_OFFLINE',
        'Reader not found. Ensure it is powered on and within Bluetooth range.',
        true,
      );
    }
    throw new StripeTerminalError('READER_NOT_FOUND', msg || 'Bluetooth connection failed', true);
  }
}

// ─── Internet connection ──────────────────────────────────────────────────────

export async function adapterConnectReader(serialNumber: string): Promise<void> {
  if (USE_STATIC_PAYMENT_FLOW) {
    await delay(getFlowDelay('connectReaderMs', 600));
    return;
  }

  const terminal = getPlugin();
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

// ─── Disconnect ───────────────────────────────────────────────────────────────

export async function adapterDisconnect(): Promise<void> {
  if (USE_STATIC_PAYMENT_FLOW) return;
  if (!plugin) return;
  try { await plugin.disconnectReader(); } catch { /* best effort */ }
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export async function adapterCreatePaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<PaymentIntentResult> {
  if (USE_STATIC_PAYMENT_FLOW) {
    const intent = await createStaticPaymentIntent(params.amount);
    staticPaymentIntentId = intent.paymentIntentId;
    return intent;
  }
  const { data } = await api.post<PaymentIntentResult>('/stripe/payment-intent', {
    amount:   params.amount,
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

  const terminal = getPlugin();
  try {
    await terminal.collectPaymentMethod({ clientSecret });
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (msg.includes('declined'))     throw new StripeTerminalError('CARD_DECLINED',      'Card was declined', true);
    if (msg.includes('cancel') || msg.includes('abort'))
                                      throw new StripeTerminalError('PAYMENT_CANCELED',   'Payment was canceled', true);
    if (msg.includes('insufficient')) throw new StripeTerminalError('INSUFFICIENT_FUNDS', 'Insufficient funds', true);
    if (msg.includes('expired'))      throw new StripeTerminalError('CARD_EXPIRED',       'Card expired', true);
    if (msg.includes('network') || msg.includes('timeout'))
                                      throw new StripeTerminalError('NETWORK_ERROR',      'Network error', true);
    throw new StripeTerminalError('UNKNOWN', msg || 'Collection error', true);
  }
}

export async function adapterConfirm(): Promise<string> {
  if (USE_STATIC_PAYMENT_FLOW) {
    return confirmStaticPaymentIntent(
      staticPaymentIntentId || `pi_static_confirmed_${Date.now()}`,
    );
  }

  const terminal = getPlugin();
  try {
    const result = await terminal.confirmPaymentIntent();
    return result.id;
  } catch (err: unknown) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (msg.includes('declined')) throw new StripeTerminalError('CARD_DECLINED', 'Card was declined', true);
    throw new StripeTerminalError('UNKNOWN', msg || 'Confirm error', true);
  }
}

export async function adapterCancelCollect(): Promise<void> {
  if (USE_STATIC_PAYMENT_FLOW) return;
  if (!plugin || !initialized) return;
  try { await plugin.cancelCollect(); } catch { /* best effort */ }
}
