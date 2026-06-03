// src/config/brand-auth.ts
//
// Single source of truth for brand-specific auth constants at runtime.
//
// WHY THIS FILE EXISTS
// ─────────────────────
// AUTH_CONFIG (auth.config.ts) is evaluated once at module load from Vite
// env vars baked at BUILD TIME.  When the kiosk operator selects "Holiq" on
// the brand-select screen at runtime, AUTH_CONFIG still holds Straunt values.
//
// This means every API call — unauthenticated gateway, subscription check,
// store listing, channel listing, and the axios interceptor prd_id header —
// would be sent with the WRONG tenant identifiers, causing auth failures or
// results from the wrong account.
//
// SOLUTION: Always call getActiveBrandAuthConfig() instead of reading
// AUTH_CONFIG.APP_GROUP_ID / AUTH_CONFIG.PRD_ID directly.
//
// ── Values that differ per brand ──────────────────────────────────────────────
//   appGroupId        Straunt:  1719308705812195
//                     Holiq:    1673597639768441
//                     Restro:   1737711322147389
//
//   prdId             Straunt:  1718865526155464
//                     Holiq:    1673597530239814
//                     Restro:   1737710744958522
//
//   storesServiceId   All brands: 3821548006039960
//                     (Holiq ext-store api.service.ts also hardcodes this same ID.
//                      The env var get_stores_bls_id='3828022124411623' is unused.
//                      Confirmed working via curl with prd_id=1673597530239814.)
//
// ── Values identical across all brands ───────────────────────────────────────
//   channelsServiceId, ga_application_id, ga_environment_id, controller_id,
//   account_id, shared_application_id, shared_environment_id, tac_environment_id,
//   all gateway URLs (unauth_url, auth_url, login_url, subscribed_api, dev_url)

import { useSettingsStore } from '@/store/settingsStore';
import { getBrandEnvironment, isValidBrand } from '@/brands';
import type { BrandAuthConfig } from '@/brands/types';

// Fallback used only before the brand-select screen has run (fresh install).
// In normal operation RootRedirect forces brand selection before login,
// so this path should never be hit after initial setup.
const STRAUNT_FALLBACK: BrandAuthConfig = {
  appGroupId:        '1719308705812195',
  prdId:             '1718865526155464',
  storesServiceId:   '3821548006039960',
  channelsServiceId: '3880470537073453',
  uniqueCode:        'straunt',
};

/**
 * Returns the BrandAuthConfig for the currently selected brand.
 *
 * Reads live Zustand store state — always reflects the brand chosen on
 * the brand-select screen, not the build-time VITE_BRAND default.
 *
 * Called by: auth.service.ts (app_group_id, prd_id),
 *            store.service.ts (storesServiceId),
 *            api.service.ts interceptor (prd_id header).
 */
export function getActiveBrandAuthConfig(): BrandAuthConfig {
  const brandId = useSettingsStore.getState().brandId;
  if (brandId && isValidBrand(brandId)) {
    return getBrandEnvironment(brandId).authConfig;
  }
  return STRAUNT_FALLBACK;
}
