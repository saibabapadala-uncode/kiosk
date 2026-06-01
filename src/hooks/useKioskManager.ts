// src/hooks/useKioskManager.ts
import { useCallback, useEffect } from 'react';
import { KioskManager } from '@/plugins/kiosk-manager';
import { logger } from '@/utils/logger';

export function useKioskManager() {
  // Apply kiosk hardening on mount
  useEffect(() => {
    async function harden() {
      try {
        await KioskManager.keepScreenAwake({ enabled: true });
        await KioskManager.setImmersiveMode({ enabled: true });
        await KioskManager.lockOrientation({ orientation: 'sensor_landscape' });
        logger.info('[kiosk] hardening applied');
      } catch (err) {
        logger.warn('[kiosk] hardening partial', err);
      }
    }
    void harden();

    return () => {
      void KioskManager.keepScreenAwake({ enabled: false }).catch(() => undefined);
    };
  }, []);

  const enableKioskLock = useCallback(async () => {
    const { enabled } = await KioskManager.enableKioskMode();
    logger.info(`[kiosk] lock task mode: ${enabled}`);
    return enabled;
  }, []);

  const disableKioskLock = useCallback(async () => {
    await KioskManager.disableKioskMode();
  }, []);

  const requestAdminAndBoot = useCallback(async () => {
    const { granted } = await KioskManager.requestDeviceAdmin();
    if (granted) {
      await KioskManager.setLaunchOnBoot({ enabled: true });
      logger.info('[kiosk] auto-start on boot configured');
    }
    return granted;
  }, []);

  return { enableKioskLock, disableKioskLock, requestAdminAndBoot };
}
