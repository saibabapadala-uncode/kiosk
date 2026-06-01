// src/plugins/kiosk-manager/definitions.ts

export interface DeviceInfo {
  manufacturer: string;
  model: string;
  osVersion: string;
  isKioskModeActive: boolean;
  isDeviceAdmin: boolean;
  screenBrightness: number; // 0–1
}

export interface KioskManagerPlugin {
  // ── Kiosk / lock-task ─────────────────────────────────────────────────────
  /** Android Lock Task mode / iOS Guided Access instructions */
  enableKioskMode(): Promise<{ enabled: boolean }>;
  disableKioskMode(): Promise<void>;
  isKioskModeEnabled(): Promise<{ enabled: boolean }>;

  // ── Screen ────────────────────────────────────────────────────────────────
  keepScreenAwake(options: { enabled: boolean }): Promise<void>;
  setScreenBrightness(options: { brightness: number }): Promise<void>;

  /** Android: immersive sticky fullscreen (hides status + nav bars). */
  setImmersiveMode(options: { enabled: boolean }): Promise<void>;

  // ── Orientation ───────────────────────────────────────────────────────────
  lockOrientation(options: {
    orientation: 'landscape' | 'portrait' | 'landscape_reverse' | 'sensor_landscape';
  }): Promise<void>;
  unlockOrientation(): Promise<void>;

  // ── Device admin (Android) ────────────────────────────────────────────────
  /** Check and optionally prompt Device Admin activation. */
  requestDeviceAdmin(): Promise<{ granted: boolean }>;
  isDeviceAdmin(): Promise<{ granted: boolean }>;

  // ── Boot ──────────────────────────────────────────────────────────────────
  /** Configure the app to auto-launch on device boot (requires Device Admin). */
  setLaunchOnBoot(options: { enabled: boolean }): Promise<void>;

  // ── Info ──────────────────────────────────────────────────────────────────
  getDeviceInfo(): Promise<DeviceInfo>;
}
