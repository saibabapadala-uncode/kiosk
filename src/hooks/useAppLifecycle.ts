// src/hooks/useAppLifecycle.ts
// Handles Capacitor app pause / resume events.
// - On pause: cancel any active card collection (reader will time out otherwise)
// - On resume: flush offline order queue + lock orientation
import { useEffect } from 'react';
import { usePaymentStore } from '@/store/paymentStore';
import { cancelPaymentFlow } from '@/services/stripe.service';
import { flushOfflineOrderQueue } from '@/services/order.service';
import { logger } from '@/utils/logger';

async function lockLandscape(): Promise<void> {
  try {
    const { ScreenOrientation } = await import('@capacitor/screen-orientation');
    await ScreenOrientation.lock({ orientation: 'landscape' });
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
    // Lock orientation and hide status bar once on mount
    void lockLandscape();
    void hideStatusBar();

    let resumeRef: { remove(): Promise<void> } | null = null;
    let pauseRef:  { remove(): Promise<void> } | null = null;

    async function setup() {
      try {
        const { App } = await import('@capacitor/app');

        resumeRef = await App.addListener('resume', async () => {
          logger.info('[lifecycle] app resumed');
          await lockLandscape();
          void flushOfflineOrderQueue();
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
