// src/hooks/useAppLifecycle.ts
// Handles Capacitor app pause / resume events.
// - On pause: cancel any active card collection (reader will time out otherwise)
// - On resume: verify reader still connected; auto-reconnect if it dropped and autoReconnect is on
import { useEffect } from 'react';
import { usePaymentStore } from '@/store/paymentStore';
import { useSettingsStore } from '@/store/settingsStore';
import { cancelPaymentFlow } from '@/services/stripe.service';
import {
  adapterGetConnectedReader,
  adapterConnectBluetoothReader,
  adapterConnectInternetReader,
  initializeAdapter,
} from '@/services/stripe/terminal.adapter';
import { flushOfflineOrderQueue } from '@/services/order.service';
import { logger } from '@/utils/logger';

async function unlockOrientation(): Promise<void> {
  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    await ScreenOrientation.unlock();
  } catch { /* web or plugin absent */ }
}

async function hideStatusBar(): Promise<void> {
  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.hide();
  } catch { /* web or plugin absent */ }
}

export function useAppLifecycle(): void {
  useEffect(() => {
    void unlockOrientation();
    void hideStatusBar();

    let resumeRef: { remove(): Promise<void> } | null = null;
    let pauseRef:  { remove(): Promise<void> } | null = null;

    async function setup() {
      try {
        const { App } = await import('@capacitor/app');

        resumeRef = await App.addListener('resume', async () => {
          logger.info('[lifecycle] app resumed');
          await unlockOrientation();
          void flushOfflineOrderQueue();

          try {
            const reader = await adapterGetConnectedReader();

            if (reader) {
              // Reader still connected — refresh store so UI stays accurate.
              usePaymentStore.getState().setConnectedReader(reader);
              logger.info('[lifecycle] reader still connected after background');
              return;
            }

            // Reader is gone — clear stale store entry.
            const prevReader = usePaymentStore.getState().connectedReader;
            if (prevReader) {
              logger.warn('[lifecycle] reader disconnected during background — clearing state');
              usePaymentStore.getState().setConnectedReader(null);
            }

            // Auto-reconnect if enabled and a reader serial is saved.
            const { payment } = useSettingsStore.getState();
            if (!payment.autoReconnect || !payment.readerSerialNumber.trim()) return;

            logger.info('[lifecycle] attempting auto-reconnect on resume to', payment.readerSerialNumber);
            usePaymentStore.getState().setReaderReconnecting(true);

            try {
              const ok = await initializeAdapter();
              if (!ok) return;

              const method = (payment.connectionMethod || 'bluetooth') as 'bluetooth' | 'internet';
              const reconReader = method === 'internet'
                ? await adapterConnectInternetReader(payment.readerSerialNumber)
                : await adapterConnectBluetoothReader(payment.readerSerialNumber, payment.terminalLocationId);

              usePaymentStore.getState().setConnectedReader(reconReader);
              useSettingsStore.getState().setPayment({ lastConnectedAt: new Date().toISOString() });
              logger.info('[lifecycle] resume auto-reconnect succeeded:', reconReader.serialNumber);
            } catch (err) {
              logger.warn('[lifecycle] resume auto-reconnect failed (non-fatal):', err);
            } finally {
              usePaymentStore.getState().setReaderReconnecting(false);
            }
          } catch { /* adapter not initialized or web context — ignore */ }
        });

        pauseRef = await App.addListener('pause', async () => {
          logger.info('[lifecycle] app paused');
          const { flowState } = usePaymentStore.getState();
          if (flowState === 'collecting') {
            logger.warn('[lifecycle] paused during card collection — canceling');
            await cancelPaymentFlow();
          }
        });
      } catch {
        // Web — no pause/resume events; no-op
      }
    }

    void setup();

    return () => {
      void resumeRef?.remove();
      void pauseRef?.remove();
    };
  }, []);
}
