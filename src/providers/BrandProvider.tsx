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
import { applyThemeInstantly, resolveThemeMode } from '@/utils/themeUtils';

// Load all brand CSS files upfront — the active data-brand attribute on <html>
// determines which set of CSS variables applies at runtime.
import '@/brands/straunt/theme.css';
import '@/brands/holiq/theme.css';
import '@/brands/restro/theme.css';

// ─── Context ────────────────────────────────────────────────────────────────────

export interface BrandContextValue {
  brandId: BrandId;
  environment: BrandEnvironment;
  themeMode: ThemeMode;
  isResolved: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  applyTheme: (partial: Partial<BrandTheme>, mode: 'light' | 'dark') => void;
  /** Trigger a brand switch (e.g. from staff settings screen). */
  setBrand: (id: BrandId) => void;
}

export const BrandContext = createContext<BrandContextValue | null>(null);

// ─── CSS var helpers ────────────────────────────────────────────────────────────

const THEME_VAR_MAP: Array<[keyof BrandTheme, string]> = [
  // ── Core palette ────────────────────────────────────────────────────
  ['primary',       '--color-brand-primary'],
  ['secondary',     '--color-brand-secondary'],
  ['accent',        '--color-brand-accent'],
  ['background',    '--color-brand-bg'],
  ['surface',       '--color-brand-surface'],
  ['text',          '--color-brand-text'],
  ['textMuted',     '--color-brand-muted'],
  ['border',        '--color-brand-border'],
  ['error',         '--color-brand-error'],
  ['success',       '--color-brand-success'],
  ['fontFamily',    '--font-brand'],
  ['radius',        '--radius-brand'],
  // ── Extended tokens (Phase 2) ────────────────────────────────────
  ['warning',       '--color-brand-warning'],
  ['primaryHover',  '--color-brand-primary-hover'],
  ['primaryActive', '--color-brand-primary-active'],
  ['gradientStart', '--color-brand-gradient-start'],
  ['gradientEnd',   '--color-brand-gradient-end'],
  ['textInverse',   '--color-brand-text-inverse'],
  ['surfaceAlt',    '--color-brand-surface-alt'],
  ['badgeBg',       '--color-brand-badge-bg'],
];

export function applyThemeToRoot(theme: Partial<BrandTheme>, mode: 'light' | 'dark'): void {
  const root = document.documentElement;
  const darkExclude = [
    '--color-brand-bg',
    '--color-brand-surface',
    '--color-brand-surface-alt',
    '--color-brand-text',
    '--color-brand-muted',
    '--color-brand-border',
    '--color-brand-badge-bg',
    '--color-brand-error',
    '--color-brand-success',
    '--color-brand-warning',
  ];

  for (const [key, cssVar] of THEME_VAR_MAP) {
    if (mode === 'dark' && darkExclude.includes(cssVar)) {
      root.style.removeProperty(cssVar);
      continue;
    }
    const val = theme[key];
    if (val !== undefined && val !== '') {
      root.style.setProperty(cssVar, val as string);
    }
  }
}


// ─── Provider ───────────────────────────────────────────────────────────────────

export function BrandProvider({ children }: { children: ReactNode }) {
  const storedBrandId   = useSettingsStore(s => s.brandId);
  const applyBrandEnv   = useSettingsStore(s => s.applyBrandEnvironment);

  const brandId = (storedBrandId && isValidBrand(storedBrandId)) ? storedBrandId as BrandId : ((import.meta.env.VITE_BRAND && isValidBrand(import.meta.env.VITE_BRAND as string)) ? import.meta.env.VITE_BRAND as BrandId : 'straunt');
  const isResolved = Boolean(storedBrandId && isValidBrand(storedBrandId));

  const environment = useMemo(() => getBrandEnvironment(brandId), [brandId]);

  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  // ── 1. Apply data-brand + CSS vars whenever active brand changes ──────────────
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-brand', brandId);
    const savedMode = useSettingsStore.getState().theme.themeMode;
    const resolved = resolveThemeMode(savedMode);
    applyThemeToRoot(environment.defaultTheme, resolved);
    applyThemeInstantly(resolved);
  }, [brandId, environment]);

  // ── 2. Subscribe to settingsStore theme overrides ─────────────────────────────
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe(
      (s) => s.theme,
      (theme) => {
        const resolved = resolveThemeMode(theme.themeMode);
        applyThemeToRoot(theme, resolved);
        applyThemeInstantly(resolved);
        setThemeModeState(theme.themeMode);
      },
      { fireImmediately: true },
    );
    return unsubscribe;
  }, []);

  // ── 3. High contrast mode ─────────────────────────────────────────────────────
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

  // ── 4. Sync taxRate → cartStore ────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe(
      (s) => s.kiosk.taxRate,
      (rate) => useCartStore.getState().setTaxRate(rate),
      { fireImmediately: true },
    );
    return unsubscribe;
  }, []);

  // ── 5. Auto theme: OS dark-mode preference ────────────────────────────────────
  useEffect(() => {
    if (themeMode !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      applyThemeInstantly(mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [themeMode]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    const resolvedTheme = resolveThemeMode(mode);
    applyThemeInstantly(resolvedTheme);
    useSettingsStore.getState().setTheme({ themeMode: mode });
  }, []);

  const setBrand = useCallback((id: BrandId) => {
    const env = getBrandEnvironment(id);
    applyBrandEnv(env);
  }, [applyBrandEnv]);

  const value = useMemo<BrandContextValue>(
    () => ({ brandId, environment, themeMode, isResolved, setThemeMode, applyTheme: applyThemeToRoot, setBrand }),
    [brandId, environment, themeMode, isResolved, setThemeMode, setBrand],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}
