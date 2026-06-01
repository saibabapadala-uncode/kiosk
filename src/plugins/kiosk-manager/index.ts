// src/plugins/kiosk-manager/index.ts
import { registerPlugin } from '@capacitor/core';
import type { KioskManagerPlugin } from './definitions';

const KioskManager = registerPlugin<KioskManagerPlugin>('KioskManager', {
  web: () => import('./web').then((m) => new m.KioskManagerWeb()),
});

export * from './definitions';
export { KioskManager };
