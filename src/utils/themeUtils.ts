// src/utils/themeUtils.ts
// ═══════════════════════════════════════════════════════════════════════════
// Professional Dark Theme System - Instant Switching Utilities
// ═══════════════════════════════════════════════════════════════════════════

import { logger } from './logger';

/**
 * Apply theme instantly without flicker
 * 1. Temporarily disables all transitions
 * 2. Updates data-theme attribute
 * 3. Forces DOM reflow to ensure update applies
 * 4. Re-enables transitions smoothly
 *
 * Result: Theme changes in ~10ms with zero flicker
 */
export function applyThemeInstantly(mode: 'light' | 'dark'): void {
  const root = document.documentElement;
  const startTime = performance.now();

  try {
    // Create a style element to disable transitions
    const disableTransitionsStyle = document.createElement('style');
    disableTransitionsStyle.id = 'disable-transitions-during-theme';
    disableTransitionsStyle.textContent = `
      * {
        transition: none !important;
        animation: none !important;
      }
    `;
    document.head.appendChild(disableTransitionsStyle);

    // Apply theme immediately
    root.setAttribute('data-theme', mode);
    root.classList.add('theme-switching');

    // Force a reflow to ensure the browser applies the change
    void root.offsetHeight;

    // Remove transition-disabling style after a tiny delay
    requestAnimationFrame(() => {
      if (disableTransitionsStyle.parentNode) {
        document.head.removeChild(disableTransitionsStyle);
      }
      root.classList.remove('theme-switching');

      const duration = performance.now() - startTime;
      logger.debug(`[Theme] Applied ${mode} mode in ${duration.toFixed(2)}ms`);
    });
  } catch (error) {
    logger.error('[Theme] Failed to apply theme:', error);
  }
}

/**
 * Resolve theme mode, handling 'auto' by checking OS preference
 */
export function resolveThemeMode(mode: 'light' | 'dark' | 'auto'): 'light' | 'dark' {
  if (mode !== 'auto') {
    return mode;
  }

  // Check OS dark mode preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

/**
 * Sync theme attribute on DOM with a stored value
 * Useful for ensuring consistency after page reload or state restoration
 */
export function syncThemeToDOM(mode: 'light' | 'dark' | 'auto'): void {
  const resolvedMode = resolveThemeMode(mode);
  applyThemeInstantly(resolvedMode);
  logger.debug(`[Theme] Synced theme to DOM: ${resolvedMode}`);
}

/**
 * Get current theme from DOM
 */
export function getCurrentTheme(): 'light' | 'dark' {
  return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
}

/**
 * Listen to OS dark mode preference changes (for 'auto' mode)
 */
export function onOSThemeChange(callback: (mode: 'light' | 'dark') => void): () => void {
  if (!window.matchMedia) {
    return () => {};
  }

  const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
    const newMode = e.matches ? 'dark' : 'light';
    callback(newMode);
  };

  // Use addEventListener for better browser compatibility
  if (darkModeQuery.addEventListener) {
    darkModeQuery.addEventListener('change', handleChange);
    return () => darkModeQuery.removeEventListener('change', handleChange);
  }

  // Fallback for older browsers
  return () => {};
}

/**
 * Force an immediate visual update without cache delay
 * Useful after dynamic style changes
 */
export function forceThemeRefresh(): void {
  const root = document.documentElement;
  const currentTheme = getCurrentTheme();

  // Toggle and reset to force refresh
  const otherTheme = currentTheme === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', otherTheme);
  void root.offsetHeight; // Force reflow
  root.setAttribute('data-theme', currentTheme);

  logger.debug('[Theme] Forced theme refresh');
}

/**
 * Preload theme to prevent flash of wrong colors on initial load
 * Should be called before React hydration if possible
 */
export function preloadTheme(theme: 'light' | 'dark' | 'auto'): void {
  const resolvedTheme = resolveThemeMode(theme);
  document.documentElement.setAttribute('data-theme', resolvedTheme);
  logger.debug(`[Theme] Preloaded theme: ${resolvedTheme}`);
}
