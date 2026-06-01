// src/plugins/kiosk-manager/web.ts
// Web fallback — uses Fullscreen API and disables idle timer where possible.
import { WebPlugin } from '@capacitor/core';
import type { KioskManagerPlugin, DeviceInfo } from './definitions';
import { logger } from '@/utils/logger';

export class KioskManagerWeb extends WebPlugin implements KioskManagerPlugin {
  async enableKioskMode(): Promise<{ enabled: boolean }> {
    try {
      await document.documentElement.requestFullscreen?.();
      logger.info('[KioskManager/web] fullscreen entered');
      return { enabled: true };
    } catch (e) {
      logger.warn('[KioskManager/web] fullscreen request failed', e);
      return { enabled: false };
    }
  }

  async disableKioskMode(): Promise<void> {
    await document.exitFullscreen?.().catch(() => undefined);
  }

  async isKioskModeEnabled(): Promise<{ enabled: boolean }> {
    return { enabled: !!document.fullscreenElement };
  }

  async keepScreenAwake(options: { enabled: boolean }): Promise<void> {
    // WakeLock API (Chrome 84+)
    if ('wakeLock' in navigator) {
      if (options.enabled) {
        await (navigator as { wakeLock: { request(type: string): Promise<unknown> } }).wakeLock.request('screen').catch(() => undefined);
      }
    } else {
      logger.warn('[KioskManager/web] WakeLock API not available');
    }
  }

  async setScreenBrightness(): Promise<void> {
    logger.warn('[KioskManager/web] screen brightness not controllable on web');
  }

  async setImmersiveMode(options: { enabled: boolean }): Promise<void> {
    await (options.enabled ? this.enableKioskMode() : this.disableKioskMode());
  }

  async lockOrientation(options: { orientation: string }): Promise<void> {
    const type = options.orientation === 'portrait' ? 'portrait-primary' : 'landscape-primary';
    await (screen.orientation as unknown as { lock?(t: string): Promise<void> })?.lock?.(type).catch(() => undefined);
  }

  async unlockOrientation(): Promise<void> {
    screen.orientation?.unlock?.();
  }

  async requestDeviceAdmin(): Promise<{ granted: boolean }> {
    logger.warn('[KioskManager/web] Device Admin not available on web');
    return { granted: false };
  }

  async isDeviceAdmin(): Promise<{ granted: boolean }> {
    return { granted: false };
  }

  async setLaunchOnBoot(): Promise<void> {
    logger.warn('[KioskManager/web] boot launch not available on web');
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      manufacturer: navigator.vendor || 'unknown',
      model: navigator.platform || 'web',
      osVersion: navigator.userAgent,
      isKioskModeActive: !!document.fullscreenElement,
      isDeviceAdmin: false,
      screenBrightness: 1,
    };
  }
}
