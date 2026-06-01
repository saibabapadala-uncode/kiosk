// src/utils/format.ts

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(dollars: number): string {
  return usdFormatter.format(dollars);
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
