// src/providers/BrandProvider.tsx
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getBrandEnvironment, isValidBrand } from '@/brands';
import type { BrandEnvironment, BrandId, BrandTheme } from '@/brands/types';
import { useSettingsStore, type ThemeMode } from '@/store/settingsStore';
import { useCartStore } from '@/store/cartStore';

import '@/brands/straunt/theme.css';
import '@/brands/holiq/theme.css';
import '@/brands/restro/theme.css';

// ─── Context ────────────────────────────────────────────────────────────────────

export interface BrandContextValue {
  brandId: BrandId;
  environment: BrandEnvironment;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  applyTheme: (partial: Partial<BrandTheme>) => void;
}

export const BrandContext = createContext<BrandContextValue | null>(null);

// ─── CSS var helpers ────────────────────────────────────────────────────────────

const THEME_VAR_MAP: Array<[keyof BrandTheme, string]> = [
  ['primary',    '--color-brand-primary'],
  ['secondary',  '--color-brand-secondary'],
  ['accent',     '--color-brand-accent'],
  ['background', '--color-brand-bg'],
  ['surface',    '--color-brand-surface'],
  ['text',       '--color-brand-text'],
  ['textMuted',  '--color-brand-muted'],
  ['border',     '--color-brand-border'],
  ['error',      '--color-brand-error'],
  ['success',    '--color-brand-success'],
  ['fontFamily', '--font-brand'],
  ['radius',     '--radius-brand'],
];

function applyThemeToRoot(theme: Partial<BrandTheme>): void {
  const root = document.documentElement;
  for (const [key, cssVar] of THEME_VAR_MAP) {
    const val = theme[key];
    if (val !== undefined && val !== '') root.style.setProperty(cssVar, val as string);
  }
}

function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'auto') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// ─── Provider ───────────────────────────────────────────────────────────────────

export function BrandProvider({ children }: { children: ReactNode }) {
  const rawBrand = import.meta.env.VITE_BRAND || 'straunt';
  const brandId: BrandId = isValidBrand(rawBrand) ? rawBrand : 'straunt';
  const environment = useMemo(() => getBrandEnvironment(brandId), [brandId]);

  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  // ── 1. On mount: set data-brand + apply environment defaults ──────────────────
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-brand', brandId);
    root.setAttribute('data-theme', 'light');
    applyThemeToRoot(environment.defaultTheme);
  }, [brandId, environment]);

  // ── 2. Subscribe to settingsStore theme — fires immediately after hydration ───
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe(
      (s) => s.theme,
      (theme) => {
        applyThemeToRoot(theme);
        const resolved = resolveThemeMode(theme.themeMode);
        document.documentElement.setAttribute('data-theme', resolved);
        setThemeModeState(theme.themeMode);
      },
      { fireImmediately: true },
    );
    return unsubscribe;
  }, []);

  // ── 3. Subscribe to highContrastMode → toggle .high-contrast on <html> ───────
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe(
      (s) => s.kiosk.highContrastMode,
      (enabled) => {
        document.documentElement.classList.toggle('high-contrast', enabled);
      },
      { fireImmediately: true },
    );
    return unsubscribe;
  }, []);

  // ── 4. Subscribe to settingsStore taxRate → keep cartStore in sync ────────────
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe(
      (s) => s.kiosk.taxRate,
      (rate) => useCartStore.getState().setTaxRate(rate),
      { fireImmediately: true },
    );
    return unsubscribe;
  }, []);

  // ── 4. Auto theme: listen to OS preference changes ────────────────────────────
  useEffect(() => {
    if (themeMode !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    document.documentElement.setAttribute('data-theme', resolveThemeMode(mode));
    useSettingsStore.getState().setTheme({ themeMode: mode });
  }, []);

  const value = useMemo<BrandContextValue>(
    () => ({ brandId, environment, themeMode, setThemeMode, applyTheme: applyThemeToRoot }),
    [brandId, environment, themeMode, setThemeMode],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}
