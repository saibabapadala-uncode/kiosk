// src/i18n/index.ts
// i18next configuration — supports 12 locales including RTL (Arabic).
// Language is kept in sync with settingsStore.localization.locale.
// Currency changes also update the global price formatter in format.ts.

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './en-US.json';
import esUS from './es-US.json';
import fr   from './fr.json';
import de   from './de.json';
import ja   from './ja.json';
import hi   from './hi.json';
import ta   from './ta.json';
import te   from './te.json';
import kn   from './kn.json';
import ml   from './ml.json';
import bn   from './bn.json';
import ar   from './ar.json';
import { useSettingsStore, RTL_LOCALES } from '@/store/settingsStore';
import type { SupportedLocale } from '@/store/settingsStore';
import { setFormatLocale } from '@/utils/format';

i18next.use(initReactI18next).init({
  resources: {
    'en-US': { translation: enUS },
    'es-US': { translation: esUS },
    fr:      { translation: fr  },
    de:      { translation: de  },
    ja:      { translation: ja  },
    hi:      { translation: hi  },
    ta:      { translation: ta  },
    te:      { translation: te  },
    kn:      { translation: kn  },
    ml:      { translation: ml  },
    bn:      { translation: bn  },
    ar:      { translation: ar  },
  },
  lng:             'en-US',
  fallbackLng:     'en-US',
  interpolation:   { escapeValue: false },
  pluralSeparator: '_',
});

/** Apply RTL/LTR direction + lang attribute to the document root. */
function applyDirection(locale: SupportedLocale) {
  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', locale);
}

// Keep i18next, direction attribute, and price formatter all in sync
// whenever the settings locale or currency changes.
useSettingsStore.subscribe(
  (s) => s.localization,
  ({ locale, currency }) => {
    void i18next.changeLanguage(locale);
    applyDirection(locale);
    setFormatLocale(locale, currency || 'USD');
  },
  { fireImmediately: true },
);

export default i18next;
