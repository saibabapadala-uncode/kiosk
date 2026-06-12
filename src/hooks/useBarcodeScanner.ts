// src/hooks/useBarcodeScanner.ts
// Two modes:
//   hid  — keyboard-wedge HID scanner (all platforms, keyboard events)
//   camera — native camera via BarcodeScanner plugin
import { useCallback, useEffect, useRef } from 'react';
import { BarcodeScanner } from '@/plugins/barcode-scanner';
import type { ScanResult, CameraScanOptions } from '@/plugins/barcode-scanner';
import { useSettingsStore } from '@/store/settingsStore';
import { logger } from '@/utils/logger';

// ─── HID scanner (keyboard-wedge) ─────────────────────────────────────────────

export interface BarcodeScannerOptions {
  onScan: (result: ScanResult) => void;
  minLength?: number;
  maxCharIntervalMs?: number;
}

export function useBarcodeScanner({
  onScan,
  minLength = 3,
  maxCharIntervalMs = 50,
}: BarcodeScannerOptions): void {
  const enabled = useSettingsStore((s) => s.kiosk.barcodeScannerEnabled);
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const flush = useCallback(() => {
    const code = bufferRef.current.trim();
    bufferRef.current = '';
    if (code.length >= minLength) {
      logger.debug(`[scanner/hid] ${code}`);
      onScan({ rawValue: code, format: 'UNKNOWN', source: 'hid', timestamp: Date.now() });
    }
  }, [minLength, onScan]);

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minLength) { clearTimeout(flushTimerRef.current); flush(); }
        return;
      }
      if (e.key.length !== 1) return;

      const now = Date.now();
      if (Date.now() - lastKeyTimeRef.current > maxCharIntervalMs && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }
      lastKeyTimeRef.current = now;
      bufferRef.current += e.key;
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(flush, 200);
    }

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      clearTimeout(flushTimerRef.current);
    };
  }, [enabled, flush, maxCharIntervalMs, minLength]);
}

// ─── Camera scanner hook ───────────────────────────────────────────────────────

export interface UseCameraScannerReturn {
  startScan: (options?: CameraScanOptions) => Promise<void>;
  stopScan: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
}

export function useCameraScanner(onScan: (result: ScanResult) => void): UseCameraScannerReturn {
  const listenerRef = useRef<{ remove(): Promise<void> } | null>(null);

  useEffect(() => {
    let isCleanedUp = false;
    BarcodeScanner.addListener('scan', onScan)
      .then((l) => {
        if (isCleanedUp) {
          void l.remove();
        } else {
          listenerRef.current = l;
        }
      })
      .catch(logger.error);

    return () => {
      isCleanedUp = true;
      if (listenerRef.current) {
        void listenerRef.current.remove();
        listenerRef.current = null;
      }
    };
  }, [onScan]);

  const startScan = useCallback(async (options?: CameraScanOptions) => {
    const { granted } = await BarcodeScanner.hasCameraPermission();
    if (!granted) {
      const { granted: g2 } = await BarcodeScanner.requestCameraPermission();
      if (!g2) throw new Error('Camera permission denied');
    }
    await BarcodeScanner.startCameraScan(options);
    logger.info('[scanner/camera] started');
  }, []);

  const stopScan = useCallback(async () => {
    await BarcodeScanner.stopCameraScan();
    logger.info('[scanner/camera] stopped');
  }, []);

  const requestPermission = useCallback(async () => {
    const { granted } = await BarcodeScanner.requestCameraPermission();
    return granted;
  }, []);

  return { startScan, stopScan, requestPermission };
}
