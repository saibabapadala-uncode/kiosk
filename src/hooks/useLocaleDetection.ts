// src/hooks/useLocaleDetection.ts
// Auto-detects the device / browser locale on first launch and applies it to
// the settings store.  On subsequent launches the persisted preference is used
// unchanged.  Runs exactly once per "fresh install" (no persisted settings key).

import { useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import { useSettingsStore } from '@/store/settingsStore';
import type { SupportedLocale } from '@/store/settingsStore';

const SETTINGS_KEY = 'ajr-kiosk-settings';

/**
 * Maps a BCP-47 language tag (e.g. "en-US", "fr-FR", "hi-IN") to the nearest
 * SupportedLocale.  Returns 'en-US' for anything that has no match.
 */
export function mapNavigatorLocale(navLocale: string): SupportedLocale {
  const lower = navLocale.toLowerCase();
  if (lower.startsWith('ar')) return 'ar';
  if (lower.startsWith('ja')) return 'ja';
  if (lower.startsWith('fr')) return 'fr';
  if (lower.startsWith('de')) return 'de';
  if (lower.startsWith('hi')) return 'hi';
  if (lower.startsWith('ta')) return 'ta';
  if (lower.startsWith('te')) return 'te';
  if (lower.startsWith('kn')) return 'kn';
  if (lower.startsWith('ml')) return 'ml';
  if (lower.startsWith('bn') || lower.startsWith('be')) return 'bn';
  if (lower.startsWith('es')) return 'es-US';
  return 'en-US';
}

/**
 * Maps a two-letter country code (from location APIs / Intl) to a default
 * SupportedLocale.  Supplements navigator language detection with geography.
 */
export function mapCountryToLocale(countryCode: string): SupportedLocale | null {
  const upper = countryCode.toUpperCase();
  switch (upper) {
    case 'US': case 'CA': case 'GB': case 'AU': case 'NZ': return 'en-US';
    case 'ES': case 'MX': case 'AR': case 'CO': case 'PE':
    case 'CL': case 'VE': case 'EC': return 'es-US';
    case 'FR': case 'BE': case 'CH': case 'LU': case 'MC': return 'fr';
    case 'DE': case 'AT': return 'de';
    case 'JP': return 'ja';
    case 'IN': return null; // Let device language decide for India
    case 'SA': case 'AE': case 'EG': case 'QA': case 'KW':
    case 'BH': case 'OM': case 'JO': case 'IQ': case 'SY': return 'ar';
    case 'BD': return 'bn';
    default: return null; // Fall back to navigator language
  }
}

/**
 * On first launch (no persisted settings), reads navigator.languages and
 * applies the best-matching SupportedLocale to the settings store.
 * Also attempts Intl.Locale timezone-based region detection as a supplement.
 * On subsequent launches the stored locale is used as-is.
 */
export function useLocaleDetection() {
  const setLocalization = useSettingsStore((s) => s.setLocalization);

  useEffect(() => {
    async function run() {
      // Check if the user already has persisted settings — if so, respect them.
      try {
        const { value } = await Preferences.get({ key: SETTINGS_KEY });
        if (value !== null) return;
      } catch {
        // Capacitor not available (web/desktop dev) — fall through to detection.
      }

      // --- Step 1: try country-based detection via Intl.Locale (most accurate) ---
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // Derive a rough region from timezone (e.g. "America/New_York" → "US")
        const region = tz.split('/')[0];
        const tzToCountry: Record<string, string> = {
          America: 'US', Europe: 'DE', Asia: 'IN', Pacific: 'AU', Africa: 'ZA',
        };
        const guessedCountry = tzToCountry[region];
        if (guessedCountry) {
          const fromCountry = mapCountryToLocale(guessedCountry);
          // Country hint alone is too coarse — only use if device language aligns
          const navLocale = navigator.languages?.[0] ?? navigator.language ?? '';
          const fromNav = mapNavigatorLocale(navLocale);
          // Prefer device language; use country hint only when both agree on region
          if (fromNav !== 'en-US' || fromCountry === 'en-US') {
            setLocalization({ locale: fromNav });
            return;
          }
          if (fromCountry) {
            setLocalization({ locale: fromCountry });
            return;
          }
        }
      } catch {
        // Intl not supported — fall through
      }

      // --- Step 2: navigator.languages (standard BCP-47 preference list) ---
      const candidates: readonly string[] = navigator.languages?.length
        ? navigator.languages
        : [navigator.language ?? 'en-US'];

      for (const lang of candidates) {
        const mapped = mapNavigatorLocale(lang);
        if (mapped !== 'en-US') {
          setLocalization({ locale: mapped });
          return;
        }
        // Explicit "en-*" match — user really wants English, stop here
        if (lang.toLowerCase().startsWith('en')) {
          setLocalization({ locale: 'en-US' });
          return;
        }
      }
      // Fallback: nothing matched — stay on the brand's default (en-US)
    }

    void run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
