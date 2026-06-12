// src/hooks/useReaderConnection.ts
// Stripe Terminal reader lifecycle manager for Bluetooth reader setup.

import { useCallback, useEffect, useRef, useState } from 'react';
// Removed StripeTerminalNative import to use unified StarPrinter plugin instead
import { usePaymentStore } from '@/store/paymentStore';
import { useSettingsStore } from '@/store/settingsStore';
import {
  initializeAdapter,
  adapterDiscoverReaders,
  adapterConnectBluetoothReader,
  adapterConnectInternetReader,
  adapterConnectLocalMobileReader,
  adapterDisconnect,
  adapterGetConnectedReader,
} from '@/services/stripe/terminal.adapter';
import {
  StripeTerminalError,
  TERMINAL_ERROR_MESSAGES,
  type TerminalErrorCode,
  type TerminalReader,
} from '@/services/stripe/types';
import { logger } from '@/utils/logger';

export type ReaderConnectionStatus =
  | 'idle'
  | 'initializing'
  | 'discovering'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnecting'
  | 'disconnected'
  | 'timeout'
  | 'error';

export interface ReaderConnectionError {
  code: TerminalErrorCode;
  message: string;
}

export interface UseReaderConnectionReturn {
  status: ReaderConnectionStatus;
  connectedReader: TerminalReader | null;
  discoveredReaders: TerminalReader[];
  error: string;
  connectionError: ReaderConnectionError | null;
  sessionSecondsLeft: number | null;
  reconnectAttempts: number;
  isRefreshing: boolean;
  initialize: () => Promise<void>;
  discover: () => Promise<TerminalReader[]>;
  connect: (serialNumber?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  resetSessionTimer: () => void;
  clearError: () => void;
}

const MAX_RECONNECT = 3;
const RECONNECT_BASE_MS = 2_000;
const CONNECTING_STATUSES: ReaderConnectionStatus[] = ['connecting', 'reconnecting'];

function toConnectionError(err: unknown): ReaderConnectionError {
  if (err instanceof StripeTerminalError) {
    return { code: err.code, message: err.message || TERMINAL_ERROR_MESSAGES[err.code] };
  }

  const raw = err instanceof Error ? err.message : String(err);
  return { code: 'UNKNOWN', message: raw || TERMINAL_ERROR_MESSAGES.UNKNOWN };
}

function mergeReaders(current: TerminalReader[], incoming: TerminalReader[]): TerminalReader[] {
  const bySerial = new Map<string, TerminalReader>();
  for (const reader of current) bySerial.set(reader.serialNumber, reader);
  for (const reader of incoming) bySerial.set(reader.serialNumber, reader);
  return Array.from(bySerial.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export function useReaderConnection(): UseReaderConnectionReturn {
  const payment = useSettingsStore((s) => s.payment);
  const setPayment = useSettingsStore((s) => s.setPayment);
  const setStoreReader = usePaymentStore((s) => s.setConnectedReader);
  const storeReader = usePaymentStore((s) => s.connectedReader);

  const [status, setStatus] = useState<ReaderConnectionStatus>('idle');
  const [discoveredReaders, setDiscoveredReaders] = useState<TerminalReader[]>([]);
  const [connectionError, setConnectionError] = useState<ReaderConnectionError | null>(null);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef(0);
  const statusRef = useRef<ReaderConnectionStatus>('idle');
  const reconnectRef = useRef(0);
  const manualDisconnectRef = useRef(false);
  const initializedRef = useRef(false);
  const discoveryLockRef = useRef(false);
  const connectLockRef = useRef(false);

  const error = connectionError?.message ?? '';

  useEffect(() => { statusRef.current = status; }, [status]);

  const clearError = useCallback(() => setConnectionError(null), []);

  // On mount: restore connected reader status from the SDK without full re-initialization.
  // Matches kiosk_straunt_storefront behavior where the reader stays connected across navigations.
  useEffect(() => {
    async function restoreOnMount() {
      try {
        const ok = await initializeAdapter();
        if (!ok) return;
        initializedRef.current = true;
        const currentReader = await adapterGetConnectedReader();
        if (currentReader) {
          setStoreReader(currentReader);
          setStatus('connected');
        }
      } catch {
        // Best-effort restore — failures are non-fatal here
      }
    }
    void restoreOnMount();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  const stopTimer = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    sessionStartRef.current = 0;
    setSessionSecondsLeft(null);
  }, []);

  const startTimer = useCallback((minutes: number) => {
    stopTimer();
    if (minutes <= 0) return;

    const totalSeconds = minutes * 60;
    sessionStartRef.current = Date.now();
    setSessionSecondsLeft(totalSeconds);

    tickRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const remaining = Math.max(0, totalSeconds - elapsed);
      setSessionSecondsLeft(remaining);

      if (remaining <= 0) {
        stopTimer();
        manualDisconnectRef.current = true;
        logger.info('[readerConnection] session timeout, disconnecting reader');
        void adapterDisconnect().finally(() => {
          setStoreReader(null);
          setStatus('timeout');
        });
      }
    }, 1_000);
  }, [setStoreReader, stopTimer]);

  const resetSessionTimer = useCallback(() => {
    if (tickRef.current && sessionStartRef.current) {
      sessionStartRef.current = Date.now();
    }
  }, []);

  const initialize = useCallback(async () => {
    // initializedRef tracks whether THIS hook instance has confirmed the adapter is running.
    // Always re-verify on the first call of a new component mount (initializedRef starts false).
    if (initializedRef.current) return;

    setStatus('initializing');
    setConnectionError(null);

    try {
      const ok = await initializeAdapter();
      if (!ok) {
        setStatus('error');
        setConnectionError({
          code: 'TERMINAL_NOT_INITIALIZED',
          message: TERMINAL_ERROR_MESSAGES.TERMINAL_NOT_INITIALIZED,
        });
        return;
      }

      initializedRef.current = true;
      const currentReader = await adapterGetConnectedReader();
      if (currentReader) {
        setStoreReader(currentReader);
        setStatus('connected');
        startTimer(payment.sessionTimeoutMinutes);
      } else {
        setStatus('idle');
      }
      logger.info('[readerConnection] Terminal SDK initialized');
    } catch (err) {
      const ce = toConnectionError(err);
      setStatus('error');
      setConnectionError(ce);
      logger.error('[readerConnection] init error:', err);
    }
  // payment.readerSerialNumber intentionally excluded — initialize() doesn't use it
  // and including it causes the callback to be re-created on every serial keystroke.
  }, [payment.sessionTimeoutMinutes, setStoreReader, startTimer]);

  const discover = useCallback(async (): Promise<TerminalReader[]> => {
    if (discoveryLockRef.current || CONNECTING_STATUSES.includes(statusRef.current)) {
      logger.warn('[readerConnection] discovery skipped while busy');
      return [];
    }

    discoveryLockRef.current = true;
    setStatus('discovering');
    setConnectionError(null);
    setDiscoveredReaders([]);

    try {
      await initialize();
      const method = payment.connectionMethod || 'bluetooth';
      const found = await adapterDiscoverReaders(payment.terminalLocationId, method);
      setDiscoveredReaders((existing) => mergeReaders(existing, found));
      setStatus('idle');

      if (found.length === 0) {
        setConnectionError({
          code: 'READER_NOT_FOUND',
          message: method === 'bluetooth'
            ? 'No Bluetooth readers found. Make sure the reader is powered on, nearby, and in pairing mode.'
            : 'No readers found for the selected connection method.',
        });
      }
      return found;
    } catch (err) {
      const ce = toConnectionError(err);
      setStatus('error');
      setConnectionError(ce);
      logger.error('[readerConnection] discovery error:', err);
      return [];
    } finally {
      discoveryLockRef.current = false;
    }
  }, [initialize, payment.connectionMethod, payment.terminalLocationId]);

  const connect = useCallback(async (serialNumber?: string) => {
    if (connectLockRef.current || CONNECTING_STATUSES.includes(statusRef.current)) {
      logger.warn('[readerConnection] connect skipped while another connection is active');
      return;
    }

    const method = payment.connectionMethod || 'bluetooth';
    const sn = serialNumber ?? payment.readerSerialNumber;

    if (method !== 'localMobile' && !sn.trim()) {
      setStatus('error');
      setConnectionError({
        code: 'READER_NOT_FOUND',
        message: 'Select a reader from discovery or enter a reader serial number.',
      });
      return;
    }

    if (method !== 'internet' && !payment.terminalLocationId.trim()) {
      setStatus('error');
      setConnectionError({
        code: 'READER_NOT_FOUND',
        message: 'Enter the Stripe Terminal location ID before connecting.',
      });
      return;
    }

    connectLockRef.current = true;
    manualDisconnectRef.current = false;
    setStatus('connecting');
    setConnectionError(null);

    try {
      await initialize();

      const currentReader = await adapterGetConnectedReader();
      if (currentReader && currentReader.serialNumber !== sn && method !== 'localMobile') {
        await adapterDisconnect();
        setStoreReader(null);
      } else if (currentReader) {
        setStoreReader(currentReader);
        setStatus('connected');
        setPayment({
          readerSerialNumber: currentReader.serialNumber,
          connectionMethod: method,
          lastConnectedAt: new Date().toISOString(),
        });
        startTimer(payment.sessionTimeoutMinutes);
        return;
      }

      let reader: TerminalReader;
      if (method === 'bluetooth') {
        // The Android plugin's connectBluetoothReader() handles the full POS pattern:
        // if the reader is already in its discovery cache → connect immediately;
        // otherwise it runs its own BLE discovery (up to 15 s) and auto-connects when found.
        // No pre-discovery needed here — one layer keeps the total wait to ≤ 15 s.
        reader = await adapterConnectBluetoothReader(sn, payment.terminalLocationId);
      } else if (method === 'internet') {
        reader = await adapterConnectInternetReader(sn);
      } else {
        reader = await adapterConnectLocalMobileReader(payment.terminalLocationId);
      }

      setStoreReader(reader);
      setStatus('connected');
      reconnectRef.current = 0;
      setReconnectAttempts(0);
      startTimer(payment.sessionTimeoutMinutes);
      setPayment({
        readerSerialNumber: method === 'localMobile' ? '' : reader.serialNumber,
        connectionMethod: method,
        lastConnectedAt: new Date().toISOString(),
      });
      logger.info(`[readerConnection] connected: ${reader.serialNumber}`);
    } catch (err) {
      const ce = toConnectionError(err);
      setStatus('error');
      setConnectionError(ce);
      logger.error('[readerConnection] connect failed:', err);
    } finally {
      connectLockRef.current = false;
    }
  }, [
    initialize,
    payment.connectionMethod,
    payment.readerSerialNumber,
    payment.sessionTimeoutMinutes,
    payment.terminalLocationId,
    setPayment,
    setStoreReader,
    startTimer,
  ]);

  const disconnect = useCallback(async () => {
    if (statusRef.current === 'disconnecting') return;
    manualDisconnectRef.current = true;
    setStatus('disconnecting');
    setConnectionError(null);
    stopTimer();

    try {
      await adapterDisconnect();
    } catch (err) {
      logger.warn('[readerConnection] disconnect failed:', err);
    } finally {
      setStoreReader(null);
      setStatus('disconnected');
      logger.info('[readerConnection] disconnected');
    }
  }, [setStoreReader, stopTimer]);

  const reconnect = useCallback(async () => {
    if (connectLockRef.current) return;

    if (reconnectRef.current >= MAX_RECONNECT) {
      setStatus('error');
      setConnectionError({
        code: 'TIMEOUT',
        message: `Could not reconnect after ${MAX_RECONNECT} attempts. Check the reader and try again.`,
      });
      return;
    }

    reconnectRef.current += 1;
    setReconnectAttempts(reconnectRef.current);
    setStatus('reconnecting');
    setConnectionError(null);

    const backoffMs = RECONNECT_BASE_MS * reconnectRef.current;
    logger.info(`[readerConnection] reconnect attempt ${reconnectRef.current} in ${backoffMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    await connect(payment.readerSerialNumber || undefined);
  }, [connect, payment.readerSerialNumber]);

  const refresh = useCallback(async () => {
    if (isRefreshing || statusRef.current !== 'connected') return;
    setIsRefreshing(true);

    try {
      const reader = await adapterGetConnectedReader();
      if (reader) {
        setStoreReader(reader);
        setPayment({ lastConnectedAt: new Date().toISOString() });
      } else {
        setStoreReader(null);
        setStatus('disconnected');
      }
    } catch (err) {
      logger.warn('[readerConnection] refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, setPayment, setStoreReader]);

  // Stable refs for callbacks used inside the subscription effect.
  // By reading from refs at event-fire time we avoid listing these as deps,
  // which would cause the listener to be removed/re-added on every settings change.
  const reconnectCbRef = useRef(reconnect);
  useEffect(() => { reconnectCbRef.current = reconnect; }, [reconnect]);

  const stopTimerRef = useRef(stopTimer);
  useEffect(() => { stopTimerRef.current = stopTimer; }, [stopTimer]);

  useEffect(() => {
    // StarPrinterReceipt handles reader status checks via polling/getM2ReaderInfo.
    // Native disconnect/status events are handled by the plugin layer natively.
  }, []);

  useEffect(() => () => stopTimer(), [stopTimer]);

  return {
    status,
    connectedReader: storeReader,
    discoveredReaders,
    error,
    connectionError,
    sessionSecondsLeft,
    reconnectAttempts,
    isRefreshing,
    initialize,
    discover,
    connect,
    disconnect,
    reconnect,
    refresh,
    resetSessionTimer,
    clearError,
  };
}
