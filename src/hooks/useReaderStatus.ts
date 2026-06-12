// src/hooks/useReaderStatus.ts
// Monitors Stripe Terminal reader connection health.
// Health is derived from the payment store (maintained by useReaderConnection).
// Polls every POLL_MS as a secondary safety check.
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePaymentStore } from '@/store/paymentStore';
import { adapterGetConnectedReader } from '@/services/stripe/terminal.adapter';
import { logger } from '@/utils/logger';

export type ReaderHealth = 'connected' | 'disconnected' | 'reconnecting' | 'unknown';

const POLL_MS = 45_000; // 45-second health check interval

interface UseReaderStatusReturn {
  health: ReaderHealth;
  lastChecked: Date | null;
}

export function useReaderStatus(): UseReaderStatusReturn {
  const connectedReader = usePaymentStore((s) => s.connectedReader);
  const isWebFallback = usePaymentStore((s) => s.isWebFallback);
  const flowState = usePaymentStore((s) => s.flowState);
  // Stable key: only re-subscribe the native listener when the physical reader changes,
  // not on every battery/status micro-update (which would fire a new addListener each time).
  const connectedSerial = connectedReader?.serialNumber ?? null;

  const [health, setHealth] = useState<ReaderHealth>('unknown');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use getConnectedReader instead of full discovery — discovery takes 15 s over BLE and
  // would disrupt the terminal while payments are running. getConnectedReader is a cheap
  // SDK call that returns the current connection state without any scanning.
  const checkHealth = useCallback(async () => {
    if (!connectedReader || isWebFallback) return;
    if (flowState === 'collecting' || flowState === 'processing') return;

    try {
      const reader = await adapterGetConnectedReader();
      const next: ReaderHealth = reader ? 'connected' : 'disconnected';
      setHealth(next);
      setLastChecked(new Date());
      if (next === 'disconnected') {
        logger.warn(`[readerStatus] reader ${connectedReader.serialNumber} appears offline`);
      }
    } catch {
      // Keep last known health on transient errors
    }
  }, [connectedReader, isWebFallback, flowState]);

  // Initial state from connectedReader store
  useEffect(() => {
    if (isWebFallback) { setHealth('connected'); return; }
    if (!connectedSerial) { setHealth('disconnected'); return; }
    setHealth('connected');
  }, [connectedSerial, isWebFallback]);

  // useReaderConnection (via AppBootstrap) already subscribes to readerConnectionStatusChange
  // and updates connectedReader in the store.  Registering a second listener here would
  // produce duplicate add/remove cycles visible in Android logs and is unnecessary.

  // Periodic health poll
  useEffect(() => {
    if (!connectedSerial || isWebFallback) return;
    pollerRef.current = setInterval(() => void checkHealth(), POLL_MS);
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, [connectedSerial, isWebFallback, checkHealth]);

  return { health, lastChecked };
}
