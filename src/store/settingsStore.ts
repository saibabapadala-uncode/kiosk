// src/store/settingsStore.ts
import { create } from 'zustand';
import { persist, subscribeWithSelector, createJSONStorage } from 'zustand/middleware';
import { Preferences } from '@capacitor/preferences';
import { getBrandEnvironment } from '@/brands';
import type { BrandEnvironment } from '@/brands/types';
import type { BrandId } from '@/brands/types';

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
  /** Optional short tagline shown under the store name on the attract screen */
  tagline?: string;
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
  /** How to connect to the reader */
  connectionMethod: 'bluetooth' | 'internet' | 'localMobile';
  /** Automatically try to reconnect when reader drops unexpectedly */
  autoReconnect: boolean;
  /** Disconnect reader after N minutes of no payment activity (0 = never) */
  sessionTimeoutMinutes: number;
}

export interface KioskSettings {
  idleTimeoutSeconds: number; // clamped 30–300, default 120
  attractLoopEnabled: boolean;
  receiptPrinterIp: string;
  barcodeScannerEnabled: boolean;
  taxRate: number; // e.g. 0.0825 for 8.25%
  highContrastMode: boolean;
  /** Whether the staff PIN gate is active. Starts false — staff opts in after first login. */
  staffPinEnabled: boolean;
  /** 4-digit PIN used when staffPinEnabled = true. */
  staffPin: string;
}

/** All supported UI locales. RTL languages have their own dir attribute. */
export type SupportedLocale =
  | 'en-US'   // English
  | 'es-US'   // Spanish
  | 'hi'      // Hindi      — Devanagari, LTR
  | 'ta'      // Tamil      — Tamil script, LTR
  | 'te'      // Telugu     — Telugu script, LTR
  | 'kn'      // Kannada    — Kannada script, LTR
  | 'ml'      // Malayalam  — Malayalam script, LTR
  | 'bn'      // Bengali    — Bengali script, LTR
  | 'ar';     // Arabic     — RTL

export const RTL_LOCALES: SupportedLocale[] = ['ar'];

export interface LocalizationSettings {
  locale: SupportedLocale;
  currency: string;
  timezone: string;
  dateFormat: string;
}

export interface SettingsState {
  brandId: string;
  /** true once the user has explicitly selected a brand on /brand-select */
  brandSelected: boolean;
  /** true after a successful login — brand cannot be changed until logout clears this */
  brandLocked: boolean;
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
  /**
   * Atomically apply all brand-environment defaults in a single set() call.
   * Called by useBrandDetection after resolving the active brand at runtime.
   * Replaces the scattered resetToDefaults() + setBrandId() pattern.
   */
  applyBrandEnvironment: (env: BrandEnvironment) => void;
  /** Called from BrandSelectScreen — applies env, marks brand as selected */
  selectBrand: (id: BrandId) => void;
  /** Called after successful login — locks the brand until logout */
  lockBrand: () => void;
  /** Called on logout — clears all brand state so /brand-select is shown again */
  clearBrand: () => void;
}

// ─── Default values (derived from brand environment at boot) ──────────────────

function buildDefaults(): Omit<SettingsState, keyof Pick<SettingsState,
  'setTheme' | 'setApi' | 'setPayment' | 'setKiosk' | 'setLocalization' |
  'setBrandId' | 'setLocationId' | 'resetToDefaults' |
  'applyBrandEnvironment' | 'selectBrand' | 'lockBrand' | 'clearBrand'
>> {
  const rawBrand = import.meta.env.VITE_BRAND || 'straunt';
  const env = getBrandEnvironment(rawBrand);

  return {
    brandId: '',
    brandSelected: false,
    brandLocked: false,
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
      stripePublishableKey:   '',
      terminalLocationId:     '',
      readerSerialNumber:     '',
      connectionMethod:       'bluetooth' as const,
      autoReconnect:          true,
      sessionTimeoutMinutes:  30,
    },
    kiosk: {
      idleTimeoutSeconds:  120,
      attractLoopEnabled:  true,
      receiptPrinterIp:    '',
      barcodeScannerEnabled: false,
      taxRate:             env.defaultTaxRate,
      highContrastMode:    false,
      staffPinEnabled:     true,
      staffPin:            '1234',
    },
    localization: {
      locale:     env.defaultLocale as SupportedLocale,
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

        selectBrand: (id) => {
          const env = getBrandEnvironment(id);
          set({
            brandId:       id,
            brandSelected: true,
            brandLocked:   false,
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
              idleTimeoutSeconds:    env.businessRules?.kioskDefaults?.idleTimeoutSeconds ?? 120,
              attractLoopEnabled:    env.businessRules?.kioskDefaults?.attractLoopEnabled ?? true,
              receiptPrinterIp:      '',
              barcodeScannerEnabled: false,
              taxRate:               env.defaultTaxRate,
              highContrastMode:      false,
              staffPinEnabled:       env.businessRules?.kioskDefaults?.staffPinEnabled ?? true,
              staffPin:              '1234',
            },
            localization: {
              locale:     env.defaultLocale as SupportedLocale,
              currency:   env.defaultCurrency,
              timezone:   env.defaultTimezone,
              dateFormat: 'MM/DD/YYYY',
            },
          });
        },

        lockBrand: () => set({ brandLocked: true }),

        clearBrand: () => {
          const rawBrand = import.meta.env.VITE_BRAND as string | undefined;
          set({ brandId: rawBrand ?? '', brandSelected: Boolean(rawBrand), brandLocked: false });
        },

        applyBrandEnvironment: (env) => {
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
              idleTimeoutSeconds:    env.businessRules?.kioskDefaults?.idleTimeoutSeconds ?? 120,
              attractLoopEnabled:    env.businessRules?.kioskDefaults?.attractLoopEnabled ?? true,
              receiptPrinterIp:      '',
              barcodeScannerEnabled: false,
              taxRate:               env.defaultTaxRate,
              highContrastMode:      false,
              staffPinEnabled:       env.businessRules?.kioskDefaults?.staffPinEnabled ?? true,
              staffPin:              '1234',
            },
            localization: {
              locale:     env.defaultLocale as SupportedLocale,
              currency:   env.defaultCurrency,
              timezone:   env.defaultTimezone,
              dateFormat: 'MM/DD/YYYY',
            },
          });
        },

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
              staffPinEnabled:      false,
              staffPin:             '1234',
            },
            localization: {
              locale:     env.defaultLocale as SupportedLocale,
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
        // Persist brandId so runtime-detected brand survives device reboots.
        partialize: (s) => ({
          brandId:       s.brandId,
          brandSelected: s.brandSelected,
          brandLocked:   s.brandLocked,
          locationId:    s.locationId,
          theme:         s.theme,
          api:           s.api,
          payment:       s.payment,
          kiosk:         s.kiosk,
          localization:  s.localization,
        }),
      },
    ),
  ),
);
