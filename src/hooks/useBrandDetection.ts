// src/hooks/useBrandDetection.ts
// Three-signal runtime brand resolution pipeline.
//
// Signal 1 — subscription app_id (earliest, most authoritative):
//   Set on AuthUser.detectedBrandId by auth.service.ts immediately after login.
//
// Signal 2 — store/details brand code (post-channel-select):
//   Extracted from StoreConfig.brandCode by storeConfigStore.parseConfig().
//   Resolved via resolveBrandFromStoreCode() in src/brands/index.ts.
//
// Signal 3 — VITE_BRAND env var (build-time fallback, last resort):
//   Only used when both runtime signals return null/empty.
//
// Returns the resolved BrandId and a boolean indicating whether resolution
// is complete. BrandProvider calls settingsStore.applyBrandEnvironment()
// when the resolved id changes.

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useStoreConfigStore } from '@/store/storeConfigStore';
import { useSettingsStore } from '@/store/settingsStore';
import {
  getBrandEnvironment,
  isValidBrand,
  resolveBrandFromStoreCode,
} from '@/brands';
import type { BrandId } from '@/brands/types';

export function useBrandDetection(): { brandId: BrandId | null; isResolved: boolean } {
  const authUser      = useAuthStore(s => s.user);
  const brandCode     = useStoreConfigStore(s => s.brandCode);
  const storedBrandId = useSettingsStore(s => s.brandId);
  const applyBrand    = useSettingsStore(s => s.applyBrandEnvironment);

  // Prevent re-applying the same brand on every render
  const appliedRef = useRef<string>('');

  // Resolve the current best brand
  function resolve(): BrandId | null {
    // Signal 1: from post-login subscription check
    const fromLogin = authUser?.detectedBrandId;
    if (fromLogin && isValidBrand(fromLogin)) return fromLogin;

    // Signal 2: from store/details response
    if (brandCode) {
      const fromStore = resolveBrandFromStoreCode(brandCode);
      if (fromStore) return fromStore;
    }

    // Signal 3: persisted brand from a previous session
    if (storedBrandId && isValidBrand(storedBrandId)) return storedBrandId as BrandId;

    // Signal 4: build-time env var
    const envBrand = import.meta.env.VITE_BRAND as string | undefined;
    if (envBrand && isValidBrand(envBrand)) return envBrand;

    return null;
  }

  const resolved = resolve();

  useEffect(() => {
    if (!resolved) return;
    if (appliedRef.current === resolved) return;
    appliedRef.current = resolved;
    const env = getBrandEnvironment(resolved);
    applyBrand(env);
  }, [resolved, applyBrand]);

  return {
    brandId:    resolved,
    isResolved: resolved !== null,
  };
}
