// src/brands/holiq/environment.ts
import type { BrandEnvironment } from '../types';

export const holiqEnvironment: BrandEnvironment = {
  brandId: 'holiq',
  displayName: 'Holiq',
  appId: 'com.holiq.kiosk',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.holiq.com/v1',
  apiKey: import.meta.env.VITE_API_KEY || '',
  brandHeader: import.meta.env.VITE_BRAND_HEADER || 'holiq',
  defaultTheme: {
    primary: '#0ea5e9',
    secondary: '#38bdf8',
    accent: '#f97316',
    background: '#ffffff',
    surface: '#f0f9ff',
    text: '#0c4a6e',
    textMuted: '#0369a1',
    border: '#bae6fd',
    error: '#ef4444',
    success: '#22c55e',
    fontFamily: "'Poppins', system-ui, sans-serif",
    logoUrl: '',
    radius: '1rem',
  },
  catalog: {
    strategy: 'paginated',
    pageSize: 20,
  },
  defaultTaxRate: 0.0825,
  defaultLocale: 'en-US',
  defaultCurrency: 'USD',
  defaultTimezone: 'America/Chicago',
};
