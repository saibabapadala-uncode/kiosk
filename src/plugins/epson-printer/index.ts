// src/plugins/epson-printer/index.ts
import { registerPlugin } from '@capacitor/core';
import type { EpsonPrinterPlugin } from './definitions';

const EpsonPrinter = registerPlugin<EpsonPrinterPlugin>('EpsonPrinter', {
  web: () => import('./web').then((m) => new m.EpsonPrinterWeb()),
});

export * from './definitions';
export { EpsonPrinter };
