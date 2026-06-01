// src/hooks/useEpsonPrinter.ts
import { useCallback, useEffect, useState } from 'react';
import { EpsonPrinter } from '@/plugins/epson-printer';
import type {
  PrinterConnectOptions,
  PrinterStatus,
  PrintReceiptOptions,
  BluetoothDevice,
} from '@/plugins/epson-printer';
import { useSettingsStore } from '@/store/settingsStore';
import { logger } from '@/utils/logger';

export type PrinterState = 'idle' | 'connecting' | 'connected' | 'printing' | 'error';

export interface UseEpsonPrinterReturn {
  state: PrinterState;
  status: PrinterStatus | null;
  error: string | null;
  bluetoothDevices: BluetoothDevice[];
  connect: (options: PrinterConnectOptions) => Promise<void>;
  disconnect: () => Promise<void>;
  print: (options: PrintReceiptOptions) => Promise<void>;
  openCashDrawer: () => Promise<void>;
  scanBluetooth: () => Promise<void>;
}

export function useEpsonPrinter(): UseEpsonPrinterReturn {
  const printerIp = useSettingsStore((s) => s.kiosk.receiptPrinterIp);
  const [state, setState] = useState<PrinterState>('idle');
  const [status, setStatus] = useState<PrinterStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDevice[]>([]);

  // Subscribe to printer status events
  useEffect(() => {
    let listener: { remove(): Promise<void> } | null = null;

    EpsonPrinter.addListener('printerStatusChange', (s) => {
      setStatus(s);
      if (!s.online) setState('error');
    }).then((l) => { listener = l; }).catch(logger.error);

    EpsonPrinter.addListener('printerError', ({ message }) => {
      setError(message);
      setState('error');
    }).catch(logger.error);

    return () => { void listener?.remove(); };
  }, []);

  const connect = useCallback(async (options: PrinterConnectOptions) => {
    setState('connecting');
    setError(null);
    try {
      await EpsonPrinter.connect(options);
      const s = await EpsonPrinter.getStatus();
      setStatus(s);
      setState('connected');
      logger.info(`[printer] connected via ${options.transport} to ${options.address}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(msg);
      setState('error');
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    await EpsonPrinter.disconnect();
    setState('idle');
    setStatus(null);
  }, []);

  const print = useCallback(async (options: PrintReceiptOptions) => {
    setState('printing');
    setError(null);
    try {
      // Auto-connect via ethernet if not already connected
      const { connected } = await EpsonPrinter.isConnected();
      if (!connected && printerIp) {
        await EpsonPrinter.connect({ transport: 'ethernet', address: printerIp });
      }
      await EpsonPrinter.printReceipt(options);
      setState('connected');
      logger.info('[printer] receipt printed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Print failed';
      setError(msg);
      setState('error');
      throw err;
    }
  }, [printerIp]);

  const openCashDrawer = useCallback(async () => {
    await EpsonPrinter.openCashDrawer();
    logger.info('[printer] cash drawer triggered');
  }, []);

  const scanBluetooth = useCallback(async () => {
    const { devices } = await EpsonPrinter.listBluetoothDevices();
    setBluetoothDevices(devices);
  }, []);

  return { state, status, error, bluetoothDevices, connect, disconnect, print, openCashDrawer, scanBluetooth };
}
