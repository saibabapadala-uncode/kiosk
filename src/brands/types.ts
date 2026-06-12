// src/brands/types.ts

import type { BrandBusinessRules, AttractScreenConfig } from './businessRules';

// ─── Brand identity ───────────────────────────────────────────────────────────

export type BrandId = 'straunt' | 'holiq' | 'restro';

// ─── Brand-specific authentication config ─────────────────────────────────────
// These values differ per brand/tenant and MUST be read at runtime from the
// active brand environment — NOT from build-time VITE_ env vars.
// gateway URLs (unauth_url, auth_url, etc.) are the same for all brands.

export interface BrandAuthConfig {
  /**
   * Platform/brand group identifier.
   * Sent as `app_group_id` in every unauthenticated gateway request header.
   * Straunt: '1719308705812195' | Holiq: '1673597639768441' | Restro: '1737711322147389'
   */
  appGroupId: string;
  /**
   * Product/subscription ID used to match the correct tac_application_id after login.
   * Straunt: '1718865526155464' | Holiq: '1673597530239814' | Restro: '1737710744958522'
   */
  prdId: string;
  /**
   * BLS (shared-component) service ID for the "list stores" endpoint.
   * Straunt/Restro: '3821548006039960' | Holiq: '3828022124411623'
   */
  storesServiceId: string;
  /**
   * BLS service ID for the "list kiosk channels" endpoint.
   * Same for all brands: '3880470537073453'
   */
  channelsServiceId: string;
  /**
   * Short brand code sent as a unique_code identifier in some API contexts.
   */
  uniqueCode: string;
}
// To add a brand: add its literal here, create src/brands/<id>/environment.ts,
// then add one entry to BRAND_REGISTRY in src/brands/index.ts.

// ─── Theme tokens ─────────────────────────────────────────────────────────────

export interface BrandTheme {
  // ── Core palette (maps 1:1 to CSS custom properties) ───────────────
  /** Primary CTA color → --color-brand-primary */
  primary: string;
  /** Gradient endpoint / secondary accent → --color-brand-secondary */
  secondary: string;
  /** Tertiary highlight → --color-brand-accent */
  accent: string;
  /** Page background → --color-brand-bg */
  background: string;
  /** Card/pill surface → --color-brand-surface */
  surface: string;
  /** Primary body text → --color-brand-text */
  text: string;
  /** Helper/muted text → --color-brand-muted */
  textMuted: string;
  /** Dividers and outlines → --color-brand-border */
  border: string;
  /** Error/destructive → --color-brand-error */
  error: string;
  /** Confirmation → --color-brand-success */
  success: string;
  /** Body font stack → --font-brand */
  fontFamily: string;
  /** Brand logo URL (empty = SVG fallback) */
  logoUrl: string;
  /** Default border-radius → --radius-brand */
  radius: string;

  // ── Extended tokens (Phase 2 additions) ──────────────────────────
  /** Non-destructive alert color → --color-brand-warning */
  warning?: string;
  /** Hover background for primary CTAs → --color-brand-primary-hover */
  primaryHover?: string;
  /** Pressed/active background for primary CTAs → --color-brand-primary-active */
  primaryActive?: string;
  /** Gradient start for CTAs/active items → --color-brand-gradient-start */
  gradientStart?: string;
  /** Gradient end for CTAs/active items → --color-brand-gradient-end */
  gradientEnd?: string;
  /** Text on filled primary backgrounds → --color-brand-text-inverse */
  textInverse?: string;
  /** Nested card/search-bar-at-rest surface → --color-brand-surface-alt */
  surfaceAlt?: string;
  /** Count badges and status chips → --color-brand-badge-bg */
  badgeBg?: string;
  /** Optional store/operator tagline displayed on catalog header */
  tagline?: string;
}

// ─── Catalog config ───────────────────────────────────────────────────────────

export type CatalogStrategy = 'full-load' | 'paginated';

export type CatalogSortOrder = 'api-order' | 'popularity' | 'price-asc' | 'price-desc' | 'alpha';

export type ProductCardVariant = 'standard' | 'compact' | 'featured';

export interface BrandCatalogConfig {
  strategy: CatalogStrategy;
  pageSize?: number;
  defaultSortOrder?: CatalogSortOrder;
  productCardVariant?: ProductCardVariant;
  excludedCategoryIds?: string[];
  showDietaryBadges?: boolean;
  hideUnavailableProducts?: boolean;
}

// ─── Full brand environment ───────────────────────────────────────────────────

export interface BrandEnvironment {
  // ── Identity ──────────────────────────────────────────────────────
  brandId: BrandId;
  displayName: string;
  appId: string;

  // ── API connection ────────────────────────────────────────────────
  apiBaseUrl: string;
  apiKey: string;
  brandHeader: string;

  // ── Localisation defaults ─────────────────────────────────────────
  defaultLocale: string;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultTaxRate: number;

  // ── Sub-configurations ────────────────────────────────────────────
  defaultTheme: BrandTheme;
  catalog: BrandCatalogConfig;

  // ── Brand-specific auth credentials (REQUIRED for correct API routing) ──
  /**
   * Auth identifiers that differ per brand/tenant.
   * Read at runtime by getActiveBrandAuthConfig() so API calls always use
   * the correct app_group_id, prd_id, and stores_service_id for the
   * currently selected brand — NOT the build-time defaults.
   */
  authConfig: BrandAuthConfig;

  // ── New in Phase 2 (optional so existing builds keep compiling) ───
  /**
   * Per-brand business rules: payments, tipping, age verification, etc.
   * Optional for backwards compatibility; components should guard with ?. access.
   */
  businessRules?: BrandBusinessRules;
  /**
   * Attract / idle screen content and media.
   * Falls back to sensible defaults when absent.
   */
  attractScreen?: AttractScreenConfig;
  /**
   * Maps lowercase category-name substrings to emoji/icon identifiers.
   * Evaluated in insertion order; first matching key wins.
   * Falls back to the food keyword map in CatalogScreen when absent.
   */
  categoryIconMap?: Record<string, string>;
  /**
   * Rotating search-bar placeholder hints.
   * Falls back to generic hints when absent.
   */
  searchHints?: string[];

  /**
   * Configuration for alternative payment methods (Phone Pay / QR Pay).
   * These mirror fields from kiosk_straunt_storefront's merchant-details config
   * and are needed to call the uncodeapi.com payment gateway correctly.
   * Optional — when absent, Phone Pay and QR Pay are hidden.
   */
  altPayment?: BrandAltPaymentConfig;

  /**
   * Pre-configured Stripe Terminal location IDs for this brand.
   * Shown as a selector in the Payment settings tab so staff can pick the
   * correct location without typing the ID manually.
   * Optional — when absent, the tab falls back to a free-text input.
   */
  stripeTerminalLocations?: Array<{ id: string; label: string }>;
}

// ─── Alternative payment config ───────────────────────────────────────────────

export interface BrandAltPaymentConfig {
  /**
   * Industry identifier for the brand — sent as `industry_id` in the phone
   * order access-key request. Comes from the store details in the old project
   * (storeDetails.store.industry_id); stored here for offline/fast access.
   */
  industryId: string;

  /**
   * Default / anonymous customer ID used for QR Pay cart creation.
   * The old project uses marchantDetails[env].default_customer.id.
   */
  defaultCustomerId: string;

  /**
   * Default / anonymous customer phone number used for QR Pay cart creation.
   */
  defaultCustomerPhone: string;

  /**
   * Base URL for the anonymous cart / AI-cart viewer.
   * QR URL format: {anonymousProjectUrl}/aicart/{storeCode}/{customerId}/{suId}
   * Example: 'https://straunt.com'
   */
  anonymousProjectUrl: string;
}
