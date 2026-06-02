// src/hooks/useOrientation.ts
// Reactive portrait / landscape detection.
// Safe in SSR (server-side / prerender) — returns false until window is available.

import { useState, useEffect } from 'react';

export function useIsLandscape(): boolean {
  const [ls, setLs] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false,
  );

  useEffect(() => {
    function update() { setLs(window.innerWidth > window.innerHeight); }
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return ls;
}
