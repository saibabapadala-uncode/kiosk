// src/brands/index.ts
import { strauntEnvironment } from './straunt/environment';
import { holiqEnvironment }   from './holiq/environment';
import { restroEnvironment }  from './restro/environment';
import type { BrandEnvironment, BrandId } from './types';

// ─── Registry ──────────────────────────────────────────────────────────────────
// TypeScript enforces that every BrandId has an entry here at compile time.

const BRAND_REGISTRY: Record<BrandId, BrandEnvironment> = {
  straunt: strauntEnvironment,
  holiq:   holiqEnvironment,
  restro:  restroEnvironment,
};

// Derived — never out of sync with the registry
const VALID_BRAND_IDS = Object.keys(BRAND_REGISTRY) as BrandId[];

// ─── app_id → BrandId lookup table ────────────────────────────────────────────
// Maps subscription app_id strings returned by the auth API to registered brands.
// Extend via VITE_BRAND_APP_ID_MAP env var (JSON: {"<app_id>":"<brandId>"})
// without requiring code changes.

const BASE_APP_ID_MAP: Record<string, BrandId> = {
  // Add real app_id values here as brands are onboarded.
  // Example: '1718865526155464': 'straunt',
};

function buildAppIdMap(): Record<string, BrandId> {
  try {
    const extra = import.meta.env.VITE_BRAND_APP_ID_MAP;
    if (extra) {
      const parsed = JSON.parse(extra) as Record<string, string>;
      const merged: Record<string, BrandId> = { ...BASE_APP_ID_MAP };
      for (const [appId, brandId] of Object.entries(parsed)) {
        if (isValidBrand(brandId)) merged[appId] = brandId;
      }
      return merged;
    }
  } catch {
    // malformed env var — use base map
  }
  return BASE_APP_ID_MAP;
}

const APP_ID_BRAND_MAP = buildAppIdMap();

// ─── Public API ────────────────────────────────────────────────────────────────

export function getBrandEnvironment(rawBrandId: string): BrandEnvironment {
  if (!isValidBrand(rawBrandId)) {
    console.error(
      `[BrandRegistry] Unknown brand "${rawBrandId}". ` +
      `Valid brands: ${VALID_BRAND_IDS.join(', ')}. ` +
      `Check your VITE_BRAND environment variable.`,
    );
    // Return straunt as a safe fallback instead of crashing the app.
    return strauntEnvironment;
  }
  return BRAND_REGISTRY[rawBrandId];
}

export function isValidBrand(id: string): id is BrandId {
  return Object.prototype.hasOwnProperty.call(BRAND_REGISTRY, id);
}

/**
 * Resolve a BrandId from a subscription app_id returned by the auth API.
 * Returns null when the app_id is unknown — callers should fall through to
 * the next signal in the brand detection pipeline.
 */
export function resolveBrandFromAppId(appId: string): BrandId | null {
  return APP_ID_BRAND_MAP[appId] ?? null;
}

/**
 * Resolve a BrandId from a store/details brand code (case-insensitive prefix match).
 * Returns null when no match — callers should fall through to VITE_BRAND.
 */
export function resolveBrandFromStoreCode(code: string): BrandId | null {
  if (!code) return null;
  const lower = code.toLowerCase();
  for (const brandId of VALID_BRAND_IDS) {
    if (lower.startsWith(brandId) || lower.includes(brandId)) return brandId;
  }
  return null;
}

export type { BrandId, BrandEnvironment };
export { strauntEnvironment, holiqEnvironment, restroEnvironment };
