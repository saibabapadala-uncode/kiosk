// src/hooks/useAndroidBack.ts
// Handles the Android hardware back button.
// Routes that are "dead ends" (attract, payment) have special logic;
// all others delegate to the browser history stack.
import { useEffect, useRef } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { logger } from '@/utils/logger';

// On these routes back exits to attract (no further history navigation)
const ATTRACT_BACK_ROUTES = ['/attract', '/menu'];
// On these routes the back button is fully suppressed (do not navigate away)
const SUPPRESSED_BACK_ROUTES = ['/payment'];

export function useAndroidBack(): void {
  const history = useHistory();
  const { pathname } = useLocation();

  // Keep a ref to the current pathname so the handler always reads the latest route
  // without re-registering the listener on every navigation change.
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    let isCleanedUp = false;
    let listener: { remove(): Promise<void> } | null = null;

    async function setup() {
      try {
        const { App } = await import('@capacitor/app');

        const handle = await App.addListener('backButton', ({ canGoBack }) => {
          const currentPath = pathnameRef.current;
          logger.debug(`[androidBack] back pressed — route=${currentPath} canGoBack=${canGoBack}`);

          if (SUPPRESSED_BACK_ROUTES.some((r) => currentPath.startsWith(r))) {
            // Payment in progress — ignore back
            return;
          }

          if (ATTRACT_BACK_ROUTES.includes(currentPath)) {
            // Already at a root screen — exit the app
            void App.exitApp();
            return;
          }

          if (canGoBack) {
            history.goBack();
          } else {
            history.replace('/attract');
          }
        });

        if (isCleanedUp) {
          void handle.remove();
        } else {
          listener = handle;
        }
      } catch {
        // Web — browser handles back natively; no-op
      }
    }

    void setup();
    return () => {
      isCleanedUp = true;
      if (listener) void listener.remove();
    };
  // Register once — pathnameRef.current is always current without being a dep.
  // history is stable from useHistory() so this registers exactly once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);
}
