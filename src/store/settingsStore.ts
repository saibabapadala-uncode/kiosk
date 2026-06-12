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
  /** ISO timestamp of when the reader was last successfully connected; null if never */
  lastConnectedAt: string | null;
  /**
   * Uncode payment key — "pay-stripe_connect-platform-XXXX".
   * Used as the `key` field in the connection-token request payload.
   * Matches kiosk_straunt_storefront environment.pay_key.
   */
  stripePayKey: string;
  /**
   * Uncode merchant ID — numeric string from the platform.
   * Matches kiosk_straunt_storefront environment.merchant_id.
   */
  merchantId: string;
  /**
   * Uncode store ID — numeric string from the platform.
   * Matches kiosk_straunt_storefront environment.store_id.
   */
  storeId: string;
  /**
   * Environment type: 'qa' or 'prod'.
   * Matches kiosk_straunt_storefront environment.env_type.
   */
  envType: 'qa' | 'prod';
}

export interface KioskSettings {
  idleTimeoutSeconds: number; // clamped 30–300, default 120
  attractLoopEnabled: boolean;
  barcodeScannerEnabled: boolean;
  taxRate: number; // e.g. 0.0825 for 8.25%
  highContrastMode: boolean;
  /** Whether the staff PIN gate is active. Starts false — staff opts in after first login. */
  staffPinEnabled: boolean;
  /** 4-digit PIN used when staffPinEnabled = true. */
  staffPin: string;
  receiptPrinterIp: string;
}

export type PrinterConnectionType = 'bluetooth' | 'lan' | 'none';

export interface SinglePrinterSettings {
  connectionType: PrinterConnectionType;
  defaultPrinterName: string;
  defaultPrinterAddress: string;
  lanPrinterIp: string;
  lanPrinterModel: string;
}

export interface PrinterSettings {
  /** Friendly name of the default printer device */
  defaultPrinterName: string;
  /** Bluetooth MAC address or IP address of the default printer */
  defaultPrinterAddress: string;
  /** How to connect to the printer */
  connectionType: PrinterConnectionType;
  /** IP address for LAN/Wi-Fi Epson printers (legacy ESC/POS over HTTP) */
  lanPrinterIp: string;
  /** Model for LAN/Wi-Fi printer (e.g. 'TSP143', 'SP700', 'Epson') */
  lanPrinterModel: string;
  /** ISO timestamp of when the printer was last successfully connected */
  lastConnectedAt: string | null;

  customer: SinglePrinterSettings;
  kitchen: SinglePrinterSettings;

  /** Print customer receipt after payment */
  printCustomerReceipt: boolean;
  /** Print kitchen ticket (KOT) after payment.
   *  If true but kitchen printer not configured, falls back to customer printer. */
  printKitchenReceipt: boolean;
  /** Automatically print 1 s after successful payment (mirrors storefront printButton setTimeout) */
  autoPrintAfterPayment: boolean;
}

/** All supported UI locales. RTL languages have their own dir attribute. */
export type SupportedLocale =
  | 'en-US'   // English (US)
  | 'es-US'   // Spanish
  | 'fr'      // French     — LTR
  | 'de'      // German     — LTR
  | 'ja'      // Japanese   — LTR
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
  printer: PrinterSettings;
  kiosk: KioskSettings;
  localization: LocalizationSettings;

  setTheme: (partial: Partial<ThemeSettings>) => void;
  setApi: (partial: Partial<ApiSettings>) => void;
  setPayment: (partial: Partial<PaymentSettings>) => void;
  setPrinter: (partial: Partial<PrinterSettings>) => void;
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
  'setTheme' | 'setApi' | 'setPayment' | 'setPrinter' | 'setKiosk' | 'setLocalization' |
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
      themeMode:  'auto',
    },
    api: {
      apiBaseUrl:  env.apiBaseUrl,
      apiKey:      env.apiKey,
      brandHeader: env.brandHeader,
    },
    payment: {
      stripePublishableKey:   '',
      terminalLocationId:     import.meta.env.VITE_STRIPE_TERMINAL_LOCATION_ID ?? '',
      readerSerialNumber:     '',
      connectionMethod:       'bluetooth' as const,
      autoReconnect:          true,
      sessionTimeoutMinutes:  30,
      lastConnectedAt:        null,
      stripePayKey:           import.meta.env.VITE_STRIPE_PAY_KEY ?? '',
      merchantId:             import.meta.env.VITE_STRIPE_MERCHANT_ID ?? '',
      storeId:                import.meta.env.VITE_STRIPE_STORE_ID ?? '',
      envType:               (import.meta.env.VITE_STRIPE_ENV_TYPE ?? 'qa') as 'qa' | 'prod',
    },
    printer: {
      defaultPrinterName:    '',
      defaultPrinterAddress: '',
      connectionType:        'none' as const,
      lanPrinterIp:          '',
      lanPrinterModel:       'TSP143',
      lastConnectedAt:       null,
      printCustomerReceipt:  true,
      printKitchenReceipt:   true,
      autoPrintAfterPayment: true,
      customer: {
        connectionType:      'none' as const,
        defaultPrinterName:  '',
        defaultPrinterAddress: '',
        lanPrinterIp:        '',
        lanPrinterModel:     'TSP143',
      },
      kitchen: {
        connectionType:      'none' as const,
        defaultPrinterName:  '',
        defaultPrinterAddress: '',
        lanPrinterIp:        '',
        lanPrinterModel:     'TSP143',
      },
    },
    kiosk: {
      idleTimeoutSeconds:  120,
      attractLoopEnabled:  true,
      barcodeScannerEnabled: false,
      taxRate:             env.defaultTaxRate,
      highContrastMode:    false,
      staffPinEnabled:     true,
      staffPin:            '1234',
      receiptPrinterIp:    '',
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

        setPrinter: (partial) =>
          set((s) => ({ printer: { ...s.printer, ...partial } })),

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
              themeMode:  'auto',
            },
            api: {
              apiBaseUrl:  env.apiBaseUrl,
              apiKey:      env.apiKey,
              brandHeader: env.brandHeader,
            },
            kiosk: {
              idleTimeoutSeconds:    env.businessRules?.kioskDefaults?.idleTimeoutSeconds ?? 120,
              attractLoopEnabled:    env.businessRules?.kioskDefaults?.attractLoopEnabled ?? true,
              barcodeScannerEnabled: false,
              taxRate:               env.defaultTaxRate,
              highContrastMode:      false,
              staffPinEnabled:       env.businessRules?.kioskDefaults?.staffPinEnabled ?? true,
              staffPin:              '1234',
              receiptPrinterIp:      '',
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
              themeMode:  'auto',
            },
            api: {
              apiBaseUrl:  env.apiBaseUrl,
              apiKey:      env.apiKey,
              brandHeader: env.brandHeader,
            },
            kiosk: {
              idleTimeoutSeconds:    env.businessRules?.kioskDefaults?.idleTimeoutSeconds ?? 120,
              attractLoopEnabled:    env.businessRules?.kioskDefaults?.attractLoopEnabled ?? true,
              barcodeScannerEnabled: false,
              taxRate:               env.defaultTaxRate,
              highContrastMode:      false,
              staffPinEnabled:       env.businessRules?.kioskDefaults?.staffPinEnabled ?? true,
              staffPin:              '1234',
              receiptPrinterIp:      '',
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
              themeMode:  'auto',
            },
            api: {
              apiBaseUrl:  env.apiBaseUrl,
              apiKey:      env.apiKey,
              brandHeader: env.brandHeader,
            },
            kiosk: {
              idleTimeoutSeconds:   120,
              attractLoopEnabled:   true,
              barcodeScannerEnabled: false,
              taxRate:              env.defaultTaxRate,
              highContrastMode:     false,
              staffPinEnabled:      false,
              staffPin:             '1234',
              receiptPrinterIp:     '',
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
        version: 1,
        migrate: (persistedState, fromVersion) => {
          const state = (persistedState ?? {}) as Record<string, unknown>;
          if (fromVersion < 1) {
            // Fix a known digit-1 / letter-l typo in the stored terminal location ID.
            // The location 'tml_F1fBQAfxoU9GY1' (digit 1 at end) doesn't exist in Stripe;
            // the correct Production ID ends with the letter l: 'tml_F1fBQAfxoU9GYl'.
            // Migrate to the QA/M2 location that matches the reference app's registered reader.
            const payment = (state.payment ?? {}) as Record<string, unknown>;
            if (payment.terminalLocationId === 'tml_F1fBQAfxoU9GY1') {
              state.payment = { ...payment, terminalLocationId: 'tml_GRORFwWvvm8B3d' };
            }
          }
          return state;
        },
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
          printer:       s.printer,
          kiosk:         s.kiosk,
          localization:  s.localization,
        }),
        // Deep-merge nested settings objects so new fields added in a schema upgrade
        // always get their default values even when old persisted state is missing them.
        // Zustand's default merge is shallow — it replaces `payment` wholesale, so new
        // fields like stripePayKey / merchantId / storeId / envType would be undefined.
        merge: (persisted, current) => {
          const p = (persisted ?? {}) as Partial<SettingsState>;
          const pPrinter = (p.printer ?? {}) as any;
          const printerMerged = {
            ...current.printer,
            ...pPrinter,
          };

          // If old flat connection type exists, migrate to customer printer
          if (p.printer && !pPrinter.customer) {
            printerMerged.customer = {
              connectionType:        pPrinter.connectionType ?? 'none',
              defaultPrinterName:    pPrinter.defaultPrinterName ?? '',
              defaultPrinterAddress: pPrinter.defaultPrinterAddress ?? '',
              lanPrinterIp:          pPrinter.lanPrinterIp ?? '',
              lanPrinterModel:       pPrinter.lanPrinterModel ?? 'TSP143',
            };
          }

          // Ensure new boolean fields have defaults when missing from persisted state
          if (printerMerged.printCustomerReceipt === undefined)  printerMerged.printCustomerReceipt  = true;
          if (printerMerged.printKitchenReceipt === undefined)   printerMerged.printKitchenReceipt   = true;
          if (printerMerged.autoPrintAfterPayment === undefined) printerMerged.autoPrintAfterPayment = true;

          return {
            ...current,
            ...p,
            theme:        { ...current.theme,        ...(p.theme        ?? {}) },
            api:          { ...current.api,          ...(p.api          ?? {}) },
            payment:      { ...current.payment,      ...(p.payment      ?? {}) },
            printer:      printerMerged,
            kiosk:        { ...current.kiosk,        ...(p.kiosk        ?? {}) },
            localization: { ...current.localization, ...(p.localization ?? {}) },
          };
        },
      },
    ),
  ),
);
