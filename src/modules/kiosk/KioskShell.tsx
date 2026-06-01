// src/modules/kiosk/KioskShell.tsx
// Global shell: idle timer, network, Android back, app lifecycle,
// offline banner, reader status badge, cart drawer, bottom nav.
//
// Auth routes (/login, /channel-select) bypass all kiosk overlays and idle logic.
import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

import { useIdle } from '@/hooks/useIdle';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useAndroidBack } from '@/hooks/useAndroidBack';
import { useAppLifecycle } from '@/hooks/useAppLifecycle';

import CartDrawer, { CartTriggerButton } from '@/modules/cart/CartDrawer';
import IdleWarning from './IdleWarning';
import OfflineBanner from './OfflineBanner';
import ReaderStatusBadge from './ReaderStatusBadge';
import BottomNav from './BottomNav';

// ── Route classification ───────────────────────────────────────────────────────

/** Auth screens — no idle timer, no cart overlays, no reader status */
const AUTH_PATHS = ['/login', '/channel-select'];

/** Idle timer suspended (in addition to auth paths) */
const IDLE_EXEMPT = ['/payment', '/settings'];

/** Floating cart trigger visible */
const CART_TRIGGER_PATHS = ['/menu', '/cart'];

/** Mobile bottom nav visible */
const BOTTOM_NAV_PATHS = ['/menu', '/cart'];

// ──────────────────────────────────────────────────────────────────────────────

interface KioskShellProps { children: ReactNode }

export default function KioskShell({ children }: KioskShellProps) {
  const { pathname } = useLocation();

  const isAuthScreen    = AUTH_PATHS.some((p) => pathname.startsWith(p));
  const idleEnabled     = !isAuthScreen && !IDLE_EXEMPT.some((p) => pathname.startsWith(p));
  const showCartTrigger = !isAuthScreen && CART_TRIGGER_PATHS.some((p) => pathname === p);
  const showBottomNav   = !isAuthScreen && BOTTOM_NAV_PATHS.some((p) => pathname === p);

  const { isWarning, secondsRemaining, dismiss } = useIdle(idleEnabled);

  // Network, back-button, lifecycle hooks are always active
  useNetworkStatus();
  useAndroidBack();
  useAppLifecycle();

  // kiosk-mode CSS class — disables text selection on physical device
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    if (isNative) document.body.classList.add('kiosk-mode');
    document.documentElement.setAttribute('data-platform', isNative ? 'native' : 'web');
    return () => document.body.classList.remove('kiosk-mode');
  }, []);

  return (
    <>
      {children}

      {/* Auth screens get no overlays */}
      {!isAuthScreen && (
        <>
          <OfflineBanner />
          <ReaderStatusBadge />
          <CartDrawer />
          {showCartTrigger && <CartTriggerButton />}
          <IdleWarning
            isVisible={isWarning && idleEnabled}
            secondsRemaining={secondsRemaining}
            onDismiss={dismiss}
          />
          {showBottomNav && <BottomNav />}
        </>
      )}
    </>
  );
}
