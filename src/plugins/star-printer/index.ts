// src/plugins/star-printer/index.ts
import { registerPlugin } from '@capacitor/core';
import type { StarPrinterPlugin, DeviceStatusPlugin } from './definitions';
import { StarPrinterWeb, DeviceStatusWeb } from './web';

const StarPrinterNative = registerPlugin<StarPrinterPlugin>('StarPrinterReceipt', {
  web: () => new StarPrinterWeb(),
});

const DeviceStatusNative = registerPlugin<DeviceStatusPlugin>('DevicesStatusPlugin', {
  web: () => new DeviceStatusWeb(),
});

export { StarPrinterNative, DeviceStatusNative };
export type { StarPrinterPlugin, DeviceStatusPlugin, StarBluetoothDevice, StarPrintOptions, StarLanPrintOptions } from './definitions';
