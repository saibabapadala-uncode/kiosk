// src/components/ThemeToggle.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Animated dark / light mode toggle following Material Design 3 guidelines.
//
// Anatomy
//  ┌─────────────────────────────────┐
//  │  track (pill, 54 × 30 px)       │
//  │  ┌──────────┐                   │
//  │  │  thumb   │  ←  slides        │
//  │  │ ☀ / 🌙  │     spring easing │
//  │  └──────────┘                   │
//  └─────────────────────────────────┘
//
// Behaviour
//  • Reads  themeMode / setThemeMode from BrandContext.
//  • Clicking always resolves the current effective mode (handles 'auto')
//    and flips to the opposite explicit value ('light' / 'dark').
//  • Theme switch uses applyThemeSmooth → all surface colours fade at 280 ms.
//  • The thumb uses a spring cubic-bezier (slight overshoot) at 300 ms.
//  • Sun ↔ Moon icons crossfade with a scale + rotation animation.
//
// Variants
//  'compact'  — pill toggle only (default, for headers)
//  'labeled'  — pill toggle + "Dark" / "Light" chip below (for settings)

import { useCallback } from 'react';
import { useBrand }    from '@/hooks/useBrand';
import { resolveThemeMode } from '@/utils/themeUtils';

// ─── Icon components ──────────────────────────────────────────────────────────

function SunIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.3}
      strokeLinecap="round" strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4.5"/>
      {/* 8 rays */}
      <line x1="12" y1="2"    x2="12" y2="4.5"/>
      <line x1="12" y1="19.5" x2="12" y2="22"/>
      <line x1="2"  y1="12"   x2="4.5" y2="12"/>
      <line x1="19.5" y1="12" x2="22"  y2="12"/>
      <line x1="4.93" y1="4.93"   x2="6.64" y2="6.64"/>
      <line x1="17.36" y1="17.36" x2="19.07" y2="19.07"/>
      <line x1="4.93" y1="19.07"  x2="6.64" y2="17.36"/>
      <line x1="17.36" y1="6.64"  x2="19.07" y2="4.93"/>
    </svg>
  );
}

function MoonIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.3}
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

// ─── Dimensions (constants, never change between renders) ────────────────────

const TW  = 54;   // track width  px
const TH  = 30;   // track height px
const THD = 24;   // thumb diameter px
const GAP = (TH - THD) / 2;         // = 3 px — thumb inset from track edge
const THUMB_L = GAP;                 // left offset in dark mode
const THUMB_R = TW - THD - GAP;     // left offset in light mode  = 27

// Spring easing for the thumb slide — slight overshoot, very satisfying
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ThemeToggleProps {
  /**
   * 'compact'  → pill only (default — used in screen headers)
   * 'labeled'  → pill + text label (for settings panels)
   */
  variant?:  'compact' | 'labeled';
  className?: string;
  style?:     React.CSSProperties;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ThemeToggle({
  variant   = 'compact',
  className = '',
  style,
}: ThemeToggleProps) {
  const { themeMode, setThemeMode } = useBrand();

  // Resolve 'auto' → actual 'light' | 'dark' for rendering
  const resolved = resolveThemeMode(themeMode);
  const isDark   = resolved === 'dark';

  const toggle = useCallback(() => {
    // Always flip the resolved mode, removing 'auto' (makes the choice explicit)
    setThemeMode(isDark ? 'light' : 'dark');
  }, [isDark, setThemeMode]);

  // ── Track colours ──────────────────────────────────────────────────────────
  const trackBg = isDark
    ? 'rgba(255,255,255,0.13)'
    : 'var(--color-brand-primary)';

  const trackBorder = isDark
    ? 'rgba(255,255,255,0.20)'
    : 'transparent';

  const trackShadow = isDark
    ? 'none'
    : '0 2px 10px rgba(var(--color-brand-primary-rgb,245,158,11),0.35)';

  // ── Thumb colours ──────────────────────────────────────────────────────────
  const thumbBg = isDark
    ? 'linear-gradient(145deg, #2E2E3C 0%, #1C1C28 100%)'
    : '#FFFFFF';

  const thumbShadow = isDark
    ? '0 1px 5px rgba(0,0,0,0.50)'
    : '0 1px 4px rgba(0,0,0,0.18)';

  // ── Icon colours ───────────────────────────────────────────────────────────
  const sunColor  = 'var(--color-brand-primary)';
  const moonColor = '#94A3B8';

  return (
    <div
      className={className}
      style={{
        display:        'inline-flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            5,
        flexShrink:     0,
        ...style,
      }}
    >
      {/* ── Pill track / button ── */}
      <button
        type="button"
        role="switch"
        aria-checked={!isDark}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={toggle}
        style={{
          position:     'relative',
          display:      'inline-flex',
          alignItems:   'center',
          width:        TW,
          height:       TH,
          borderRadius: TH / 2,
          background:   trackBg,
          border:       `1.5px solid ${trackBorder}`,
          boxShadow:    trackShadow,
          cursor:       'pointer',
          padding:      0,
          flexShrink:   0,
          transition:   [
            'background 280ms ease',
            'border-color 280ms ease',
            'box-shadow 280ms ease',
          ].join(', '),
          // Ensure the toggle itself ignores the page-wide transition injection
          // when another toggle press happens (avoids double-spring)
          willChange: 'background',
        }}
      >
        {/* ── Sliding thumb ── */}
        <div
          style={{
            position:     'absolute',
            top:          GAP,
            left:         isDark ? THUMB_L : THUMB_R,
            width:        THD,
            height:       THD,
            borderRadius: '50%',
            background:   thumbBg,
            boxShadow:    thumbShadow,
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            // Spring slide — the primary choreography
            transition: [
              `left 300ms ${SPRING}`,
              'background 280ms ease',
              'box-shadow 280ms ease',
            ].join(', '),
            overflow: 'hidden',
          }}
        >
          {/* ── Sun icon — shown in light mode ── */}
          <div
            aria-hidden="true"
            style={{
              position:   'absolute',
              display:    'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color:      sunColor,
              // Rotate in from above when entering, rotate out below when leaving
              opacity:    isDark ? 0 : 1,
              transform:  isDark
                ? 'scale(0.35) rotate(120deg)'
                : 'scale(1)    rotate(0deg)',
              transition: [
                'opacity 220ms ease',
                'transform 260ms ease',
              ].join(', '),
            }}
          >
            <SunIcon size={14} />
          </div>

          {/* ── Moon icon — shown in dark mode ── */}
          <div
            aria-hidden="true"
            style={{
              position:   'absolute',
              display:    'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color:      moonColor,
              opacity:    isDark ? 1 : 0,
              transform:  isDark
                ? 'scale(1)    rotate(0deg)'
                : 'scale(0.35) rotate(-120deg)',
              transition: [
                'opacity 220ms ease',
                'transform 260ms ease',
              ].join(', '),
            }}
          >
            <MoonIcon size={13} />
          </div>
        </div>

        {/* ── Subtle "off-side" ghost icon — echoes MD3 unselected track ── */}
        <div
          aria-hidden="true"
          style={{
            position:   'absolute',
            // When dark: sun ghost on the right; when light: moon ghost on left
            left:       isDark ? (THUMB_R + (THD - 12) / 2) : (THUMB_L + (THD - 12) / 2),
            top:        (TH - 12) / 2,
            width:      12,
            height:     12,
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color:      isDark
              ? 'rgba(255,255,255,0.28)'
              : 'rgba(255,255,255,0.55)',
            opacity:    0.9,
            transition: 'left 300ms ' + SPRING + ', color 280ms ease, opacity 200ms ease',
            pointerEvents: 'none',
          }}
        >
          {isDark ? <SunIcon size={10} /> : <MoonIcon size={9} />}
        </div>
      </button>

      {/* ── Optional label ── */}
      {variant === 'labeled' && (
        <span
          style={{
            fontSize:      '0.62rem',
            fontWeight:    700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            color:         'var(--color-brand-muted)',
            fontFamily:    'var(--font-brand)',
            transition:    'color 280ms ease',
            userSelect:    'none',
          }}
        >
          {isDark ? 'Dark' : 'Light'}
        </span>
      )}
    </div>
  );
}
