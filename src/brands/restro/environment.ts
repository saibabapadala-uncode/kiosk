// src/brands/restro/environment.ts
import type { BrandEnvironment } from '../types';

export const restroEnvironment: BrandEnvironment = {
  brandId: 'restro',
  displayName: 'Restro',
  appId: 'com.restro.kiosk',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.restro.com/v1',
  apiKey: import.meta.env.VITE_API_KEY || '',
  brandHeader: import.meta.env.VITE_BRAND_HEADER || 'restro',
  defaultTheme: {
    primary: '#16a34a',
    secondary: '#4ade80',
    accent: '#dc2626',
    background: '#ffffff',
    surface: '#f0fdf4',
    text: '#14532d',
    textMuted: '#166534',
    border: '#bbf7d0',
    error: '#ef4444',
    success: '#22c55e',
    fontFamily: "'Nunito', system-ui, sans-serif",
    logoUrl: '',
    radius: '0.5rem',
  },
  catalog: {
    strategy: 'full-load',
  },
  defaultTaxRate: 0.0825,
  defaultLocale: 'en-US',
  defaultCurrency: 'USD',
  defaultTimezone: 'America/Chicago',
};
