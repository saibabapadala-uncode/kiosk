// src/hooks/useStripeInitialize.ts
// Auto-initializes Stripe Terminal SDK and attempts to restore previous reader connection.
// Called once at app startup to ensure the system is ready for payments.

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useReaderConnection } from './useReaderConnection';
import { logger } from '@/utils/logger';

export function useStripeInitialize() {
  const { payment } = useSettingsStore();
  const { initialize, connect } = useReaderConnection();
  const initializedRef = useRef(false);

  useEffect(() => {
    async function setupStripe() {
      if (initializedRef.current) return;
      if (!payment.terminalLocationId.trim()) return;

      initializedRef.current = true;

      try {
        logger.info('[useStripeInitialize] initializing Stripe Terminal SDK');
        await initialize();

        // Auto-reconnect to the saved reader serial number if available
        if (payment.readerSerialNumber.trim() && payment.autoReconnect) {
          logger.info(`[useStripeInitialize] attempting to reconnect to ${payment.readerSerialNumber}`);
          await connect(payment.readerSerialNumber);
        }
      } catch (err) {
        logger.error('[useStripeInitialize] setup failed', err);
      }
    }

    void setupStripe();
  }, [payment.terminalLocationId, payment.readerSerialNumber, payment.autoReconnect, initialize, connect]);
}
