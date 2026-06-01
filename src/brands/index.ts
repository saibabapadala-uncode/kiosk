// src/brands/index.ts
import { strauntEnvironment } from './straunt/environment';
import { holiqEnvironment } from './holiq/environment';
import { restroEnvironment } from './restro/environment';
import type { BrandEnvironment, BrandId } from './types';

const brandRegistry: Record<BrandId, BrandEnvironment> = {
  straunt: strauntEnvironment,
  holiq: holiqEnvironment,
  restro: restroEnvironment,
};

const VALID_BRANDS: BrandId[] = ['straunt', 'holiq', 'restro'];

export function getBrandEnvironment(rawBrandId: string): BrandEnvironment {
  const brandId = rawBrandId as BrandId;
  if (!VALID_BRANDS.includes(brandId)) {
    console.warn(`[BrandProvider] Unknown brand "${rawBrandId}", falling back to "straunt".`);
    return strauntEnvironment;
  }
  return brandRegistry[brandId];
}

export function isValidBrand(id: string): id is BrandId {
  return VALID_BRANDS.includes(id as BrandId);
}

export type { BrandId, BrandEnvironment };
export { strauntEnvironment, holiqEnvironment, restroEnvironment };
