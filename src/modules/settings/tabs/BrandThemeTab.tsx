// src/modules/settings/tabs/BrandThemeTab.tsx
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useSettingsStore } from '@/store/settingsStore';
import { useBrand } from '@/hooks/useBrand';
import { useAuthStore } from '@/store/authStore';
import { useKioskChannelStore } from '@/store/kioskChannelStore';
import { useStoreConfigStore } from '@/store/storeConfigStore';
import { SettingsField, SettingsSection, SettingsInput, SettingsSelect } from '../shared';
import LivePreviewCard from '../LivePreviewCard';
import { themeColors, themeRGBA } from '@/utils/themeColors';

// ─── Color field (swatch + hex input) ─────────────────────────────────────────

function isValidHex(v: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(v);
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (c: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const [err, setErr] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => { setLocal(value); setErr(false); }, [value]);

  function handleText(v: string) {
    setLocal(v);
    if (isValidHex(v)) { setErr(false); onChange(v); }
    else setErr(true);
  }

  return (
    <div className="flex items-center gap-3 w-full max-w-md">
      {/* Native color picker swatch */}
      <div className="relative flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-brand-border">
        <input
          type="color"
          value={value}
          onChange={(e) => { setLocal(e.target.value); onChange(e.target.value); }}
          aria-label={`${label} color picker`}
          className="absolute inset-0 w-full h-full cursor-pointer p-0 border-0 bg-transparent"
          style={{ transform: 'scale(1.4)', outline: 'none' }}
        />
      </div>
      {/* Hex text input */}
      <input
        type="text"
        value={local}
        onChange={(e) => handleText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={7}
        aria-label={`${label} hex value`}
        className={[
          'w-24 px-3 py-2 rounded-xl border font-mono text-sm font-brand focus:outline-none transition-all duration-200',
          err ? 'border-brand-error' : '',
        ].join(' ')}
        style={{
          background: themeColors.input,
          borderColor: err ? themeColors.error : focused ? 'var(--color-brand-primary)' : themeColors.border,
          color: themeColors.inputText,
          boxShadow: err
            ? '0 0 0 3px rgba(239, 68, 68, 0.15)'
            : focused
              ? '0 0 0 3px rgba(var(--color-brand-primary-rgb), 0.18)'
              : 'none',
        }}
      />
      <span className="text-sm font-bold font-brand text-brand-muted">{label}</span>
    </div>
  );
}

// ─── Font family options ───────────────────────────────────────────────────────

const FONTS = [
  { label: 'Inter (default)', value: "'Inter', system-ui, sans-serif" },
  { label: 'Poppins', value: "'Poppins', system-ui, sans-serif" },
  { label: 'Nunito', value: "'Nunito', system-ui, sans-serif" },
  { label: 'Roboto', value: "'Roboto', system-ui, sans-serif" },
  { label: 'System UI', value: 'system-ui, sans-serif' },
  { label: 'Georgia (serif)', value: "Georgia, serif" },
];

const RADII = [
  { label: 'None (sharp)', value: '0px' },
  { label: 'Small (4px)', value: '0.25rem' },
  { label: 'Medium (8px)', value: '0.5rem' },
  { label: 'Large (12px)', value: '0.75rem' },
  { label: 'XL (16px)', value: '1rem' },
  { label: 'Pill (9999px)', value: '9999px' },
];

// ─── Tab ──────────────────────────────────────────────────────────────────────

export default function BrandThemeTab() {
  const { theme, setTheme } = useSettingsStore();
  const { setThemeMode, themeMode, brandId } = useBrand();
  const history = useHistory();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  function handleSwitchBrand() {
    if (!confirmSignOut) {
      setConfirmSignOut(true);
      return;
    }
    useAuthStore.getState().logout();
    useKioskChannelStore.getState().clear();
    useStoreConfigStore.getState().clear();
    history.replace('/brand-select');
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-5 max-w-7xl mx-auto">
      {/* ── Form ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0">

        {/* Active Brand */}
        <SettingsSection title="Active Brand">
          <SettingsField
            label="Current Brand"
            description="Brand is locked after login. To switch brands, you must sign out."
          >
            <div className="flex flex-col gap-3">
              {/* Brand badge */}
              <span
                className="inline-flex items-center px-4 py-1.5 rounded-xl border font-bold font-brand text-xs w-fit tracking-wide uppercase"
                style={{
                  borderColor: 'var(--color-brand-primary)',
                  background: themeRGBA('primary', 0.12),
                  color: 'var(--color-brand-primary)',
                }}
              >
                {brandId}
              </span>

              {/* Switch brand button */}
              <button
                onClick={handleSwitchBrand}
                onBlur={() => setConfirmSignOut(false)}
                className="
                  inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold font-brand transition-all active:scale-95 w-fit
                "
                style={confirmSignOut ? {
                  background: themeColors.error,
                  borderColor: themeColors.error,
                  color: '#FFFFFF',
                  boxShadow: '0 2px 10px rgba(239, 68, 68, 0.35)',
                } : {
                  background: 'transparent',
                  borderColor: themeColors.error,
                  color: themeColors.error,
                }}
                onMouseEnter={(e) => {
                  if (!confirmSignOut) {
                    (e.currentTarget as HTMLButtonElement).style.background = themeRGBA('error', 0.08);
                  }
                }}
                onMouseLeave={(e) => {
                  if (!confirmSignOut) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }
                }}
              >
                {confirmSignOut
                  ? 'Are you sure? This will sign you out.'
                  : 'Switch Brand (Sign Out)'}
              </button>
            </div>
          </SettingsField>
        </SettingsSection>

        {/* Colors */}
        <SettingsSection title="Colors">
          {(
            [
              ['primary',    'Primary'],
              ['secondary',  'Secondary'],
              ['accent',     'Accent'],
              ['background', 'Background'],
              ['surface',    'Surface'],
              ['text',       'Text'],
              ['textMuted',  'Text Muted'],
              ['border',     'Border'],
            ] as Array<[keyof typeof theme, string]>
          ).map(([key, label]) => (
            <SettingsField key={key} label={label}>
              <ColorField
                label={label}
                value={theme[key] as string}
                onChange={(v) => setTheme({ [key]: v })}
              />
            </SettingsField>
          ))}
        </SettingsSection>

        {/* Typography & shape */}
        <SettingsSection title="Typography & Shape">
          <SettingsField label="Font Family" htmlFor="font-select">
            <SettingsSelect
              id="font-select"
              value={theme.fontFamily}
              onChange={(e) => setTheme({ fontFamily: (e.target as HTMLSelectElement).value })}
            >
              {FONTS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </SettingsSelect>
          </SettingsField>

          <SettingsField label="Border Radius" htmlFor="radius-select">
            <SettingsSelect
              id="radius-select"
              value={theme.radius}
              onChange={(e) => setTheme({ radius: (e.target as HTMLSelectElement).value })}
            >
              {RADII.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </SettingsSelect>
          </SettingsField>
        </SettingsSection>

        {/* Logo */}
        <SettingsSection title="Logo">
          <SettingsField
            label="Logo URL"
            htmlFor="logo-url"
            description="Direct link to a PNG/SVG. Leave blank to show brand initial."
          >
            <div className="flex flex-col gap-3 w-full max-w-md">
              <SettingsInput
                id="logo-url"
                type="url"
                value={theme.logoUrl}
                onChange={(e) => setTheme({ logoUrl: (e.target as HTMLInputElement).value })}
                placeholder="https://cdn.example.com/logo.png"
              />
              {theme.logoUrl && (
                <div className="relative w-fit rounded-xl border border-brand-border bg-brand-surface p-2 shadow-inner">
                  <img
                    src={theme.logoUrl}
                    alt="Logo preview"
                    className="h-10 w-auto object-contain"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          </SettingsField>
        </SettingsSection>

        {/* Theme mode */}
        <SettingsSection title="Theme Mode">
          <SettingsField label="Appearance">
            <div
              className="flex gap-2.5"
              role="radiogroup"
              aria-label="Theme appearance mode"
            >
              {(['light', 'dark', 'auto'] as const).map((mode) => {
                const isActive = themeMode === mode;
                return (
                  <button
                    key={mode}
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setThemeMode(mode)}
                    className="px-4.5 py-2.5 rounded-xl border text-xs font-bold font-brand capitalize transition-all active:scale-95"
                    style={isActive ? {
                      background: 'var(--color-brand-primary)',
                      borderColor: 'var(--color-brand-primary)',
                      color: 'var(--color-brand-text-inverse)',
                      boxShadow: '0 4px 12px rgba(var(--color-brand-primary-rgb), 0.3)',
                    } : {
                      background: themeColors.surfaceAlt,
                      borderColor: themeColors.border,
                      color: themeColors.text,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-brand-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = themeColors.border;
                      }
                    }}
                  >
                    {mode === 'auto' ? 'Auto (OS)' : mode}
                  </button>
                );
              })}
            </div>
          </SettingsField>
        </SettingsSection>
      </div>

      {/* ── Live preview ─────────────────────────────── */}
      <div className="lg:w-80 lg:sticky lg:top-6 lg:self-start flex-shrink-0">
        <p className="text-[10px] font-bold font-brand text-brand-muted uppercase tracking-[0.2em] mb-3 pl-1">
          Live Preview
        </p>
        <div className="p-3.5 rounded-2xl border bg-brand-surface shadow-md" style={{ borderColor: themeColors.border }}>
          <LivePreviewCard />
        </div>
        <p className="text-xs text-brand-muted font-brand mt-3 text-center font-medium">
          Updates in real-time as you change settings
        </p>
      </div>
    </div>
  );
}
