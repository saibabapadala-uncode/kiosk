import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useSettingsStore } from '@/store/settingsStore';
import { useBrand } from '@/hooks/useBrand';
import { useAuthStore } from '@/store/authStore';
import { useKioskChannelStore } from '@/store/kioskChannelStore';
import { useStoreConfigStore } from '@/store/storeConfigStore';
import { SettingsInput, SettingsSelect } from '../shared';
import LivePreviewCard from '../LivePreviewCard';
import { themeColors, themeRGBA } from '@/utils/themeColors';

function isValidHex(v: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(v);
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');

  return (
    <div className="rounded-xl px-3.5 py-3" style={{ background: themeColors.surfaceAlt, border: `1px solid ${themeColors.border}` }}>
      <p className="text-xs font-bold font-brand uppercase tracking-wide" style={{ color: themeColors.muted }}>{label}</p>
      <div className="flex items-center gap-3 mt-2">
        <input
          type="color"
          value={value}
          onChange={(e) => {
            setDraft((e.target as HTMLInputElement).value);
            setError('');
            onChange((e.target as HTMLInputElement).value);
          }}
          aria-label={`${label} color picker`}
          className="w-10 h-10 rounded-lg border border-brand-border bg-transparent cursor-pointer"
        />
        <SettingsInput
          type="text"
          value={draft}
          onChange={(e) => {
            const next = (e.target as HTMLInputElement).value;
            setDraft(next);
            if (!next) {
              setError('Enter a hex color');
              return;
            }
            if (!isValidHex(next)) {
              setError('Use format #RRGGBB');
              return;
            }
            setError('');
            onChange(next);
          }}
          maxLength={7}
          className="w-28 font-mono"
        />
      </div>
      {error && <p className="text-xs font-brand mt-1.5" style={{ color: themeColors.error }}>{error}</p>}
    </div>
  );
}

function FieldCard({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4.5 space-y-3" style={{ background: themeColors.surface, border: `1.5px solid ${themeColors.border}` }}>
      <div>
        <p className="text-sm font-bold font-brand" style={{ color: themeColors.text }}>{title}</p>
        <p className="text-xs font-brand mt-0.5 leading-relaxed" style={{ color: themeColors.muted }}>{hint}</p>
      </div>
      {children}
    </div>
  );
}

const FONTS = [
  { label: 'Inter (default)', value: "'Inter', system-ui, sans-serif" },
  { label: 'Poppins', value: "'Poppins', system-ui, sans-serif" },
  { label: 'Nunito', value: "'Nunito', system-ui, sans-serif" },
  { label: 'Roboto', value: "'Roboto', system-ui, sans-serif" },
  { label: 'System UI', value: 'system-ui, sans-serif' },
  { label: 'Georgia (serif)', value: 'Georgia, serif' },
];

const RADII = [
  { label: 'None (sharp)', value: '0px' },
  { label: 'Small (4px)', value: '0.25rem' },
  { label: 'Medium (8px)', value: '0.5rem' },
  { label: 'Large (12px)', value: '0.75rem' },
  { label: 'XL (16px)', value: '1rem' },
  { label: 'Pill', value: '9999px' },
];

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
    <div className="p-5 max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
      <div className="space-y-5">


        <FieldCard
          title="Current brand"
          hint="Brand can be changed only after signing out."
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex px-3 py-1.5 rounded-xl text-xs font-bold font-brand uppercase tracking-wide" style={{ color: 'var(--color-brand-primary)', background: themeRGBA('primary', 0.1), border: `1px solid ${themeRGBA('primary', 0.25)}` }}>
              {brandId}
            </span>
            <button
              type="button"
              onClick={handleSwitchBrand}
              onBlur={() => setConfirmSignOut(false)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold font-brand border active:scale-95 transition-all"
              style={{
                color: confirmSignOut ? '#fff' : themeColors.error,
                background: confirmSignOut ? themeColors.error : 'transparent',
                borderColor: themeColors.error,
              }}
            >
              {confirmSignOut ? 'Tap again to sign out' : 'Switch brand'}
            </button>
          </div>
        </FieldCard>

        <FieldCard
          title="Theme mode"
          hint="Choose how light and dark appearance is applied."
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            {(['light', 'dark', 'auto'] as const).map((mode) => {
              const active = themeMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setThemeMode(mode)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold font-brand capitalize border transition-all"
                  style={{
                    background: active ? 'var(--color-brand-primary)' : themeColors.surfaceAlt,
                    color: active ? '#fff' : themeColors.text,
                    borderColor: active ? 'var(--color-brand-primary)' : themeColors.border,
                  }}
                >
                  {mode === 'auto' ? 'Auto' : mode}
                </button>
              );
            })}
          </div>
        </FieldCard>

        <FieldCard
          title="Brand colors"
          hint="Update main interface colors."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([
              ['primary', 'Primary'],
              ['secondary', 'Secondary'],
              ['accent', 'Accent'],
              ['background', 'Background'],
              ['surface', 'Surface'],
              ['text', 'Text'],
              ['textMuted', 'Muted text'],
              ['border', 'Border'],
            ] as Array<[keyof typeof theme, string]>).map(([key, label]) => (
              <ColorInput key={key} label={label} value={theme[key] as string} onChange={(v) => setTheme({ [key]: v })} />
            ))}
          </div>
        </FieldCard>

        <FieldCard
          title="Font and shape"
          hint="Choose typeface and corner roundness."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <p className="text-xs font-bold font-brand uppercase tracking-wide mb-1.5" style={{ color: themeColors.muted }}>Font family</p>
              <SettingsSelect
                id="font-select"
                value={theme.fontFamily}
                onChange={(e) => setTheme({ fontFamily: (e.target as HTMLSelectElement).value })}
              >
                {FONTS.map((font) => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </SettingsSelect>
            </div>

            <div>
              <p className="text-xs font-bold font-brand uppercase tracking-wide mb-1.5" style={{ color: themeColors.muted }}>Corner style</p>
              <SettingsSelect
                id="radius-select"
                value={theme.radius}
                onChange={(e) => setTheme({ radius: (e.target as HTMLSelectElement).value })}
              >
                {RADII.map((radius) => (
                  <option key={radius.value} value={radius.value}>{radius.label}</option>
                ))}
              </SettingsSelect>
            </div>
          </div>
        </FieldCard>

        <FieldCard
          title="Logo"
          hint="Optional image shown on kiosk screens."
        >
          <SettingsInput
            id="logo-url"
            type="url"
            value={theme.logoUrl}
            onChange={(e) => setTheme({ logoUrl: (e.target as HTMLInputElement).value })}
            placeholder="https://cdn.example.com/logo.png"
          />
          {theme.logoUrl && (
            <div className="rounded-xl p-2 w-fit" style={{ background: themeColors.surfaceAlt, border: `1px solid ${themeColors.border}` }}>
              <img
                src={theme.logoUrl}
                alt="Logo preview"
                className="h-10 w-auto object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none'; }}
              />
            </div>
          )}
        </FieldCard>
      </div>

      <div className="xl:sticky xl:top-5 self-start">
        <div className="rounded-2xl p-4" style={{ background: themeColors.surface, border: `1.5px solid ${themeColors.border}` }}>
          <p className="text-xs font-bold font-brand uppercase tracking-wide mb-3" style={{ color: themeColors.muted }}>Live preview</p>
          <LivePreviewCard />
        </div>
      </div>
    </div>
  );
}
