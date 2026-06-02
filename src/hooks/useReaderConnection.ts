// src/hooks/useReaderConnection.ts
// Complete Stripe Reader M2 (Bluetooth) connection lifecycle manager.
//
// Phases:
//   idle → initializing → discovering → connecting → connected
//                                                   ↓ (on payment activity: reset timer)
//                                           session timeout → disconnected
//                                                   ↓ (unexpected disconnect + autoReconnect)
//                                           reconnecting → connected | error
//
// Session timeout: configurable idle timer. Any call to resetSessionTimer()
// pushes the deadline forward. When it fires the reader is disconnected cleanly.
//
// Auto-reconnect: on unexpected disconnect, backs off exponentially (2s, 4s, 6s)
// up to MAX_RECONNECT_ATTEMPTS. Disabled when the reader is disconnected manually.

import { useState, useEffect, useCallback, useRef } from 'react';
import { StripeTerminalNative }           from '@/plugins/stripe-terminal';
import { usePaymentStore }                from '@/store/paymentStore';
import { useSettingsStore }               from '@/store/settingsStore';
import {
  initializeAdapter,
  adapterDiscoverReaders,
  adapterConnectBluetoothReader,
  adapterConnectReader,
  adapterDisconnect,
}                                         from '@/services/stripe/terminal.adapter';
import type { TerminalReader }            from '@/services/stripe/types';
import { USE_STATIC_PAYMENT_FLOW, STATIC_READERS } from '@/services/stripe/static.mock';
import { logger }                         from '@/utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface UseReaderConnectionReturn {
  status:           ReaderConnectionStatus;
  connectedReader:  TerminalReader | null;
  discoveredReaders: TerminalReader[];
  error:            string;
  /** Seconds remaining before session timeout (null = no timeout configured) */
  sessionSecondsLeft: number | null;
  /** How many auto-reconnect attempts have been made */
  reconnectAttempts: number;

  initialize:       () => Promise<void>;
  discover:         () => Promise<void>;
  connect:          (serialNumber?: string) => Promise<void>;
  disconnect:       () => Promise<void>;
  reconnect:        () => Promise<void>;
  /** Call whenever payment activity happens — resets the session idle timer */
  resetSessionTimer: () => void;
}

const MAX_RECONNECT = 3;
const RECONNECT_BASE_MS = 2_000;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useReaderConnection(): UseReaderConnectionReturn {
  const payment          = useSettingsStore((s) => s.payment);
  const setStoreReader   = usePaymentStore((s) => s.setConnectedReader);
  const storeReader      = usePaymentStore((s) => s.connectedReader);

  const [status,             setStatus]            = useState<ReaderConnectionStatus>('idle');
  const [discoveredReaders,  setDiscoveredReaders] = useState<TerminalReader[]>([]);
  const [error,              setError]             = useState('');
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number | null>(null);
  const [reconnectAttempts,  setReconnectAttempts] = useState(0);

  const tickRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef  = useRef<number>(0);
  const reconnectRef     = useRef(0);
  const manualDisconnect = useRef(false);

  // ── Session timeout timer ──────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setSessionSecondsLeft(null);
    sessionStartRef.current = 0;
  }, []);

  const startTimer = useCallback((minutes: number) => {
    stopTimer();
    if (minutes <= 0) return;
    const totalSec = minutes * 60;
    sessionStartRef.current = Date.now();

    tickRef.current = setInterval(() => {
      const elapsed  = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const remaining = totalSec - elapsed;
      if (remaining <= 0) {
        stopTimer();
        setSessionSecondsLeft(0);
        logger.info('[readerConnection] session timeout — disconnecting');
        void adapterDisconnect().finally(() => {
          setStoreReader(null);
          setStatus('timeout');
        });
      } else {
        setSessionSecondsLeft(remaining);
      }
    }, 1_000);
  }, [stopTimer, setStoreReader]);

  const resetSessionTimer = useCallback(() => {
    if (tickRef.current && sessionStartRef.current) {
      sessionStartRef.current = Date.now();
    }
  }, []);

  // ── Initialize Terminal SDK ────────────────────────────────────────────────

  const initialize = useCallback(async () => {
    if (USE_STATIC_PAYMENT_FLOW) {
      // Simulate the M2 reader in demo mode
      const demo: TerminalReader = {
        serialNumber: payment.readerSerialNumber || 'STRM26146036943',
        label:        'Stripe Reader M2 (Demo)',
        deviceType:   'stripeM2',
        status:       'online',
        simulated:    true,
        batteryLevel: 0.9,
      };
      setStoreReader(demo);
      setStatus('connected');
      startTimer(payment.sessionTimeoutMinutes);
      return;
    }

    setStatus('initializing');
    setError('');
    const ok = await initializeAdapter();
    if (!ok) {
      setStatus('error');
      setError('Failed to initialize Stripe Terminal. Ensure the native plugin is installed.');
      return;
    }
    setStatus('idle');
    logger.info('[readerConnection] Terminal SDK initialized');
  }, [payment.readerSerialNumber, payment.sessionTimeoutMinutes, setStoreReader, startTimer]);

  // ── Discover readers ───────────────────────────────────────────────────────

  const discover = useCallback(async () => {
    setStatus('discovering');
    setError('');
    setDiscoveredReaders([]);

    try {
      const method = payment.connectionMethod || 'bluetooth';
      logger.info(`[readerConnection] discovering via ${method}…`);
      const found = await adapterDiscoverReaders(payment.terminalLocationId, method);
      setDiscoveredReaders(found);
      setStatus('idle');
      if (found.length === 0) {
        setError(
          method === 'bluetooth'
            ? 'No Bluetooth readers found. Make sure the M2 reader is powered on, not paired to another device, and within 10 m.'
            : 'No readers found at this location.',
        );
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Discovery failed');
    }
  }, [payment.connectionMethod, payment.terminalLocationId]);

  // ── Connect ────────────────────────────────────────────────────────────────

  const connect = useCallback(async (serialNumber?: string) => {
    const sn = serialNumber ?? payment.readerSerialNumber;
    if (!sn && !USE_STATIC_PAYMENT_FLOW) {
      setError('No serial number. Enter the reader serial number or run Discovery first.');
      setStatus('error');
      return;
    }

    manualDisconnect.current = false;
    setStatus('connecting');
    setError('');

    try {
      const method = payment.connectionMethod || 'bluetooth';
      let reader: TerminalReader;

      if (method === 'bluetooth') {
        reader = await adapterConnectBluetoothReader(sn, payment.terminalLocationId);
      } else if (method === 'internet') {
        await adapterConnectReader(sn);
        reader = {
          serialNumber: sn,
          label:        `Reader (${sn.slice(-6)})`,
          deviceType:   'unknown',
          status:       'online',
          simulated:    false,
        };
      } else {
        // local_mobile / tap-to-pay
        reader = {
          serialNumber: 'LOCAL_MOBILE',
          label:        'Tap to Pay',
          deviceType:   'appleBuiltIn',
          status:       'online',
          simulated:    false,
        };
      }

      setStoreReader(reader);
      setStatus('connected');
      reconnectRef.current = 0;
      setReconnectAttempts(0);
      startTimer(payment.sessionTimeoutMinutes);
      logger.info(`[readerConnection] connected: ${reader.serialNumber}`);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
      logger.error('[readerConnection] connect failed', err);
    }
  }, [
    payment.readerSerialNumber, payment.connectionMethod,
    payment.terminalLocationId, payment.sessionTimeoutMinutes,
    setStoreReader, startTimer,
  ]);

  // ── Disconnect ─────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    manualDisconnect.current = true;
    setStatus('disconnecting');
    stopTimer();

    await adapterDisconnect();
    setStoreReader(null);
    setStatus('disconnected');
    logger.info('[readerConnection] disconnected');
  }, [setStoreReader, stopTimer]);

  // ── Auto-reconnect ─────────────────────────────────────────────────────────

  const reconnect = useCallback(async () => {
    if (reconnectRef.current >= MAX_RECONNECT) {
      setStatus('error');
      setError(`Reconnection failed after ${MAX_RECONNECT} attempts. Please check the reader and reconnect manually.`);
      setReconnectAttempts(reconnectRef.current);
      return;
    }

    reconnectRef.current += 1;
    setReconnectAttempts(reconnectRef.current);
    setStatus('reconnecting');
    setError('');

    const backoffMs = RECONNECT_BASE_MS * reconnectRef.current;
    logger.info(`[readerConnection] reconnect attempt ${reconnectRef.current}, waiting ${backoffMs}ms`);
    await new Promise((r) => setTimeout(r, backoffMs));
    await connect();
  }, [connect]);

  // ── Subscribe to plugin events ─────────────────────────────────────────────

  useEffect(() => {
    if (USE_STATIC_PAYMENT_FLOW) return;
    let removeDisconnect: (() => Promise<void>) | null = null;
    let removeStatus: (() => Promise<void>) | null = null;

    async function subscribe() {
      try {
        const disconnectListener = await StripeTerminalNative.addListener(
          'unexpectedReaderDisconnect',
          ({ reader }) => {
            logger.warn(`[readerConnection] unexpected disconnect: ${reader.serialNumber}`);
            stopTimer();
            setStoreReader(null);

            if (manualDisconnect.current || !payment.autoReconnect) {
              setStatus('disconnected');
            } else {
              void reconnect();
            }
          },
        );
        removeDisconnect = disconnectListener.remove;

        const statusListener = await StripeTerminalNative.addListener(
          'readerConnectionStatusChange',
          ({ status: s }) => {
            if (s === 'connecting') setStatus('connecting');
          },
        );
        removeStatus = statusListener.remove;
      } catch { /* plugin not available in web */ }
    }

    void subscribe();
    return () => {
      void removeDisconnect?.();
      void removeStatus?.();
    };
  }, [payment.autoReconnect, reconnect, setStoreReader, stopTimer]);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => () => stopTimer(), [stopTimer]);

  return {
    status,
    connectedReader: storeReader,
    discoveredReaders,
    error,
    sessionSecondsLeft,
    reconnectAttempts,
    initialize,
    discover,
    connect,
    disconnect,
    reconnect,
    resetSessionTimer,
  };
}
