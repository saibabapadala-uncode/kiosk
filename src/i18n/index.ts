// src/i18n/index.ts
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUS from './en-US.json';
import esUS from './es-US.json';
import { useSettingsStore } from '@/store/settingsStore';

i18next.use(initReactI18next).init({
  resources: {
    'en-US': { translation: enUS },
    'es-US': { translation: esUS },
  },
  lng: 'en-US',
  fallbackLng: 'en-US',
  interpolation: {
    escapeValue: false, // React handles XSS escaping
  },
  // Plural suffix for i18next v23+
  pluralSeparator: '_',
});

// Keep i18next language in sync with the settings store locale.
// Fires immediately so the initial stored locale is applied on startup.
useSettingsStore.subscribe(
  (s) => s.localization.locale,
  (locale) => void i18next.changeLanguage(locale),
  { fireImmediately: true },
);

export default i18next;
