// src/modules/settings/tabs/LocalizationTab.tsx
import { useSettingsStore } from '@/store/settingsStore';
import { SettingsField, SettingsSection, SettingsInput, SettingsSelect } from '../shared';

const US_TIMEZONES = [
  { label: 'Eastern  (UTC−5/−4)',  value: 'America/New_York' },
  { label: 'Central  (UTC−6/−5)',  value: 'America/Chicago' },
  { label: 'Mountain (UTC−7/−6)',  value: 'America/Denver' },
  { label: 'Arizona  (UTC−7)',     value: 'America/Phoenix' },
  { label: 'Pacific  (UTC−8/−7)', value: 'America/Los_Angeles' },
  { label: 'Alaska   (UTC−9/−8)', value: 'America/Anchorage' },
  { label: 'Hawaii   (UTC−10)',    value: 'Pacific/Honolulu' },
];

const DATE_FORMATS = [
  { label: 'MM/DD/YYYY (US)',       value: 'MM/DD/YYYY' },
  { label: 'DD/MM/YYYY (Intl)',     value: 'DD/MM/YYYY' },
  { label: 'YYYY-MM-DD (ISO 8601)', value: 'YYYY-MM-DD' },
];

export default function LocalizationTab() {
  const { localization, setLocalization } = useSettingsStore();

  return (
    <div className="p-5">
      <SettingsSection title="Language & Region">
        <SettingsField label="Language" htmlFor="lang-select">
          <SettingsSelect
            id="lang-select"
            value={localization.locale}
            onChange={(e) =>
              setLocalization({
                locale: (e.target as HTMLSelectElement).value as 'en-US' | 'es-US',
              })
            }
          >
            <option value="en-US">English (United States)</option>
            <option value="es-US">Español (Estados Unidos)</option>
          </SettingsSelect>
        </SettingsField>

        <SettingsField
          label="Currency"
          htmlFor="currency-input"
          description="ISO 4217 currency code. Currently display-only."
        >
          <SettingsInput
            id="currency-input"
            type="text"
            value={localization.currency}
            onChange={(e) =>
              setLocalization({ currency: (e.target as HTMLInputElement).value.trim().toUpperCase() })
            }
            placeholder="USD"
            maxLength={3}
            className="w-24 uppercase"
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection title="Date & Time">
        <SettingsField label="Timezone" htmlFor="tz-select">
          <SettingsSelect
            id="tz-select"
            value={localization.timezone}
            onChange={(e) =>
              setLocalization({ timezone: (e.target as HTMLSelectElement).value })
            }
          >
            {US_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </SettingsSelect>
        </SettingsField>

        <SettingsField label="Date Format" htmlFor="date-format-select">
          <SettingsSelect
            id="date-format-select"
            value={localization.dateFormat}
            onChange={(e) =>
              setLocalization({ dateFormat: (e.target as HTMLSelectElement).value })
            }
          >
            {DATE_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </SettingsSelect>
        </SettingsField>
      </SettingsSection>

      {/* Locale preview */}
      <SettingsSection title="Preview">
        <SettingsField label="Sample output">
          <div className="text-sm font-brand text-brand-text space-y-1">
            <p>
              <span className="text-brand-muted">Price: </span>
              {new Intl.NumberFormat(localization.locale, {
                style: 'currency',
                currency: localization.currency || 'USD',
              }).format(12.99)}
            </p>
            <p>
              <span className="text-brand-muted">Date: </span>
              {new Intl.DateTimeFormat(localization.locale, {
                timeZone: localization.timezone,
                dateStyle: 'full',
                timeStyle: 'short',
              }).format(new Date())}
            </p>
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
