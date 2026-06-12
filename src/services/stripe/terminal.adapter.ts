// src/services/stripe/terminal.adapter.ts
// Thin wrapper around the Capacitor StarPrinterReceipt plugin for Stripe Terminal connections.
// Bridges standard Stripe Terminal adapter signatures to unified native plugin calls.

import { StarPrinterNative } from '@/plugins/star-printer';
import { StripeTerminalNative } from '@/plugins/stripe-terminal';
import { useSettingsStore } from '@/store/settingsStore';
import {
  StripeTerminalError,
  type TerminalErrorCode,
  type TerminalReader,
} from './types';

let initialized = false;

// ─── Permission / error message classifier ────────────────────────────────────
function classifyErrorMessage(raw: string): TerminalErrorCode {
  const msg = raw.toLowerCase();

  if (msg.includes('bluetooth is powered off') || msg.includes('bluetooth off') ||
      msg.includes('bluetooth disabled') || msg.includes('bluetooth is off') ||
      msg.includes('bluetooth_off') || msg.includes('bluetooth not enabled')) {
    return 'BLUETOOTH_DISABLED';
  }

  if ((msg.includes('bluetooth') && (msg.includes('permission') || msg.includes('denied') || msg.includes('not authorized'))) ||
      msg.includes('bluetooth_scan_permission') || msg.includes('bluetooth_connect_permission')) {
    return 'BLUETOOTH_PERMISSION_DENIED';
  }

  if ((msg.includes('location') && (msg.includes('permission') || msg.includes('denied') || msg.includes('not authorized'))) ||
      msg.includes('access_fine_location') || msg.includes('access_coarse_location')) {
    return 'LOCATION_PERMISSION_DENIED';
  }

  if (msg.includes('nfc') && (msg.includes('unavailable') || msg.includes('not supported') || msg.includes('disabled'))) {
    return 'NFC_UNAVAILABLE';
  }

  if (msg.includes('already') && msg.includes('connected')) {
    return 'ALREADY_CONNECTED';
  }

  if (msg.includes('offline') || msg.includes('out of range') || msg.includes('not found') ||
      msg.includes('range') || msg.includes('no reader')) {
    return 'READER_OFFLINE';
  }

  if (msg.includes('network') || msg.includes('internet') || msg.includes('connection') ||
      msg.includes('no route') || msg.includes('unreachable')) {
    return 'NETWORK_ERROR';
  }

  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'TIMEOUT';
  }

  if (msg.includes('declined'))       return 'CARD_DECLINED';
  if (msg.includes('insufficient'))   return 'INSUFFICIENT_FUNDS';
  if (msg.includes('expired'))        return 'CARD_EXPIRED';
  if (msg.includes('cancel') || msg.includes('abort')) return 'PAYMENT_CANCELED';
  if (msg.includes('incorrect pin'))  return 'INCORRECT_PIN';

  return 'UNKNOWN';
}

function mapReader(r: any): TerminalReader {
  return {
    serialNumber: r.serialNumber || r.serial_no || '',
    label:        r.label || r.serialNumber || r.serial_no || 'Stripe Reader',
    deviceType:   r.deviceType || 'M2',
    batteryLevel: r.batteryLevel >= 0 ? r.batteryLevel : undefined,
    simulated:    false,
    locationId:   r.locationId || r.location_id || '',
    status:       'online',
  };
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export async function initializeAdapter(): Promise<boolean> {
  if (initialized) return true;

  try {
    const { payment } = useSettingsStore.getState();
    const payload = {
      tenant_data_form: { mapper_fields: [] },
      configurations: [{ priority: 1, key: payment.stripePayKey, Description: 'StripeConnect' }],
      store_id: payment.storeId,
      location_id: payment.terminalLocationId,
      env_type: payment.envType,
      merchant_id: payment.merchantId,
    };

    const res = await fetch(
      'https://e5e667hh4-qpayment.uncodeapi.com/api/callback/connection_token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) throw new Error(`connection-token HTTP ${res.status}`);
    const data = await res.json() as { secret?: string; data?: { secret: string } };
    const secret = data?.secret ?? data?.data?.secret;

    if (!secret) throw new Error('Secret not returned from connection token endpoint');

    await StarPrinterNative.getConnectionToken({ Token: secret });
    initialized = true;
    return true;
  } catch (err) {
    console.error('[StarPrinter/StripeAdapter] initializeAdapter failed:', err);
    return false;
  }
}

// ─── Bluetooth / Internet Connections ──────────────────────────────────────────

export async function adapterConnectBluetoothReader(
  serialNumber: string,
  _locationId: string,
): Promise<TerminalReader> {
  try {
    await initializeAdapter();
    await StarPrinterNative.getReaderDetails({
      Reader: 'M2',
      ReaderName: serialNumber,
    });

    const reader = await StarPrinterNative.getM2ReaderInfo();
    if (!reader || !reader.serialNumber) {
      throw new Error('Reader connection failed or returned invalid reader info');
    }

    return mapReader(reader);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = classifyErrorMessage(msg);
    throw new StripeTerminalError(
      code,
      msg || 'Bluetooth connection failed',
      code !== 'BLUETOOTH_PERMISSION_DENIED' && code !== 'BLUETOOTH_DISABLED',
    );
  }
}

export async function adapterConnectInternetReader(serialNumber: string): Promise<TerminalReader> {
  try {
    await initializeAdapter();
    await StarPrinterNative.getReaderDetails({
      Reader: 'S700',
      ReaderName: serialNumber,
    });

    const reader = await StarPrinterNative.getM2ReaderInfo();
    if (!reader || !reader.serialNumber) {
      throw new Error('Reader connection failed or returned invalid reader info');
    }

    return mapReader(reader);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = classifyErrorMessage(msg);
    throw new StripeTerminalError(code, msg || 'Internet connection failed', true);
  }
}

export async function adapterConnectLocalMobileReader(_locationId: string): Promise<TerminalReader> {
  throw new Error('Tap to Pay / Local Mobile is not supported by StarPrinterReceipt plugin');
}

export async function adapterConnectReader(serialNumber: string): Promise<void> {
  await adapterConnectInternetReader(serialNumber);
}

// ─── Disconnect & Cancel ───────────────────────────────────────────────────────

/**
 * Reset the initialized flag so the next connection attempt fetches a fresh
 * connection token. Call after a manual disconnect or unexpected drop to ensure
 * the Stripe SDK is fully re-initialized before the next reader connection.
 */
export function resetAdapter(): void {
  initialized = false;
}

export async function adapterDisconnect(): Promise<void> {
  try {
    await StripeTerminalNative.disconnectReader();
  } catch {
    // Reader may already be disconnected or the plugin is unavailable on web.
  } finally {
    // Force a fresh connection-token fetch on the next connect attempt so the
    // Stripe SDK initializes cleanly rather than reusing a potentially stale session.
    initialized = false;
  }
}

export async function adapterCancelCollect(): Promise<void> {
  // StarPrinterReceipt handles collection cancellation natively.
  return Promise.resolve();
}

// ─── Reader Status ────────────────────────────────────────────────────────────

export async function adapterGetConnectedReader(): Promise<TerminalReader | null> {
  try {
    const reader = await StarPrinterNative.getM2ReaderInfo();
    if (reader && reader.serialNumber) {
      return mapReader(reader);
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Mock compatibility layers ─────────────────────────────────────────────────

export async function adapterListBluetoothDevices(): Promise<any[]> {
  try {
    const { devices } = await StarPrinterNative.fetchPairedDevices();
    return devices;
  } catch {
    return [];
  }
}

export async function adapterScanBluetoothDevices(): Promise<any[]> {
  try {
    await StarPrinterNative.startScan();
    return [];
  } catch {
    return [];
  }
}

export async function adapterDiscoverReaders(
  _locationId: string,
  _method: 'bluetooth' | 'internet' | 'localMobile' = 'bluetooth',
): Promise<TerminalReader[]> {
  // No discovery required since connection is direct via getReaderDetails
  const connected = await adapterGetConnectedReader();
  return connected ? [connected] : [];
}

// Empty placeholders since StarPrinterNative createAndProcessPayment wraps these natively
export async function adapterCreatePaymentIntent(_params: any): Promise<any> {
  return Promise.resolve({ clientSecret: '', paymentIntentId: '' });
}
export async function adapterCollectPayment(_clientSecret: string): Promise<void> {
  return Promise.resolve();
}
export async function adapterConfirm(): Promise<string> {
  return Promise.resolve('');
}
