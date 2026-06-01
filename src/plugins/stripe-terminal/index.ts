// src/plugins/stripe-terminal/index.ts
import { registerPlugin } from '@capacitor/core';
import type { StripeTerminalPlugin } from './definitions';

const StripeTerminalNative = registerPlugin<StripeTerminalPlugin>('StripeTerminal', {
  web: () => import('./web').then((m) => new m.StripeTerminalWeb()),
});

export * from './definitions';
export { StripeTerminalNative };
