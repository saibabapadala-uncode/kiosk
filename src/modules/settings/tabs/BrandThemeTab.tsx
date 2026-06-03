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

  useEffect(() => { setLocal(value); setErr(false); }, [value]);

  function handleText(v: string) {
    setLocal(v);
    if (isValidHex(v)) { setErr(false); onChange(v); }
    else setErr(true);
  }

  return (
    <div className="flex items-center gap-2">
      {/* Native color picker swatch */}
      <input
        type="color"
        value={value}
        onChange={(e) => { setLocal(e.target.value); onChange(e.target.value); }}
        aria-label={`${label} color picker`}
        className="w-10 h-10 rounded cursor-pointer border border-brand-border bg-transparent p-0"
        style={{ padding: 0 }}
      />
      {/* Hex text input */}
      <input
        type="text"
        value={local}
        onChange={(e) => handleText(e.target.value)}
        maxLength={7}
        aria-label={`${label} hex value`}
        className={[
          'w-24 px-2 py-1.5 rounded border font-mono text-sm font-brand text-brand-text bg-brand-bg',
          'focus:outline-none',
          err ? 'border-brand-error' : 'border-brand-border focus:border-brand-primary',
        ].join(' ')}
      />
      <span className="text-sm font-brand text-brand-muted">{label}</span>
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
    <div className="flex flex-col lg:flex-row gap-6 p-5">
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
                className="inline-flex items-center px-3 py-1 rounded-brand border border-brand-primary bg-brand-surface text-brand-primary text-sm font-semibold font-brand w-fit"
              >
                {brandId.charAt(0).toUpperCase() + brandId.slice(1)}
              </span>

              {/* Switch brand button */}
              <button
                onClick={handleSwitchBrand}
                onBlur={() => setConfirmSignOut(false)}
                className={[
                  'inline-flex items-center gap-2 px-4 py-2 rounded-brand border text-sm font-semibold font-brand transition-colors w-fit',
                  'focus-visible:outline focus-visible:outline-2',
                  confirmSignOut
                    ? 'border-red-600 bg-red-600 text-white focus-visible:outline-red-600'
                    : 'border-red-500 text-red-500 hover:bg-red-50 focus-visible:outline-red-500',
                ].join(' ')}
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
            <div className="flex flex-col gap-2 w-full">
              <SettingsInput
                id="logo-url"
                type="url"
                value={theme.logoUrl}
                onChange={(e) => setTheme({ logoUrl: (e.target as HTMLInputElement).value })}
                placeholder="https://cdn.example.com/logo.png"
              />
              {theme.logoUrl && (
                <img
                  src={theme.logoUrl}
                  alt="Logo preview"
                  className="h-12 w-auto object-contain rounded border border-brand-border bg-brand-surface p-1"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              )}
            </div>
          </SettingsField>
        </SettingsSection>

        {/* Theme mode */}
        <SettingsSection title="Theme Mode">
          <SettingsField label="Appearance">
            <div
              className="flex gap-2"
              role="radiogroup"
              aria-label="Theme appearance mode"
            >
              {(['light', 'dark', 'auto'] as const).map((mode) => (
                <button
                  key={mode}
                  role="radio"
                  aria-checked={themeMode === mode}
                  onClick={() => setThemeMode(mode)}
                  className={[
                    'px-4 py-2 rounded-brand border text-sm font-semibold font-brand capitalize',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary',
                    themeMode === mode
                      ? 'border-brand-primary bg-brand-primary text-white'
                      : 'border-brand-border text-brand-text hover:border-brand-primary',
                  ].join(' ')}
                >
                  {mode === 'auto' ? 'Auto (OS)' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </SettingsField>
        </SettingsSection>
      </div>

      {/* ── Live preview ─────────────────────────────── */}
      <div className="lg:w-72 lg:sticky lg:top-4 lg:self-start">
        <p className="text-xs font-bold font-brand text-brand-muted uppercase tracking-widest mb-3">
          Live Preview
        </p>
        <LivePreviewCard />
        <p className="text-xs text-brand-muted font-brand mt-2 text-center">
          Updates in real-time as you change settings
        </p>
      </div>
    </div>
  );
}
