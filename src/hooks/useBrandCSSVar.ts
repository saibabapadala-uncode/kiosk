// src/hooks/useBrandCSSVar.ts
// Reads a CSS custom property value from :root at render time.
// Used in mouse event handlers that must set inline styles matching
// the current brand color without hardcoding hex values.

import { useMemo } from 'react';

export function useBrandCSSVar(varName: string): string {
  return useMemo(
    () => getComputedStyle(document.documentElement).getPropertyValue(varName).trim(),
    // Re-read whenever the component mounts; brand changes re-mount via BrandProvider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [varName],
  );
}
