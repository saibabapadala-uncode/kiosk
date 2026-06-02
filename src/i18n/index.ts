// src/i18n/index.ts
// i18next configuration — supports 9 locales including RTL (Arabic).
// Language is kept in sync with settingsStore.localization.locale.

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './en-US.json';
import esUS from './es-US.json';
import hi   from './hi.json';
import ta   from './ta.json';
import te   from './te.json';
import kn   from './kn.json';
import ml   from './ml.json';
import bn   from './bn.json';
import ar   from './ar.json';
import { useSettingsStore, RTL_LOCALES } from '@/store/settingsStore';
import type { SupportedLocale } from '@/store/settingsStore';

i18next.use(initReactI18next).init({
  resources: {
    'en-US': { translation: enUS },
    'es-US': { translation: esUS },
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

/** Apply RTL/LTR direction to the document root whenever the locale changes. */
function applyDirection(locale: SupportedLocale) {
  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', locale);
}

// Keep i18next language in sync with the settings store locale.
useSettingsStore.subscribe(
  (s) => s.localization.locale,
  (locale) => {
    void i18next.changeLanguage(locale);
    applyDirection(locale);
  },
  { fireImmediately: true },
);

export default i18next;
