// src/hooks/useAndroidBack.ts
// Handles the Android hardware back button.
// Routes that are "dead ends" (attract, payment) have special logic;
// all others delegate to the browser history stack.
import { useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { logger } from '@/utils/logger';

// On these routes back exits to attract (no further history navigation)
const ATTRACT_BACK_ROUTES = ['/attract', '/menu'];
// On these routes the back button is fully suppressed (do not navigate away)
const SUPPRESSED_BACK_ROUTES = ['/payment'];

export function useAndroidBack(): void {
  const history = useHistory();
  const { pathname } = useLocation();

  useEffect(() => {
    let listener: { remove(): Promise<void> } | null = null;

    async function setup() {
      try {
        const { App } = await import('@capacitor/app');

        listener = await App.addListener('backButton', ({ canGoBack }) => {
          logger.debug(`[androidBack] back pressed — route=${pathname} canGoBack=${canGoBack}`);

          if (SUPPRESSED_BACK_ROUTES.some((r) => pathname.startsWith(r))) {
            // Payment in progress — ignore back
            return;
          }

          if (ATTRACT_BACK_ROUTES.includes(pathname)) {
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
      } catch {
        // Web — browser handles back natively; no-op
      }
    }

    void setup();
    return () => { void listener?.remove(); };
  }, [history, pathname]);
}
