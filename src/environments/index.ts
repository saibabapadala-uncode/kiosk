/**
 * Active environment export.
 *
 * Mirrors the Angular fileReplacements pattern used in kiosk_straunt_storefront.
 * For local dev (npm run dev) this file always points at environment.ts.
 *
 * To build for a different tier, change the import path below OR run the
 * corresponding build script which handles the switch automatically:
 *
 *   npm run dev          →  environment.ts      (default / dev)
 *   npm run build:qa     →  environment.qa.ts
 *   npm run build:prod   →  environment.prod.ts
 *   npm run build:work   →  environment.work.ts
 *
 * Each file has a BRAND SELECTION section — uncomment the desired brand
 * block before building.
 */
export { environment } from './environment';
export type { Environment } from './types';
