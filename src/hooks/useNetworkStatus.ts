// src/hooks/useNetworkStatus.ts
// Bootstraps the Capacitor Network plugin and keeps networkStore in sync.
// Falls back to window.navigator.onLine events on web.
import { useEffect } from 'react';
import { useNetworkStore } from '@/store/networkStore';
import type { ConnectionType } from '@/store/networkStore';
import { logger } from '@/utils/logger';

export function useNetworkStatus(): void {
  const { setOnline, setConnectionType } = useNetworkStore();

  useEffect(() => {
    let isCleanedUp = false;
    let pluginListener: { remove(): Promise<void> } | null = null;
    let webCleanup: (() => void) | null = null;

    async function setupNative() {
      try {
        const { Network } = await import('@capacitor/network');
        const status = await Network.getStatus();
        if (isCleanedUp) return;
        setOnline(status.connected);
        setConnectionType(status.connectionType as ConnectionType);
        logger.info(`[network] initial — online=${status.connected} type=${status.connectionType}`);

        const handle = await Network.addListener('networkStatusChange', (s) => {
          setOnline(s.connected);
          setConnectionType(s.connectionType as ConnectionType);
          logger.info(`[network] changed — online=${s.connected} type=${s.connectionType}`);
        });

        if (isCleanedUp) {
          void handle.remove();
        } else {
          pluginListener = handle;
        }
      } catch {
        // Plugin not available on web — fall through to DOM events
        if (!isCleanedUp) {
          webCleanup = setupWeb();
        }
      }
    }

    function setupWeb() {
      const onOnline = () => { setOnline(true); setConnectionType('unknown'); };
      const onOffline = () => { setOnline(false); setConnectionType('none'); };
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      // Reflect initial state
      setOnline(navigator.onLine);
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }

    void setupNative();

    return () => {
      isCleanedUp = true;
      if (pluginListener) void pluginListener.remove();
      if (webCleanup) webCleanup();
    };
  }, [setOnline, setConnectionType]);
}
