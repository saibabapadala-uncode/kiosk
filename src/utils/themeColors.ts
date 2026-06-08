/**
 * Theme Color System
 *
 * Centralized color palette that automatically adapts to light/dark mode.
 * All colors use CSS variables that change based on [data-theme] attribute.
 *
 * Usage:
 *  style={{ color: themeColors.text }}
 *  style={{ background: themeColors.surface, color: themeColors.text }}
 */

export const themeColors = {
  // ── Primary Text & Content ────────────────────────────────────────────────
  /** Primary text color (dark in light mode, bright in dark mode) */
  text: 'var(--color-brand-text)',

  /** Secondary/muted text (gray in light mode, light gray in dark mode) */
  muted: 'var(--color-brand-muted)',

  /** Text on colored backgrounds (e.g., buttons) */
  textInverse: 'var(--color-brand-text-inverse)',

  // ── Backgrounds ────────────────────────────────────────────────────────────
  /** Main page background */
  bg: 'var(--color-brand-bg)',

  /** Card/container background (white in light, dark navy in dark) */
  surface: 'var(--color-ui-card)',

  /** Alternative surface for nested content */
  surfaceAlt: 'var(--color-brand-surface-alt)',

  /** Sidebar background */
  sidebar: 'var(--color-ui-sidebar)',

  /** Header background */
  header: 'var(--color-ui-header)',

  /** Modal/overlay background */
  modal: 'var(--color-brand-surface)',

  // ── Borders & Dividers ─────────────────────────────────────────────────────
  /** Border color for cards, inputs, etc. */
  border: 'var(--color-brand-border)',

  // ── Interactive & Accents ──────────────────────────────────────────────────
  /** Primary action color (amber for CTAs, buttons) */
  primary: 'var(--color-brand-primary)',

  /** Primary color on hover */
  primaryHover: 'var(--color-brand-primary-hover)',

  /** Secondary action color */
  secondary: 'var(--color-brand-secondary)',

  // ── Status Colors ──────────────────────────────────────────────────────────
  /** Error/danger states */
  error: 'var(--color-brand-error)',

  /** Success states */
  success: 'var(--color-brand-success)',

  /** Warning states */
  warning: 'var(--color-brand-warning)',

  // ── Semantic ───────────────────────────────────────────────────────────────
  /** Input field background */
  input: 'var(--color-brand-surface)',

  /** Input text color */
  inputText: 'var(--color-brand-text)',

  /** Input placeholder color */
  inputPlaceholder: 'var(--color-brand-muted)',

  /** Input border color */
  inputBorder: 'var(--color-brand-border)',

  /** Badge/pill background */
  badgeBg: 'var(--color-brand-badge-bg)',

  /** Badge/pill text */
  badgeText: 'var(--color-brand-text)',

  // ── Utility ────────────────────────────────────────────────────────────────
  /** Used for gradients, shadows */
  glassBlur: 'var(--ui-glass-blur)',
  glassBg: 'var(--ui-glass-bg)',
  glassBorder: 'var(--ui-glass-border)',
} as const;

/**
 * Common style combinations for quick access
 */
export const themeStyles = {
  /** Default text element */
  text: {
    color: themeColors.text,
  },

  /** Muted/secondary text */
  mutedText: {
    color: themeColors.muted,
  },

  /** Card/container with proper styling */
  card: {
    background: themeColors.surface,
    color: themeColors.text,
    borderColor: themeColors.border,
    border: `1px solid ${themeColors.border}`,
  },

  /** Input field styling */
  input: {
    background: themeColors.input,
    color: themeColors.inputText,
    borderColor: themeColors.inputBorder,
    border: `1px solid ${themeColors.inputBorder}`,
  },

  /** Button styling */
  button: {
    background: themeColors.primary,
    color: '#FFFFFF',
  },

  /** Primary button on hover */
  buttonHover: {
    background: themeColors.primaryHover,
    color: '#FFFFFF',
  },

  /** Divider/separator */
  divider: {
    borderColor: themeColors.border,
    borderTop: `1px solid ${themeColors.border}`,
  },

  /** Badge styling */
  badge: {
    background: themeColors.badgeBg,
    color: themeColors.badgeText,
  },

  /** Error state */
  error: {
    color: themeColors.error,
    borderColor: themeColors.error,
  },

  /** Success state */
  success: {
    color: themeColors.success,
  },
} as const;

export function themeRGBA(
  variable: 'primary' | 'text' | 'muted' | 'error' | 'success' | 'warning',
  alpha: number,
): string {
  return `rgba(var(--color-brand-${variable}-rgb), ${alpha})`;
}

/**
 * Create a style object that properly responds to theme changes
 * All values should use CSS variables for theme support
 */
export function createThemeStyle(styles: Record<string, string>): React.CSSProperties {
  return styles as React.CSSProperties;
}
