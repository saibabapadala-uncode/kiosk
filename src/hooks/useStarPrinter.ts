// src/hooks/useStarPrinter.ts
// StarMicronics + Bluetooth printer lifecycle manager.
// Mirrors the bluetooth.service.ts + global.service.ts patterns from kiosk_straunt_storefront.

import { useCallback, useEffect, useRef, useState } from 'react';
import { StarPrinterNative } from '@/plugins/star-printer';
import { renderReceiptToBase64 } from '@/utils/receiptCanvas';
import type { StarBluetoothDevice } from '@/plugins/star-printer';
import { useSettingsStore } from '@/store/settingsStore';
import { logger } from '@/utils/logger';

export type PrinterStatus = 'idle' | 'scanning' | 'pairing' | 'connecting' | 'connected' | 'printing' | 'error';

export interface StarPrinterDevice {
  name: string;
  address: string;
  bonded: boolean;
  connected: boolean;
  isDefault: boolean;
}

export interface UseStarPrinterReturn {
  status: PrinterStatus;
  error: string | null;
  scannedDevices: StarPrinterDevice[];
  pairedDevices: StarPrinterDevice[];
  connectedDevice: StarPrinterDevice | null;
  bluetoothEnabled: boolean;
  isScanning: boolean;
  scanDevices: () => Promise<void>;
  loadPairedDevices: () => Promise<void>;
  pairDevice: (address: string) => Promise<void>;
  unpairDevice: (address: string) => Promise<void>;
  setDefaultPrinter: (device: StarPrinterDevice, role: 'customer' | 'kitchen') => void;
  testPrint: (device: StarPrinterDevice) => Promise<void>;
  testPrintLan: (ip: string, model: string) => Promise<void>;
  clearError: () => void;
}

function isPrinterDevice(name: string): boolean {
  const n = (name || '').toLowerCase();
  return (
    n.includes('star') || n.includes('tsp') || n.includes('sp700') ||
    n.includes('mprint') || n.includes('epson') || n.includes('tm-') ||
    n.includes('printer') || n.includes('bixolon') || n.includes('sewoo') ||
    n.includes('woosim') || n.includes('citizen') || n.includes('receipt')
  );
}

function mergeDevices(
  existing: StarPrinterDevice[],
  incoming: StarBluetoothDevice[],
  connectedAddresses: Set<string>,
  defaultAddress: string,
): StarPrinterDevice[] {
  const byAddress = new Map<string, StarPrinterDevice>();
  for (const d of existing) byAddress.set(d.address, d);
  for (const d of incoming) {
    byAddress.set(d.address, {
      name: d.name,
      address: d.address,
      bonded: d.bonded ?? false,
      connected: connectedAddresses.has(d.address),
      isDefault: d.address === defaultAddress,
    });
  }
  return Array.from(byAddress.values()).sort((a, b) => {
    if (a.bonded !== b.bonded) return a.bonded ? -1 : 1;
    if (a.connected !== b.connected) return a.connected ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function useStarPrinter(): UseStarPrinterReturn {
  const { printer, setPrinter } = useSettingsStore();

  const [status, setStatus] = useState<PrinterStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [scannedDevices, setScannedDevices] = useState<StarPrinterDevice[]>([]);
  const [pairedDevices, setPairedDevices] = useState<StarPrinterDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<StarPrinterDevice | null>(null);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  const connectedAddressesRef = useRef<Set<string>>(new Set());
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Subscribe to Bluetooth state changes and device-found events
  useEffect(() => {
    let isCleanedUp = false;
    let devicesListener: { remove(): Promise<void> } | null = null;
    let pairingListener: { remove(): Promise<void> } | null = null;
    let btStateListener: { remove(): Promise<void> } | null = null;

    async function subscribe() {
      try {
        const dHandle = await StarPrinterNative.addListener('bluetoothDeviceFound', ({ devices }) => {
          const printers = devices.filter((d) => isPrinterDevice(d.name));
          setScannedDevices((existing) =>
            mergeDevices(
              existing,
              printers,
              connectedAddressesRef.current,
              printer.defaultPrinterAddress,
            ),
          );
        });

        if (isCleanedUp) {
          void dHandle.remove();
        } else {
          devicesListener = dHandle;
        }

        const pHandle = await StarPrinterNative.addListener('bluetoothPairingStatus', ({ address, status: pStatus }) => {
          logger.info(`[StarPrinter] pairing status ${pStatus} for ${address}`);
          if (pStatus === 'bonded' || pStatus === 'success') {
            setScannedDevices((existing) =>
              existing.map((d) => d.address === address ? { ...d, bonded: true } : d),
            );
            setPairedDevices((existing) => {
              const found = existing.find((d) => d.address === address);
              if (found) return existing.map((d) => d.address === address ? { ...d, bonded: true } : d);
              const match = scannedDevices.find((d) => d.address === address);
              if (match) return [...existing, { ...match, bonded: true }];
              return existing;
            });
          }
          if (pStatus === 'bonded' || pStatus === 'success') setStatus('idle');
          if (pStatus === 'failed' || pStatus === 'error') {
            setStatus('error');
            setError(`Pairing failed for ${address}`);
          }
        });

        if (isCleanedUp) {
          void pHandle.remove();
        } else {
          pairingListener = pHandle;
        }

        const bHandle = await StarPrinterNative.addListener('bluetoothStateChange', ({ isEnabled }) => {
          setBluetoothEnabled(isEnabled);
          if (!isEnabled) {
            setScannedDevices([]);
            setStatus('idle');
          }
        });

        if (isCleanedUp) {
          void bHandle.remove();
        } else {
          btStateListener = bHandle;
        }
      } catch (err) {
        logger.warn('[StarPrinter] listener setup failed:', err);
      }
    }

    void subscribe();
    return () => {
      isCleanedUp = true;
      if (devicesListener) void devicesListener.remove();
      if (pairingListener) void pairingListener.remove();
      if (btStateListener) void btStateListener.remove();
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printer.defaultPrinterAddress]);

  const loadPairedDevices = useCallback(async () => {
    try {
      const [pairedRes, connectedRes] = await Promise.all([
        StarPrinterNative.fetchPairedDevices(),
        StarPrinterNative.fetchConnectedDevices(),
      ]);

      const connectedAddresses = new Set(connectedRes.devices.map((d) => d.address));
      connectedAddressesRef.current = connectedAddresses;

      const printers = pairedRes.devices.filter((d) => isPrinterDevice(d.name));
      const mapped: StarPrinterDevice[] = printers.map((d) => ({
        name: d.name,
        address: d.address,
        bonded: true,
        connected: connectedAddresses.has(d.address),
        isDefault: d.address === printer.defaultPrinterAddress,
      }));

      mapped.sort((a, b) => {
        if (a.connected !== b.connected) return a.connected ? -1 : 1;
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      setPairedDevices(mapped);

      const connected = mapped.find((d) => d.connected);
      if (connected) setConnectedDevice(connected);
    } catch (err) {
      logger.warn('[StarPrinter] loadPairedDevices failed:', err);
    }
  }, [printer.defaultPrinterAddress]);

  // Load paired devices on mount
  useEffect(() => {
    void loadPairedDevices();
  }, [loadPairedDevices]);

  const scanDevices = useCallback(async () => {
    setError(null);
    setIsScanning(true);
    setStatus('scanning');
    setScannedDevices([]);

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }

    try {
      await StarPrinterNative.requestBluetoothPermissions();
      await StarPrinterNative.startScan();
      // Results arrive asynchronously via 'bluetoothDeviceFound' event.
      // Fallback: also load already-paired devices immediately.
      await loadPairedDevices();

      scanTimeoutRef.current = setTimeout(() => {
        setIsScanning(false);
        setStatus((prev) => prev === 'scanning' ? 'idle' : prev);
        scanTimeoutRef.current = null;
      }, 6000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bluetooth scan failed';
      setError(message);
      setStatus('error');
      setIsScanning(false);
    }
  }, [loadPairedDevices]);

  const pairDevice = useCallback(async (address: string) => {
    setError(null);
    setStatus('pairing');

    try {
      const result = await StarPrinterNative.pairDevice({ address });
      if (result.status === 'unsupported') {
        setError('Pairing not supported on this platform.');
        setStatus('error');
        return;
      }
      logger.info(`[StarPrinter] pairDevice result: ${result.status}`);
      await loadPairedDevices();
      setStatus('idle');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pairing failed';
      setError(message);
      setStatus('error');
    }
  }, [loadPairedDevices]);

  const unpairDevice = useCallback(async (address: string) => {
    setError(null);

    try {
      await StarPrinterNative.unpairDevice({ address });

      setPairedDevices((existing) => existing.filter((d) => d.address !== address));
      setScannedDevices((existing) => existing.map((d) =>
        d.address === address ? { ...d, bonded: false } : d,
      ));

      if (connectedDevice?.address === address) {
        setConnectedDevice(null);
      }

      const updatedCustomer = { ...printer.customer };
      if (updatedCustomer.defaultPrinterAddress === address) {
        updatedCustomer.defaultPrinterName = '';
        updatedCustomer.defaultPrinterAddress = '';
        updatedCustomer.connectionType = 'none';
      }

      const updatedKitchen = { ...printer.kitchen };
      if (updatedKitchen.defaultPrinterAddress === address) {
        updatedKitchen.defaultPrinterName = '';
        updatedKitchen.defaultPrinterAddress = '';
        updatedKitchen.connectionType = 'none';
      }

      const legacyUpdates = printer.defaultPrinterAddress === address ? {
        defaultPrinterName: '',
        defaultPrinterAddress: '',
        connectionType: 'none' as const,
      } : {};

      setPrinter({
        ...legacyUpdates,
        customer: updatedCustomer,
        kitchen: updatedKitchen,
      });

      logger.info(`[StarPrinter] unpaired ${address}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unpair failed';
      setError(message);
    }
  }, [connectedDevice, printer, setPrinter]);

  const setDefaultPrinter = useCallback((device: StarPrinterDevice, role: 'customer' | 'kitchen') => {
    const roleKey = role;
    setPrinter({
      ...(role === 'customer' ? {
        defaultPrinterName: device.name,
        defaultPrinterAddress: device.address,
        connectionType: 'bluetooth',
      } : {}),
      [roleKey]: {
        connectionType: 'bluetooth',
        defaultPrinterName: device.name,
        defaultPrinterAddress: device.address,
        lanPrinterIp: printer[role]?.lanPrinterIp ?? '',
        lanPrinterModel: printer[role]?.lanPrinterModel ?? 'TSP143',
      },
      lastConnectedAt: new Date().toISOString(),
    } as any);

    setConnectedDevice({ ...device, isDefault: true });

    setPairedDevices((existing) => existing.map((d) => ({ ...d, isDefault: d.address === device.address })));
    setScannedDevices((existing) => existing.map((d) => ({ ...d, isDefault: d.address === device.address })));

    // Persist to localStorage for legacy compatibility
    try {
      localStorage.setItem(`${role}_printer`, JSON.stringify({ name: device.name, address: device.address }));
      if (role === 'customer') {
        localStorage.setItem('printer', JSON.stringify({ name: device.name, address: device.address }));
      }
    } catch { /* best effort */ }

    logger.info(`[StarPrinter] default ${role} printer set: ${device.name} (${device.address})`);
  }, [printer, setPrinter]);

  const testPrint = useCallback(async (device: StarPrinterDevice) => {
    if (!device.address) {
      setError('No printer address — select a printer first.');
      return;
    }

    setStatus('printing');
    setError(null);

    try {
      // The native echo() method expects Base64 PNG (not JSON).
      // Render a test page to an image using Canvas, then send the base64 bytes.
      const base64Image = renderReceiptToBase64([
        { text: '=== TEST PRINT ===',                 align: 'center', size: 28, bold: true },
        { text: '--------------------------------',    align: 'center', size: 20 },
        { text: `Printer: ${device.name}`,            align: 'left',   size: 22 },
        { text: `Address: ${device.address}`,         align: 'left',   size: 18 },
        { text: new Date().toLocaleString(),           align: 'left',   size: 20 },
        { text: '--------------------------------',    align: 'center', size: 20 },
        { text: 'Printer Connected ✓',                align: 'center', size: 22, bold: true },
        { text: '',                                    size: 20 },
        { text: '',                                    size: 20 },
        { text: '',                                    size: 20 },
      ]);

      await StarPrinterNative.echo({
        printerName:    device.name,
        printerAddress: device.address,
        constructedObj: base64Image,
      });
      setStatus('connected');
      logger.info(`[StarPrinter] test print sent to ${device.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Test print failed';
      setError(message);
      setStatus('error');
    }
  }, []);

  const testPrintLan = useCallback(async (ip: string, model: string) => {
    if (!ip.trim()) {
      setError('Enter a printer IP address.');
      return;
    }

    setStatus('printing');
    setError(null);

    try {
      await StarPrinterNative.printText({
        ip,
        textdata: 'TEST PRINT\n' + new Date().toLocaleString() + '\n\n',
        data: '',
        model: model || 'TSP143',
        count: 1,
      });
      setStatus('idle');
      logger.info(`[StarPrinter] LAN test print sent to ${ip} using model ${model}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'LAN test print failed';
      setError(message);
      setStatus('error');
    }
  }, []);

  return {
    status,
    error,
    scannedDevices,
    pairedDevices,
    connectedDevice,
    bluetoothEnabled,
    isScanning,
    scanDevices,
    loadPairedDevices,
    pairDevice,
    unpairDevice,
    setDefaultPrinter,
    testPrint,
    testPrintLan,
    clearError,
  };
}
