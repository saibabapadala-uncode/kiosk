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
    let pluginListener: { remove(): Promise<void> } | null = null;

    async function setupNative() {
      try {
        const { Network } = await import('@capacitor/network');
        const status = await Network.getStatus();
        setOnline(status.connected);
        setConnectionType(status.connectionType as ConnectionType);
        logger.info(`[network] initial — online=${status.connected} type=${status.connectionType}`);

        pluginListener = await Network.addListener('networkStatusChange', (s) => {
          setOnline(s.connected);
          setConnectionType(s.connectionType as ConnectionType);
          logger.info(`[network] changed — online=${s.connected} type=${s.connectionType}`);
        });
      } catch {
        // Plugin not available on web — fall through to DOM events
        setupWeb();
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
      void pluginListener?.remove();
    };
  }, [setOnline, setConnectionType]);
}
