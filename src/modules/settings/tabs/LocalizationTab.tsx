// src/modules/settings/tabs/LocalizationTab.tsx
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/store/settingsStore';
import { SUPPORTED_LANGUAGES } from '@/components/LanguageSelector';
import { SettingsField, SettingsSection, SettingsInput, SettingsSelect } from '../shared';
import { formatDateTime, formatPrice } from '@/utils/format';

// ─── Timezone catalogue (global) ──────────────────────────────────────────────

const TIMEZONES = [
  // Americas
  { label: 'Eastern (UTC−5/−4)',          value: 'America/New_York' },
  { label: 'Central (UTC−6/−5)',           value: 'America/Chicago' },
  { label: 'Mountain (UTC−7/−6)',          value: 'America/Denver' },
  { label: 'Arizona (UTC−7)',              value: 'America/Phoenix' },
  { label: 'Pacific (UTC−8/−7)',           value: 'America/Los_Angeles' },
  { label: 'Alaska (UTC−9/−8)',            value: 'America/Anchorage' },
  { label: 'Hawaii (UTC−10)',              value: 'Pacific/Honolulu' },
  { label: 'Mexico City (UTC−6/−5)',       value: 'America/Mexico_City' },
  { label: 'São Paulo (UTC−3)',            value: 'America/Sao_Paulo' },
  { label: 'Buenos Aires (UTC−3)',         value: 'America/Argentina/Buenos_Aires' },
  // Europe
  { label: 'London (UTC+0/+1)',            value: 'Europe/London' },
  { label: 'Paris (UTC+1/+2)',             value: 'Europe/Paris' },
  { label: 'Berlin (UTC+1/+2)',            value: 'Europe/Berlin' },
  { label: 'Madrid (UTC+1/+2)',            value: 'Europe/Madrid' },
  { label: 'Rome (UTC+1/+2)',              value: 'Europe/Rome' },
  { label: 'Moscow (UTC+3)',               value: 'Europe/Moscow' },
  // Middle East & Africa
  { label: 'Dubai (UTC+4)',                value: 'Asia/Dubai' },
  { label: 'Riyadh (UTC+3)',               value: 'Asia/Riyadh' },
  { label: 'Cairo (UTC+2/+3)',             value: 'Africa/Cairo' },
  { label: 'Johannesburg (UTC+2)',         value: 'Africa/Johannesburg' },
  { label: 'Lagos (UTC+1)',                value: 'Africa/Lagos' },
  // Asia
  { label: 'Kolkata / Mumbai (UTC+5:30)',  value: 'Asia/Kolkata' },
  { label: 'Dhaka (UTC+6)',                value: 'Asia/Dhaka' },
  { label: 'Bangkok (UTC+7)',              value: 'Asia/Bangkok' },
  { label: 'Singapore (UTC+8)',            value: 'Asia/Singapore' },
  { label: 'Shanghai / Beijing (UTC+8)',   value: 'Asia/Shanghai' },
  { label: 'Tokyo (UTC+9)',                value: 'Asia/Tokyo' },
  { label: 'Seoul (UTC+9)',                value: 'Asia/Seoul' },
  // Pacific
  { label: 'Sydney (UTC+10/+11)',          value: 'Australia/Sydney' },
  { label: 'Auckland (UTC+12/+13)',        value: 'Pacific/Auckland' },
];

const DATE_FORMATS = [
  { label: 'MM/DD/YYYY (US)',       value: 'MM/DD/YYYY' },
  { label: 'DD/MM/YYYY (Intl)',     value: 'DD/MM/YYYY' },
  { label: 'YYYY-MM-DD (ISO 8601)', value: 'YYYY-MM-DD' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function LocalizationTab() {
  const { t }  = useTranslation();
  const { localization, setLocalization } = useSettingsStore();

  const sampleDate = new Date();

  return (
    <div className="p-5">

      {/* Language & Region */}
      <SettingsSection title={t('localization.langRegion')}>
        <SettingsField label={t('localization.language')} htmlFor="lang-select">
          <SettingsSelect
            id="lang-select"
            value={localization.locale}
            onChange={(e) =>
              setLocalization({ locale: (e.target as HTMLSelectElement).value as typeof localization.locale })
            }
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.nativeName} ({lang.abbr})
              </option>
            ))}
          </SettingsSelect>
        </SettingsField>

        <SettingsField
          label={t('localization.currency')}
          htmlFor="currency-input"
          description={t('localization.currencyDesc')}
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

      {/* Date & Time */}
      <SettingsSection title={t('localization.dateTime')}>
        <SettingsField label={t('localization.timezone')} htmlFor="tz-select">
          <SettingsSelect
            id="tz-select"
            value={localization.timezone}
            onChange={(e) =>
              setLocalization({ timezone: (e.target as HTMLSelectElement).value })
            }
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </SettingsSelect>
        </SettingsField>

        <SettingsField label={t('localization.dateFormat')} htmlFor="date-format-select">
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

      {/* Live preview */}
      <SettingsSection title={t('localization.preview')}>
        <SettingsField label={t('localization.sampleOutput')}>
          <div className="text-sm font-brand text-brand-text space-y-1.5">
            <p>
              <span className="text-brand-muted">{t('localization.priceLabel')}: </span>
              <span className="font-semibold">
                {(() => {
                  try {
                    return new Intl.NumberFormat(localization.locale, {
                      style: 'currency',
                      currency: localization.currency || 'USD',
                    }).format(12.99);
                  } catch {
                    return formatPrice(12.99);
                  }
                })()}
              </span>
            </p>
            <p>
              <span className="text-brand-muted">{t('localization.dateLabel')}: </span>
              <span className="font-semibold">
                {(() => {
                  try {
                    return formatDateTime(sampleDate, localization.timezone, localization.locale);
                  } catch {
                    return sampleDate.toLocaleString();
                  }
                })()}
              </span>
            </p>
            <p>
              <span className="text-brand-muted">RTL: </span>
              <span className="font-semibold">
                {['ar'].includes(localization.locale) ? '← Right-to-Left active' : 'Left-to-Right (LTR)'}
              </span>
            </p>
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
