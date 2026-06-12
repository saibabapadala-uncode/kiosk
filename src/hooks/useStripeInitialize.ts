// src/hooks/useStripeInitialize.ts
// Initializes the Stripe Terminal adapter once at app startup and restores
// any previously connected reader. Does NOT create a useReaderConnection
// instance — that avoids duplicate readerConnectionStatusChange listeners
// (useReaderConnection in PaymentTab already owns the reader lifecycle).

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { usePaymentStore } from '@/store/paymentStore';
import {
  initializeAdapter,
  adapterGetConnectedReader,
  adapterConnectBluetoothReader,
  adapterConnectInternetReader,
} from '@/services/stripe/terminal.adapter';
import { logger } from '@/utils/logger';

export function useStripeInitialize(): void {
  const initializedRef = useRef(false);

  useEffect(() => {
    async function setup() {
      if (initializedRef.current) return;

      const { payment } = useSettingsStore.getState();
      if (!payment.terminalLocationId.trim()) return;

      initializedRef.current = true;

      try {
        logger.info('[useStripeInitialize] initializing Stripe Terminal adapter');
        const ok = await initializeAdapter();
        if (!ok) return;

        // Restore reader if already connected from a previous session.
        const existing = await adapterGetConnectedReader();
        if (existing) {
          usePaymentStore.getState().setConnectedReader(existing);
          logger.info('[useStripeInitialize] restored connected reader:', existing.serialNumber);
          return;
        }

        // Attempt auto-reconnect if a serial number is saved and auto-reconnect is on.
        if (payment.readerSerialNumber.trim() && payment.autoReconnect) {
          logger.info('[useStripeInitialize] attempting auto-reconnect to', payment.readerSerialNumber);
          usePaymentStore.getState().setReaderReconnecting(true);

          try {
            const method = (payment.connectionMethod || 'bluetooth') as 'bluetooth' | 'internet';
            const reader = method === 'internet'
              ? await adapterConnectInternetReader(payment.readerSerialNumber)
              : await adapterConnectBluetoothReader(payment.readerSerialNumber, payment.terminalLocationId);

            usePaymentStore.getState().setConnectedReader(reader);
            useSettingsStore.getState().setPayment({ lastConnectedAt: new Date().toISOString() });
            logger.info('[useStripeInitialize] auto-reconnect succeeded:', reader.serialNumber);
          } catch (reconnectErr) {
            logger.warn('[useStripeInitialize] auto-reconnect failed (non-fatal):', reconnectErr);
          } finally {
            usePaymentStore.getState().setReaderReconnecting(false);
          }
        }
      } catch (err) {
        usePaymentStore.getState().setReaderReconnecting(false);
        logger.warn('[useStripeInitialize] startup setup failed (non-fatal):', err);
      }
    }

    void setup();
  }, []); // Run once on mount — reads settings at call time from store
}
