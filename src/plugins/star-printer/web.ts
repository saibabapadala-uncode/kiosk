// src/plugins/star-printer/web.ts
// Web fallback — no real hardware access in browser.

import { WebPlugin } from '@capacitor/core';
import type {
  StarPrinterPlugin,
  StarPrintOptions,
  StarLanPrintOptions,
  StarBluetoothDevice,
  DeviceStatusPlugin,
} from './definitions';

export class StarPrinterWeb extends WebPlugin implements StarPrinterPlugin {
  async echo(options: StarPrintOptions): Promise<StarPrintOptions> {
    console.log('[StarPrinter/web] echo (no-op on web):', options.printerName);
    return options;
  }

  async openCashDrawer(options: { printerName: string; printerAddress: string }) {
    console.log('[StarPrinter/web] openCashDrawer (no-op on web):', options.printerName);
    return options;
  }

  async printText(options: StarLanPrintOptions): Promise<{ status: string; message: string }> {
    console.log('[StarPrinter/web] printText (no-op on web):', options.ip);
    return { status: 'success', message: 'Simulated print (web)' };
  }

  async startScan(): Promise<void> {
    console.warn('[StarPrinter/web] Bluetooth scanning not supported on web.');
    setTimeout(() => {
      this.notifyListeners('bluetoothDeviceFound', { devices: [] });
    }, 500);
  }

  async requestBluetoothPermissions(): Promise<void> {
    console.warn('[StarPrinter/web] Bluetooth permissions not supported on web.');
  }

  async pairDevice(_options: { address: string }): Promise<{ status: string }> {
    console.warn('[StarPrinter/web] pairDevice not supported on web.');
    return { status: 'unsupported' };
  }

  async unpairDevice(_options: { address: string }): Promise<{ status: string }> {
    console.warn('[StarPrinter/web] unpairDevice not supported on web.');
    return { status: 'unsupported' };
  }

  async fetchPairedDevices(): Promise<{ devices: StarBluetoothDevice[] }> {
    return { devices: [] };
  }

  async fetchConnectedDevices(): Promise<{ devices: StarBluetoothDevice[] }> {
    return { devices: [] };
  }

  async searchDevice(options: {
    deviceName: string;
    deviceAddress: string;
    deviceMake: string;
  }) {
    console.warn('[StarPrinter/web] searchDevice not supported on web.');
    return options;
  }

  async allowPermissions(): Promise<{ bluetooth: boolean; location: boolean }> {
    return { bluetooth: true, location: true };
  }

  async getMacAddress(): Promise<void> {
    console.warn('[StarPrinter/web] getMacAddress not supported on web.');
  }

  async getConnectionToken(options: { Token: string }): Promise<{ Token: string }> {
    console.log('[StarPrinter/web] getConnectionToken:', options);
    return options;
  }

  async getReaderDetails(options: { Reader: string; ReaderName: string }): Promise<{ Reader: string; ReaderName: string }> {
    console.log('[StarPrinter/web] getReaderDetails:', options);
    return options;
  }

  async createAndProcessPayment(options: { deviceName: string; deviceAddress: string; constructedObj: {} }): Promise<{
    deviceName: string;
    deviceAddress: string;
    constructedObj: {};
  }> {
    console.log('[StarPrinter/web] createAndProcessPayment:', options);
    return options;
  }

  async getM2ReaderInfo(): Promise<any> {
    return {};
  }
}

export class DeviceStatusWeb extends WebPlugin implements DeviceStatusPlugin {
  async allowPermissions(): Promise<{ bluetooth: boolean; location: boolean }> {
    return { bluetooth: true, location: true };
  }

  async getPrinterDetails(_options: { printerName: string; printerAddress: string }) {
    return {};
  }
}
