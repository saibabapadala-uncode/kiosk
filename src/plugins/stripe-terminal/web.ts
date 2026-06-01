// src/plugins/stripe-terminal/web.ts
// Web fallback for the local Capacitor Stripe Terminal plugin.

import { WebPlugin } from '@capacitor/core';
import type {
  StripeTerminalPlugin,
  TerminalReader,
  CollectPaymentOptions,
  ConfirmPaymentResult,
  OfflineStatus,
} from './definitions';
import { STATIC_READERS, delay, getFlowDelay } from '@/services/stripe/static.mock';
import { logger } from '@/utils/logger';

const SIMULATED_READER: TerminalReader = {
  serialNumber: STATIC_READERS[0].serialNumber,
  label: STATIC_READERS[0].label,
  deviceType: 'unknown',
  status: 'online',
  batteryLevel: 1,
  locationId: STATIC_READERS[0].locationId,
  ipAddress: STATIC_READERS[0].ipAddress,
  isSimulated: true,
};

export class StripeTerminalWeb extends WebPlugin implements StripeTerminalPlugin {
  private connectedReader: TerminalReader | null = null;
  private clientSecret: string | null = null;
  private paymentIntentId: string | null = null;

  async initialize(): Promise<void> {
    await delay(getFlowDelay('connectionTestMs', 200));
    logger.info('[StripeTerminal/web] initialized static simulator');
  }

  async fetchConnectionToken(): Promise<{ secret: string }> {
    await delay(getFlowDelay('connectionTestMs', 200));
    return { secret: `pst_static_${Date.now()}` };
  }

  async discoverReaders(): Promise<void> {
    await delay(getFlowDelay('discoverReadersMs', 400));
    this.connectedReader = null;
    this.notifyListeners('readersDiscovered', { readers: [SIMULATED_READER] });
  }

  async cancelDiscovery(): Promise<void> {
    // no-op on web
  }

  async connectBluetoothReader(): Promise<TerminalReader> {
    await delay(getFlowDelay('connectReaderMs', 400));
    this.connectedReader = SIMULATED_READER;
    this.notifyListeners('readerConnectionStatusChange', { status: 'connected' });
    return SIMULATED_READER;
  }

  async connectInternetReader(options: { serialNumber: string }): Promise<TerminalReader> {
    await delay(getFlowDelay('connectReaderMs', 400));
    const reader = { ...SIMULATED_READER, serialNumber: options.serialNumber };
    this.connectedReader = reader;
    this.notifyListeners('readerConnectionStatusChange', { status: 'connected' });
    return reader;
  }

  async connectLocalMobileReader(): Promise<TerminalReader> {
    await delay(getFlowDelay('connectReaderMs', 400));
    this.connectedReader = SIMULATED_READER;
    this.notifyListeners('readerConnectionStatusChange', { status: 'connected' });
    return SIMULATED_READER;
  }

  async disconnectReader(): Promise<void> {
    this.connectedReader = null;
    this.notifyListeners('readerConnectionStatusChange', { status: 'not_connected' });
  }

  async getConnectedReader(): Promise<{ reader: TerminalReader | null }> {
    return { reader: this.connectedReader };
  }

  async retrievePaymentIntent(options: { clientSecret: string }): Promise<void> {
    await delay(getFlowDelay('paymentIntentMs', 200));
    this.clientSecret = options.clientSecret;
    this.paymentIntentId = options.clientSecret.split('_secret_')[0];
  }

  async collectPaymentMethod(options: CollectPaymentOptions): Promise<void> {
    this.clientSecret = options.clientSecret;
    this.paymentIntentId = options.clientSecret.split('_secret_')[0];
    this.notifyListeners('paymentStatusChange', { status: 'waiting_for_input' });
    this.notifyListeners('readerInputOptions', { options: ['tap', 'chip', 'swipe'] });
    await delay(getFlowDelay('collectPaymentMs', 1_500));
    this.notifyListeners('readerDisplayMessage', { message: 'remove_card' });
    this.notifyListeners('paymentStatusChange', { status: 'processing' });
  }

  async confirmPaymentIntent(): Promise<ConfirmPaymentResult> {
    if (!this.paymentIntentId) throw new Error('No payment intent to confirm');
    await delay(getFlowDelay('paymentConfirmMs', 800));
    return {
      id: this.paymentIntentId,
      status: 'succeeded',
      amount: 0,
      currency: 'usd',
    };
  }

  async cancelCollect(): Promise<void> {
    this.notifyListeners('paymentStatusChange', { status: 'ready' });
  }

  async getOfflineStatus(): Promise<OfflineStatus> {
    return { pendingPaymentAmount: 0, pendingPaymentsCount: 0, networkStatus: 'online' };
  }
}
