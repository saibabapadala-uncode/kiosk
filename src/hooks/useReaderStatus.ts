// src/hooks/useReaderStatus.ts
// Monitors Stripe Terminal reader connection health.
// Subscribes to plugin disconnect events and polls every POLL_MS when active.
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePaymentStore } from '@/store/paymentStore';
import { useSettingsStore } from '@/store/settingsStore';
import { adapterDiscoverReaders } from '@/services/stripe/terminal.adapter';
import { StripeTerminalNative } from '@/plugins/stripe-terminal';
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
  const locationId = useSettingsStore((s) => s.payment.terminalLocationId);

  const [health, setHealth] = useState<ReaderHealth>('unknown');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkHealth = useCallback(async () => {
    if (!connectedReader || isWebFallback) return;
    if (!locationId) return;
    // Don't poll during active payment — avoid interfering with the flow
    if (flowState === 'collecting' || flowState === 'processing') return;

    try {
      const readers = await adapterDiscoverReaders(locationId);
      const found = readers.find((r) => r.serialNumber === connectedReader.serialNumber);
      const next: ReaderHealth = found?.status === 'online' ? 'connected' : 'disconnected';
      setHealth(next);
      setLastChecked(new Date());
      if (next === 'disconnected') {
        logger.warn(`[readerStatus] reader ${connectedReader.serialNumber} appears offline`);
      }
    } catch {
      // Discovery network error — don't flip to disconnected, keep last known
    }
  }, [connectedReader, isWebFallback, locationId, flowState]);

  // Initial state from connectedReader store
  useEffect(() => {
    if (isWebFallback) { setHealth('connected'); return; }
    if (!connectedReader) { setHealth('disconnected'); return; }
    setHealth('connected');
  }, [connectedReader, isWebFallback]);

  // Subscribe to terminal disconnect events from the plugin
  useEffect(() => {
    if (!connectedReader || isWebFallback) return;
    let listener: { remove(): Promise<void> } | null = null;

    async function subscribe() {
      try {
        listener = await StripeTerminalNative.addListener(
          'readerConnectionStatusChange',
          ({ status }) => {
            if (status === 'not_connected') {
              setHealth('disconnected');
              logger.warn('[readerStatus] plugin reported reader disconnected');
            } else if (status === 'connecting') {
              setHealth('reconnecting');
            } else if (status === 'connected') {
              setHealth('connected');
            }
          },
        );
      } catch { /* plugin not available */ }
    }

    void subscribe();
    return () => { void listener?.remove(); };
  }, [connectedReader, isWebFallback]);

  // Periodic health poll
  useEffect(() => {
    if (!connectedReader || isWebFallback) return;
    pollerRef.current = setInterval(() => void checkHealth(), POLL_MS);
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, [connectedReader, isWebFallback, checkHealth]);

  return { health, lastChecked };
}
