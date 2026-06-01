// src/hooks/useIdle.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useCartStore } from '@/store/cartStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSessionStore } from '@/store/sessionStore';

const ACTIVITY_EVENTS = [
  'touchstart',
  'touchmove',
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'wheel',
] as const;

const WARNING_LEAD_SECONDS = 10;

export interface UseIdleReturn {
  isWarning: boolean;
  secondsRemaining: number;
  /** Call from IdleWarning "I'm Still Here" button or any tap to reset timer. */
  dismiss: () => void;
}

/**
 * @param enabled - when false the timers are cleared and the hook is dormant.
 *                  Use this to pause idle detection during payment or settings.
 */
export function useIdle(enabled: boolean = true): UseIdleReturn {
  const history = useHistory();
  const clearCart = useCartStore((s) => s.clearCart);
  const resetSession = useSessionStore((s) => s.resetSession);
  const idleTimeoutSeconds = useSettingsStore((s) => s.kiosk.idleTimeoutSeconds);

  const [isWarning, setIsWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(WARNING_LEAD_SECONDS);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef(WARNING_LEAD_SECONDS);

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const expire = useCallback(() => {
    clearTimers();
    clearCart();
    resetSession();
    history.replace('/attract');
  }, [clearTimers, clearCart, resetSession, history]);

  const startCountdown = useCallback(() => {
    setIsWarning(true);
    countRef.current = WARNING_LEAD_SECONDS;
    setSecondsRemaining(WARNING_LEAD_SECONDS);

    countdownRef.current = setInterval(() => {
      countRef.current -= 1;
      setSecondsRemaining(countRef.current);
      if (countRef.current <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        expire();
      }
    }, 1_000);
  }, [expire]);

  const reset = useCallback(() => {
    clearTimers();
    setIsWarning(false);
    setSecondsRemaining(WARNING_LEAD_SECONDS);
    countRef.current = WARNING_LEAD_SECONDS;

    if (!enabled) return;

    const warningDelay = Math.max(0, idleTimeoutSeconds - WARNING_LEAD_SECONDS) * 1_000;
    idleTimerRef.current = setTimeout(startCountdown, warningDelay);
  }, [enabled, idleTimeoutSeconds, clearTimers, startCountdown]);

  // Restart / stop timers whenever enabled or timeout changes
  useEffect(() => {
    if (!enabled) {
      clearTimers();
      setIsWarning(false);
      return;
    }
    reset();
    return clearTimers;
  }, [enabled, reset, clearTimers]);

  // Bind activity listeners
  useEffect(() => {
    const handler = () => { if (enabled) reset(); };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handler));
  }, [enabled, reset]);

  return { isWarning, secondsRemaining, dismiss: reset };
}
