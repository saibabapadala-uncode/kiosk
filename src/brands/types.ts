// src/brands/types.ts

export type BrandId = 'straunt' | 'holiq' | 'restro';

export interface BrandTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  error: string;
  success: string;
  fontFamily: string;
  logoUrl: string;
  radius: string;
}

export type CatalogStrategy = 'full-load' | 'paginated';

export interface BrandEnvironment {
  brandId: BrandId;
  displayName: string;
  appId: string;
  apiBaseUrl: string;
  apiKey: string;
  brandHeader: string;
  defaultTheme: BrandTheme;
  catalog: {
    strategy: CatalogStrategy;
    pageSize?: number;
  };
  defaultTaxRate: number;
  defaultLocale: string;
  defaultCurrency: string;
  defaultTimezone: string;
}
