// src/plugins/epson-printer/web.ts
// Web fallback for printer actions.

import { WebPlugin } from '@capacitor/core';
import type {
  EpsonPrinterPlugin,
  PrinterConnectOptions,
  PrinterStatus,
  PrintReceiptOptions,
  BluetoothDevice,
} from './definitions';
import { useSettingsStore } from '@/store/settingsStore';
import { delay, getFlowDelay } from '@/services/stripe/static.mock';
import { logger } from '@/utils/logger';

export class EpsonPrinterWeb extends WebPlugin implements EpsonPrinterPlugin {
  private connectedAddress: string | null = null;
  private connectedPort = 9100;

  async listBluetoothDevices(): Promise<{ devices: BluetoothDevice[] }> {
    logger.warn('[EpsonPrinter/web] Bluetooth device listing unavailable on web');
    return { devices: [] };
  }

  async connect(options: PrinterConnectOptions): Promise<void> {
    if (options.transport !== 'ethernet') {
      throw new Error(`Transport '${options.transport}' is not supported on web. Use 'ethernet'.`);
    }
    this.connectedAddress = options.address;
    this.connectedPort = options.port ?? 9100;
    logger.info(`[EpsonPrinter/web] connected to ${this.connectedAddress}:${this.connectedPort}`);
  }

  async disconnect(): Promise<void> {
    this.connectedAddress = null;
  }

  async isConnected(): Promise<{ connected: boolean }> {
    return { connected: this.connectedAddress !== null };
  }

  async getStatus(): Promise<PrinterStatus> {
    return { online: true, paperStatus: 'ok', coverOpen: false, drawerOpen: false, errorCode: 0 };
  }

  async printReceipt(options: PrintReceiptOptions): Promise<void> {
    const printerIp = this.connectedAddress ?? useSettingsStore.getState().kiosk.receiptPrinterIp;
    if (!printerIp) throw new Error('Not connected to a printer');
    logger.info(`[EpsonPrinter/web] static print accepted for ${printerIp}`);
    logger.debug('[EpsonPrinter/web] receipt lines', options.lines);
    await delay(getFlowDelay('receiptPrintMs', 500));
  }

  async openCashDrawer(): Promise<void> {
    const printerIp = this.connectedAddress ?? useSettingsStore.getState().kiosk.receiptPrinterIp;
    if (!printerIp) throw new Error('Not connected to a printer');
    logger.info(`[EpsonPrinter/web] static cash drawer open for ${printerIp}`);
    await delay(getFlowDelay('printerHealthMs', 300));
  }
}
