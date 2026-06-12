import { registerPlugin } from '@capacitor/core';

import type { StarPrinterReceiptPlugin, DeviceStatusPlugin } from './definitions';

const StarPrinterReceipt = registerPlugin<StarPrinterReceiptPlugin>('StarPrinterReceipt', {
  web: () => import('./web').then((m) => new m.StarPrinterReceiptWeb()),
});

const DevicesStatusPlugin = registerPlugin<DeviceStatusPlugin>('DevicesStatusPlugin', {
  web: () => import('./web').then((m) => new m.DeviceStatusPluginWeb()),
});

export * from './definitions';
export { StarPrinterReceipt, DevicesStatusPlugin };

