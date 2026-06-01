// src/brands/straunt/environment.ts
import type { BrandEnvironment } from '../types';

export const strauntEnvironment: BrandEnvironment = {
  brandId: 'straunt',
  displayName: 'Straunt',
  appId: 'com.straunt.kiosk',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.straunt.com/v1',
  apiKey: import.meta.env.VITE_API_KEY || '',
  brandHeader: import.meta.env.VITE_BRAND_HEADER || 'straunt',
  defaultTheme: {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#f59e0b',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
    error: '#ef4444',
    success: '#22c55e',
    fontFamily: "'Inter', system-ui, sans-serif",
    logoUrl: '',
    radius: '0.75rem',
  },
  catalog: {
    strategy: 'full-load',
  },
  defaultTaxRate: 0.0825,
  defaultLocale: 'en-US',
  defaultCurrency: 'USD',
  defaultTimezone: 'America/Chicago',
};
