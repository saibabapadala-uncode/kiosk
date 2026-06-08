// src/utils/format.ts
// Locale-aware number / price / date formatters.
// Call setFormatLocale() from i18n/index.ts whenever the active locale changes
// so that formatPrice() always reflects the user's selected language + currency.

let _locale = 'en-US';
let _currency = 'USD';
let _priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Called from i18n/index.ts on every locale / currency change. */
export function setFormatLocale(locale: string, currency: string): void {
  const safeCurrency = currency || 'USD';
  if (locale === _locale && safeCurrency === _currency) return;
  _locale = locale;
  _currency = safeCurrency;
  _priceFormatter = new Intl.NumberFormat(_locale, {
    style: 'currency',
    currency: _currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a monetary amount using the currently active locale + currency. */
export function formatPrice(dollars: number): string {
  return _priceFormatter.format(dollars);
}

/**
 * Format a Date as a locale-aware medium date + short time string.
 * Falls back to the active locale when none is provided.
 */
export function formatDateTime(
  date: Date,
  timezone: string,
  locale = _locale,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * Format a Date as a locale-aware date-only string.
 */
export function formatDate(
  date: Date,
  timezone: string,
  locale = _locale,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle: 'full',
  }).format(date);
}

/** Format a tax / discount rate as a percentage string. */
export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
