// src/store/settingsStore.ts
import { create } from 'zustand';
import { persist, subscribeWithSelector, createJSONStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';
import { getBrandEnvironment } from '@/brands';
import type { BrandEnvironment } from '@/brands/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeSettings {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  fontFamily: string;
  logoUrl: string;
  radius: string;
  themeMode: ThemeMode;
}

export interface ApiSettings {
  apiBaseUrl: string;
  apiKey: string;
  brandHeader: string;
}

export interface PaymentSettings {
  stripePublishableKey: string;
  terminalLocationId: string;
  readerSerialNumber: string;
}

export interface KioskSettings {
  idleTimeoutSeconds: number; // clamped 30–300, default 120
  attractLoopEnabled: boolean;
  receiptPrinterIp: string;
  barcodeScannerEnabled: boolean;
  taxRate: number; // e.g. 0.0825 for 8.25%
  highContrastMode: boolean;
}

export interface LocalizationSettings {
  locale: 'en-US' | 'es-US';
  currency: string;
  timezone: string;
  dateFormat: string;
}

export interface SettingsState {
  brandId: string;
  locationId: string;
  theme: ThemeSettings;
  api: ApiSettings;
  payment: PaymentSettings;
  kiosk: KioskSettings;
  localization: LocalizationSettings;

  setTheme: (partial: Partial<ThemeSettings>) => void;
  setApi: (partial: Partial<ApiSettings>) => void;
  setPayment: (partial: Partial<PaymentSettings>) => void;
  setKiosk: (partial: Partial<KioskSettings>) => void;
  setLocalization: (partial: Partial<LocalizationSettings>) => void;
  setBrandId: (id: string) => void;
  setLocationId: (id: string) => void;
  resetToDefaults: (env: BrandEnvironment) => void;
}

// ─── Default values (derived from brand environment at boot) ──────────────────

function buildDefaults(): Omit<SettingsState, keyof Pick<SettingsState,
  'setTheme' | 'setApi' | 'setPayment' | 'setKiosk' | 'setLocalization' |
  'setBrandId' | 'setLocationId' | 'resetToDefaults'
>> {
  const rawBrand = import.meta.env.VITE_BRAND || 'straunt';
  const env = getBrandEnvironment(rawBrand);

  return {
    brandId: env.brandId,
    locationId: '',
    theme: {
      primary:    env.defaultTheme.primary,
      secondary:  env.defaultTheme.secondary,
      accent:     env.defaultTheme.accent,
      background: env.defaultTheme.background,
      surface:    env.defaultTheme.surface,
      text:       env.defaultTheme.text,
      textMuted:  env.defaultTheme.textMuted,
      border:     env.defaultTheme.border,
      fontFamily: env.defaultTheme.fontFamily,
      logoUrl:    env.defaultTheme.logoUrl,
      radius:     env.defaultTheme.radius,
      themeMode:  'light',
    },
    api: {
      apiBaseUrl:  env.apiBaseUrl,
      apiKey:      env.apiKey,
      brandHeader: env.brandHeader,
    },
    payment: {
      stripePublishableKey: '',
      terminalLocationId:   '',
      readerSerialNumber:   '',
    },
    kiosk: {
      idleTimeoutSeconds:  120,
      attractLoopEnabled:  true,
      receiptPrinterIp:    '',
      barcodeScannerEnabled: false,
      taxRate:             env.defaultTaxRate,
      highContrastMode:    false,
    },
    localization: {
      locale:     env.defaultLocale as 'en-US' | 'es-US',
      currency:   env.defaultCurrency,
      timezone:   env.defaultTimezone,
      dateFormat: 'MM/DD/YYYY',
    },
  };
}

// ─── Capacitor Preferences storage adapter ────────────────────────────────────

const capacitorStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const { value } = await Preferences.get({ key: name });
    return value;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await Preferences.set({ key: name, value });
  },
  removeItem: async (name: string): Promise<void> => {
    await Preferences.remove({ key: name });
  },
};

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        ...buildDefaults(),

        setTheme: (partial) =>
          set((s) => ({ theme: { ...s.theme, ...partial } })),

        setApi: (partial) =>
          set((s) => ({ api: { ...s.api, ...partial } })),

        setPayment: (partial) =>
          set((s) => ({ payment: { ...s.payment, ...partial } })),

        setKiosk: (partial) =>
          set((s) => ({
            kiosk: {
              ...s.kiosk,
              ...partial,
              // clamp idle timeout
              ...(partial.idleTimeoutSeconds !== undefined
                ? { idleTimeoutSeconds: Math.max(30, Math.min(300, partial.idleTimeoutSeconds)) }
                : {}),
              // clamp tax rate
              ...(partial.taxRate !== undefined
                ? { taxRate: Math.max(0, Math.min(0.5, partial.taxRate)) }
                : {}),
            },
          })),

        setLocalization: (partial) =>
          set((s) => ({ localization: { ...s.localization, ...partial } })),

        setBrandId: (id) => set({ brandId: id }),

        setLocationId: (id) => set({ locationId: id }),

        resetToDefaults: (env) => {
          set({
            brandId: env.brandId,
            theme: {
              primary:    env.defaultTheme.primary,
              secondary:  env.defaultTheme.secondary,
              accent:     env.defaultTheme.accent,
              background: env.defaultTheme.background,
              surface:    env.defaultTheme.surface,
              text:       env.defaultTheme.text,
              textMuted:  env.defaultTheme.textMuted,
              border:     env.defaultTheme.border,
              fontFamily: env.defaultTheme.fontFamily,
              logoUrl:    env.defaultTheme.logoUrl,
              radius:     env.defaultTheme.radius,
              themeMode:  'light',
            },
            api: {
              apiBaseUrl:  env.apiBaseUrl,
              apiKey:      env.apiKey,
              brandHeader: env.brandHeader,
            },
            kiosk: {
              idleTimeoutSeconds:   120,
              attractLoopEnabled:   true,
              receiptPrinterIp:     '',
              barcodeScannerEnabled: false,
              taxRate:              env.defaultTaxRate,
              highContrastMode:     false,
            },
            localization: {
              locale:     env.defaultLocale as 'en-US' | 'es-US',
              currency:   env.defaultCurrency,
              timezone:   env.defaultTimezone,
              dateFormat: 'MM/DD/YYYY',
            },
          });
        },
      }),
      {
        name: 'ajr-kiosk-settings',
        storage: createJSONStorage(() => capacitorStorage),
        // Only persist user-configurable fields — not brandId (comes from VITE_BRAND)
        partialize: (s) => ({
          locationId:   s.locationId,
          theme:        s.theme,
          api:          s.api,
          payment:      s.payment,
          kiosk:        s.kiosk,
          localization: s.localization,
        }),
      },
    ),
  ),
);
