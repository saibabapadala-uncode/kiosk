// src/modules/kiosk/AttractScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Attract screen — pixel-faithful reimplementation of the provided reference.
//
// Layout (top → bottom)
//   ① Header bar   — store logo + name + tagline  |  clock + LanguageSelector
//   ② Hero         — floating food doodles background
//                    "WELCOME TO" with amber rules
//                    "Order / Here." display type
//                    three feature badges
//                    instruction copy + CTA button
//   ③ Browse menu  — "BROWSE MENU" + scrollable category chip row
//   ④ Footer bar   — assistance text | multilingual notice
//
// All text keys come from i18n so every label is translated dynamically.
// RTL is handled by setting dir="rtl" on <html> via i18n/index.ts.

import { useEffect, useRef, useState } from 'react';
import { useHistory }            from 'react-router-dom';
import { useIonViewWillEnter }   from '@ionic/react';
import { useTranslation }        from 'react-i18next';

import { useBrand }              from '@/hooks/useBrand';
import { useCartStore }          from '@/store/cartStore';
import { useSessionStore }       from '@/store/sessionStore';
import { usePaymentStore }       from '@/store/paymentStore';
import { useSettingsStore }      from '@/store/settingsStore';
import { useKioskChannelStore }  from '@/store/kioskChannelStore';
import { useStoreConfigStore }   from '@/store/storeConfigStore';
import { useCatalogStore }       from '@/store/catalogStore';
import { loadCatalog }           from '@/services/catalog.service';
import type { Category }         from '@/types/catalog';

import LanguageSelector          from '@/components/LanguageSelector';
import StaffPinModal             from '@/components/StaffPinModal';
import AgeVerificationGate       from '@/components/AgeVerificationGate';

// ─── Colour tokens — CSS variable aliases ────────────────────────────────────
// All values reference CSS custom properties so the attract screen responds
// automatically when the active brand switches at runtime.

const C = {
  bg:         'var(--color-brand-bg)',
  amber:      'var(--color-brand-primary)',
  amberLight: 'var(--color-brand-gradient-end)',
  amberTint:  'var(--color-brand-surface)',
  amberBg:    'rgba(var(--color-brand-primary-rgb,245,158,11),0.08)',
  stone900:   'var(--color-brand-text)',
  stone700:   'var(--color-brand-text)',
  stone500:   'var(--color-brand-muted)',
  stone300:   'var(--color-brand-border)',
  white:      'var(--color-ui-card)',
  cardBg:     'var(--ui-glass-bg)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_CAT_ICON_MAP: Record<string, string> = {
  'chicken': '🍗', 'wing': '🍗', 'burger': '🍔', 'sandwich': '🥪',
  'pizza': '🍕', 'flat': '🍕', 'drink': '🥤', 'bev': '🥤', 'juice': '🍹',
  'dessert': '🍰', 'sweet': '🧁', 'cake': '🎂', 'side': '🍟', 'snack': '🍿',
  'fry': '🍟', 'bread': '🫓', 'naan': '🫓', 'roti': '🫓', 'rice': '🍚',
  'bowl': '🥗', 'salad': '🥗', 'veg': '🥗', 'soup': '🍲', 'coffee': '☕',
  'tea': '🫖', 'wrap': '🌯', 'taco': '🌮', 'roll': '🌯', 'seafood': '🦐',
  'fish': '🐟', 'indian': '🍛', 'south': '🍛', 'beer': '🍺', 'wine': '🍷',
  'spirit': '🥃', 'cocktail': '🍸', 'vodka': '🍸', 'whiskey': '🥃',
};

function catIcon(name: string, brandMap?: Record<string, string>): string {
  const s = name.toLowerCase();
  const map = brandMap ?? DEFAULT_CAT_ICON_MAP;
  for (const [key, icon] of Object.entries(map)) {
    if (s.includes(key)) return icon;
  }
  return '🍽';
}

function padCount(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// ─── Floating doodles ────────────────────────────────────────────────────────
// Emoji scattered in the background — sourced from brand config when available.

const DEFAULT_DOODLES = ['🍔','🍕','🥤','🍟','🍗','🍰','🫓','🌿','🌿','🌿'];

const DOODLE_POSITIONS = [
  { top: '8%',  left: '5%',   rot: -15, opacity: 0.22 },
  { top: '14%', right: '6%',  rot: 12,  opacity: 0.20 },
  { top: '38%', left: '3%',   rot: -8,  opacity: 0.18 },
  { top: '55%', right: '4%',  rot: 10,  opacity: 0.20 },
  { top: '70%', left: '6%',   rot: -12, opacity: 0.18 },
  { top: '22%', right: '3%',  rot: 8,   opacity: 0.16 },
  { top: '80%', right: '7%',  rot: -6,  opacity: 0.16 },
  { top: '12%', left: '22%',  rot: 20,  opacity: 0.28 },
  { top: '35%', right: '20%', rot: -18, opacity: 0.24 },
  { top: '60%', left: '28%',  rot: 15,  opacity: 0.22 },
];

function BrandDoodles({ doodles }: { doodles: string[] }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
      {DOODLE_POSITIONS.map((pos, i) => {
        const emoji = doodles[i % doodles.length];
        return (
          <div key={i} style={{
            position: 'absolute',
            top: pos.top,
            ...(('left' in pos) ? { left: pos.left } : { right: (pos as { right: string }).right }),
            fontSize: `calc(var(--doodle-size-base, 56px) + ${(i % 3) * 8}px)`,
            lineHeight: 1,
            opacity: pos.opacity,
            transform: `rotate(${pos.rot}deg)`,
            transition: 'font-size 0.3s ease',
          }}>
            {emoji}
          </div>
        );
      })}
      {/* Decorative circles */}
      <div style={{ position: 'absolute', top: '28%', left: '15%',
        width: 14, height: 14, borderRadius: '50%',
        border: `2px solid ${C.amber}`, opacity: 0.14 }} />
      <div style={{ position: 'absolute', top: '48%', right: '18%',
        width: 10, height: 10, borderRadius: '50%',
        border: `2px solid ${C.amber}`, opacity: 0.12 }} />
    </div>
  );
}

// ─── Live clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const locale = useSettingsStore((s) => s.localization.locale);
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  const timeStr = t.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true });
  const dateStr = t.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div style={{ textAlign: 'right' }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(0.95rem,1.6vw,1.1rem)',
        color: C.stone900, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em' }}>
        {timeStr}
      </p>
      <p style={{ margin: 0, fontSize: 'clamp(0.7rem,1.1vw,0.8rem)', color: C.stone500, marginTop: 1 }}>
        {dateStr}
      </p>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function HeaderBar({
  logoUrl, displayName, tagline, onSettingsTap, settingsTaps, settingsNeeded,
}: {
  logoUrl: string; displayName: string; tagline: string;
  onSettingsTap: (e: React.MouseEvent) => void;
  settingsTaps: number; settingsNeeded: number;
}) {
  return (
    <div style={{
      position:   'relative', zIndex: 20, flexShrink: 0,
      display:    'flex', alignItems: 'center', justifyContent: 'space-between',
      padding:    'clamp(10px,1.8vh,18px) clamp(16px,3vw,32px)',
      background: C.white,
      borderBottom: `1px solid rgba(0,0,0,0.06)`,
      boxShadow:  '0 1px 8px rgba(0,0,0,0.05)',
    }}>
      {/* ── Left: logo card + name + tagline ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px,1.8vw,16px)' }}>
        {/* Logo / monogram card */}
        <div style={{
          width: 'clamp(52px,7vh,72px)', height: 'clamp(52px,7vh,72px)',
          borderRadius: 'clamp(10px,1.5vw,16px)',
          background: logoUrl ? C.white : `linear-gradient(135deg,${C.amberLight},${C.amber})`,
          border:  logoUrl ? `1.5px solid ${C.stone300}` : 'none',
          boxShadow: '0 3px 12px rgba(0,0,0,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, overflow: 'hidden',
        }}>
          {logoUrl ? (
            <img src={logoUrl} alt={displayName}
              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"
              style={{ width: '55%', height: '55%' }}>
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          )}
        </div>

        {/* Name + tagline */}
        <div>
          <h1 style={{ margin: 0, fontWeight: 900, fontSize: 'clamp(1rem,2.2vw,1.5rem)',
            color: C.stone900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            {displayName}
          </h1>
          {tagline && (
            <p style={{ margin: '3px 0 0', fontWeight: 500, fontSize: 'clamp(0.7rem,1.3vw,0.88rem)',
              color: C.stone500, letterSpacing: '0.01em' }}>
              {tagline}
            </p>
          )}
        </div>
      </div>

      {/* ── Right: clock + language selector ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px,2vw,20px)', flexShrink: 0 }}>
        {/* Clock — double as settings tap zone */}
        <button type="button" onClick={onSettingsTap} aria-label="Settings"
          style={{ position: 'relative', background: 'none', border: 'none', padding: 0,
            cursor: 'default' }}>
          <LiveClock />
          {settingsTaps > 0 && (
            <span style={{
              position: 'absolute', top: -3, right: -5,
              width: 16, height: 16, borderRadius: '50%',
              background: C.amber, color: C.white,
              fontSize: '0.55rem', fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {settingsNeeded - settingsTaps}
            </span>
          )}
        </button>

        <LanguageSelector variant="header" />
      </div>
    </div>
  );
}

// ─── Feature badges ───────────────────────────────────────────────────────────

const BADGE_ICONS = [
  // Bolt
  <svg key="b" width="16" height="16" viewBox="0 0 24 24" fill={C.amber}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  // Clock
  <svg key="c" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth={2.2} strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  // Heart
  <svg key="h" width="16" height="16" viewBox="0 0 24 24" fill={C.amber}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
];

function FeatureBadges({ labels }: { labels: string[] }) {
  return (
    <div className="feature-badges-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexWrap: 'wrap', gap: 'clamp(6px,1.5vw,16px)', marginBottom: 'var(--badges-margin-bottom)' }}>
      {labels.map((label, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 'var(--badge-font-size, clamp(0.78rem,1.4vw,0.92rem))', fontWeight: 600, color: C.stone700 }}>
          {BADGE_ICONS[i]}
          {label}
          {i < labels.length - 1 && (
            <span style={{ width: 1, height: 14, background: C.stone300, marginInlineStart: 8 }} />
          )}
        </span>
      ))}
    </div>
  );
}

// ─── Browse menu section ──────────────────────────────────────────────────────

function BrowseMenu({ categories, onStart, categoryIconMap }: { categories: Category[]; onStart: () => void; categoryIconMap?: Record<string, string> }) {
  const { t } = useTranslation();
  return (
    <div style={{
      flexShrink: 0, padding: 'var(--browse-menu-padding)',
      background: C.white, borderTop: `1px solid rgba(0,0,0,0.06)`,
    }}>
      {/* Section title with amber rules */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center',
        marginBottom: 'var(--browse-menu-title-margin)' }}>
        <div style={{ flex: 1, height: 1.5, background: `linear-gradient(to right, transparent, ${C.amber})` }} />
        <span style={{ fontWeight: 800, fontSize: 'clamp(0.72rem,1.3vw,0.84rem)',
          color: C.amber, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>
          {t('attract.browseMenu')}
        </span>
        <div style={{ flex: 1, height: 1.5, background: `linear-gradient(to left, transparent, ${C.amber})` }} />
      </div>

      {/* Category chips */}
      <div style={{
        display: 'flex',
        gap: 'var(--browse-chip-gap, clamp(8px,1.4vw,14px))',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        flexWrap: 'nowrap',
        justifyContent: categories.length > 5 ? 'flex-start' : 'center',
        paddingLeft: '12px',
        paddingRight: '12px',
      }}
        className="no-scrollbar browse-chips-container">
        {categories.map((cat) => (
          <button key={cat.id} type="button"
            onClick={(e) => { e.stopPropagation(); onStart(); }}
            style={{
              flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 6, padding: 'var(--browse-chip-padding)',
              borderRadius: 'clamp(12px,1.8vw,18px)',
              background: C.white,
              border: `1.5px solid ${C.stone300}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              cursor: 'pointer', transition: 'all 140ms',
              minWidth: 'var(--browse-chip-min-width)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = C.amber;
              el.style.boxShadow = `0 4px 14px rgba(232,114,12,0.18)`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = C.stone300;
              el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
            }}
          >
            <span style={{ fontSize: 'var(--browse-chip-icon-size)', lineHeight: 1 }}>
              {catIcon(cat.name, categoryIconMap)}
            </span>
            <span style={{ fontWeight: 700, fontSize: 'var(--browse-chip-font-size)',
              color: C.stone900, textAlign: 'center', lineHeight: 1.2 }}>
              {cat.name}
            </span>
            {(cat.itemCount ?? 0) > 0 && (
              <span style={{ fontWeight: 700, fontSize: 'calc(var(--browse-chip-font-size) - 0.08rem)',
                color: C.amber }}>
                {padCount(cat.itemCount ?? 0)} Items
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Footer bar ───────────────────────────────────────────────────────────────

function FooterBar() {
  const { t } = useTranslation();
  return (
    <div style={{
      flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexWrap: 'wrap', gap: '4px 24px',
      padding: 'var(--footer-padding)',
      background: 'rgba(255,255,255,0.75)',
      borderTop: `1px solid rgba(0,0,0,0.06)`,
      backdropFilter: 'blur(8px)',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 'clamp(0.68rem,1.1vw,0.78rem)', color: C.stone500 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke={C.stone500} strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {t('attract.footerHelp')}
      </span>
      <div style={{ width: 1, height: 14, background: C.stone300 }} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 'clamp(0.68rem,1.1vw,0.78rem)', color: C.stone500 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke={C.stone500} strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
        </svg>
        {t('attract.footerLang')}
      </span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

const SETTINGS_TAPS   = 5;
const SETTINGS_WIN_MS = 3_000;

export default function AttractScreenContent() {
  const { t }            = useTranslation();
  const history          = useHistory();
  const { environment }  = useBrand();
  const logoUrl          = useSettingsStore((s) => s.theme.logoUrl);
  const tagline          = useSettingsStore((s) => s.theme.tagline ?? '');
  const channel          = useKioskChannelStore((s) => s.channel);
  const ageVerified      = useSessionStore((s) => s.ageVerified);
  const setAgeVerified   = useSessionStore((s) => s.setAgeVerified);
  const storeName        = useStoreConfigStore((s) => s.store?.name ?? '');
  const clearCart        = useCartStore((s) => s.clearCart);
  const resetSession     = useSessionStore((s) => s.resetSession);
  const resetPayment     = usePaymentStore((s) => s.reset);
  const startOrder       = useSessionStore((s) => s.startOrder);
  const catalogCategories = useCatalogStore((s) => s.categories);
  const catalogLoading   = useCatalogStore((s) => s.isLoading);

  useIonViewWillEnter(() => { void loadCatalog(); });

  const displayName = (channel?.name || storeName || environment.displayName).trim();
  const subLabel    = storeName && storeName !== displayName ? storeName : null;
  const categories  = catalogCategories.slice(0, 10);
  const showBrowse  = categories.length > 0;

  const [settingsTaps, setSettingsTaps] = useState(0);
  const [pinOpen, setPinOpen]           = useState(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>();

  const ageGateEnabled   = environment.businessRules?.ageVerification?.enabled ?? false;
  const showAgeGate      = ageGateEnabled && !ageVerified;
  const brandDoodles     = environment.attractScreen?.doodles ?? DEFAULT_DOODLES;
  const categoryIconMap  = environment.categoryIconMap;

  useEffect(() => {
    clearCart(); resetSession(); resetPayment();
  }, [clearCart, resetSession, resetPayment]);

  function handleStart() {
    if (ageGateEnabled && !ageVerified) return; // age gate must be confirmed first
    startOrder();
    history.push('/menu');
  }

  function handleSettingsTap(e: React.MouseEvent) {
    e.stopPropagation();
    const next = settingsTaps + 1;
    setSettingsTaps(next);
    clearTimeout(tapTimer.current);
    if (next >= SETTINGS_TAPS) {
      setSettingsTaps(0);
      setPinOpen(true);
      return;
    }
    tapTimer.current = setTimeout(() => setSettingsTaps(0), SETTINGS_WIN_MS);
  }

  return (
    <div
      className="attract-screen-root"
      style={{
        position:      'relative',
        display:       'flex',
        flexDirection: 'column',
        width:         '100%',
        height:        '100%',
        overflow:      'hidden',
        background:    C.bg,
        userSelect:    'none',
      }}
      onClick={handleStart}
    >
      <style>{`
        .attract-screen-root {
          /* Default / Portrait values */
          --hero-padding: clamp(24px, 4vh, 48px) clamp(20px, 5vw, 80px) clamp(12px, 2vh, 24px);
          --welcome-margin-bottom: clamp(6px, 1.2vh, 10px);
          --welcome-font-size: clamp(0.7rem, 1.2vw, 0.82rem);
          --hero-font-size: clamp(4rem, 12vw, 9rem);
          --badges-margin-top: clamp(14px, 2.5vh, 22px);
          --badges-margin-bottom: clamp(14px, 2.5vh, 24px);
          --badge-font-size: clamp(0.78rem, 1.4vw, 0.92rem);
          --instruction-margin-bottom: clamp(16px, 3vh, 28px);
          --instruction-font-size: clamp(0.8rem, 1.5vw, 0.96rem);
          
          --cta-width: clamp(240px, 52vw, 440px);
          --cta-height: clamp(58px, 8.5vh, 76px);
          --cta-font-size: clamp(1rem, 2vw, 1.2rem);
          --cta-icon-circle-size: clamp(34px, 5vw, 44px);
          --cta-arrow-circle-size: clamp(28px, 4vw, 38px);
          
          --browse-menu-padding: clamp(14px, 2.2vh, 20px) clamp(16px, 3vw, 32px) clamp(10px, 1.8vh, 16px);
          --browse-menu-title-margin: clamp(10px, 1.8vh, 16px);
          --browse-chip-padding: clamp(10px, 1.6vh, 14px) clamp(14px, 2vw, 20px);
          --browse-chip-min-width: clamp(72px, 10vw, 96px);
          --browse-chip-icon-size: clamp(1.6rem, 3vw, 2rem);
          --browse-chip-font-size: clamp(0.7rem, 1.2vw, 0.82rem);
          
          --doodle-size-base: 56px;
          
          --footer-padding: clamp(8px, 1.4vh, 12px) clamp(16px, 3vw, 32px);
          --loader-margin-top: clamp(10px, 1.8vh, 16px);
        }

        /* Smooth orientation changes */
        .attract-screen-root .hero-section-container,
        .attract-screen-root .welcome-wrapper,
        .attract-screen-root .order-title-container span,
        .attract-screen-root .feature-badges-container,
        .attract-screen-root .instruction-text,
        .attract-screen-root button,
        .attract-screen-root .browse-chips-container {
          transition: all 0.25s ease-in-out;
        }

        /* Tablets and landscape viewports with restricted height */
        @media (max-height: 768px) {
          .attract-screen-root {
            --hero-padding: clamp(14px, 2.5vh, 28px) clamp(16px, 4vw, 48px) clamp(10px, 1.8vh, 18px);
            --welcome-margin-bottom: clamp(4px, 0.8vh, 8px);
            --welcome-font-size: clamp(0.65rem, 1.2vh, 0.76rem);
            --hero-font-size: clamp(2.8rem, 11vh, 5.5rem);
            --badges-margin-top: clamp(8px, 1.8vh, 14px);
            --badges-margin-bottom: clamp(8px, 1.8vh, 14px);
            --badge-font-size: clamp(0.7rem, 1.2vh, 0.84rem);
            --instruction-margin-bottom: clamp(10px, 2vh, 18px);
            --instruction-font-size: clamp(0.72rem, 1.4vh, 0.84rem);
            
            --cta-width: clamp(210px, 45vw, 340px);
            --cta-height: clamp(46px, 7.5vh, 56px);
            --cta-font-size: clamp(0.85rem, 1.8vh, 1rem);
            --cta-icon-circle-size: clamp(28px, 4.2vh, 34px);
            --cta-arrow-circle-size: clamp(24px, 3vh, 30px);
            
            --browse-menu-padding: clamp(10px, 1.8vh, 16px) clamp(16px, 3vw, 32px) clamp(8px, 1.4vh, 12px);
            --browse-menu-title-margin: clamp(8px, 1.4vh, 12px);
            --browse-chip-padding: clamp(6px, 1.2vh, 10px) clamp(12px, 1.8vw, 16px);
            --browse-chip-min-width: clamp(64px, 8vw, 84px);
            --browse-chip-icon-size: clamp(1.2rem, 2.5vh, 1.6rem);
            --browse-chip-font-size: clamp(0.65rem, 1.2vh, 0.76rem);
            
            --doodle-size-base: 36px;
            
            --footer-padding: clamp(6px, 1.2vh, 10px) clamp(16px, 3vw, 32px);
            --loader-margin-top: clamp(6px, 1.2vh, 12px);
          }
        }

        /* Very short screen heights (e.g. landscape kiosk/tablet) */
        @media (max-height: 600px) {
          .attract-screen-root {
            --hero-padding: clamp(8px, 1.8vh, 16px) clamp(12px, 3vw, 32px) clamp(6px, 1.2vh, 12px);
            --welcome-margin-bottom: clamp(2px, 0.5vh, 4px);
            --hero-font-size: clamp(2.2rem, 12vh, 4.2rem);
            --instruction-margin-bottom: clamp(6px, 1.5vh, 12px);
            
            --cta-width: clamp(180px, 40vw, 280px);
            --cta-height: clamp(38px, 7vh, 46px);
            --cta-font-size: clamp(0.78rem, 1.8vh, 0.9rem);
            --cta-icon-circle-size: clamp(24px, 3.8vh, 28px);
            --cta-arrow-circle-size: clamp(20px, 2.8vh, 24px);
            
            --browse-menu-padding: clamp(6px, 1.4vh, 12px) clamp(12px, 3vw, 24px) clamp(6px, 1.2vh, 10px);
            --browse-menu-title-margin: clamp(6px, 1.2vh, 10px);
            --browse-chip-padding: clamp(4px, 1vh, 8px) clamp(8px, 1.5vw, 12px);
            --browse-chip-min-width: clamp(56px, 7vw, 76px);
            --browse-chip-icon-size: clamp(1rem, 2.2vh, 1.3rem);
            --browse-chip-font-size: clamp(0.6rem, 1.1vh, 0.7rem);
            
            --doodle-size-base: 24px;
            --loader-margin-top: clamp(4px, 1vh, 8px);
          }
          
          /* Hide non-essential layout blocks on very restricted heights to prevent overlap */
          .attract-screen-root .feature-badges-container {
            display: none !important;
          }
          .attract-screen-root .instruction-text {
            display: none !important;
          }
        }
      `}</style>

      {/* Age verification gate — Holiq brand only, once per session */}
      {showAgeGate && (
        <AgeVerificationGate
          onConfirm={() => setAgeVerified(true)}
          onDeny={() => {
            setAgeVerified(false);
            // Stay on attract screen — customer chose to leave
          }}
        />
      )}

      {/* ① Header */}
      <div onClick={(e) => e.stopPropagation()}>
        <HeaderBar
          logoUrl={logoUrl}
          displayName={displayName}
          tagline={tagline || (subLabel ? subLabel : '')}
          onSettingsTap={handleSettingsTap}
          settingsTaps={settingsTaps}
          settingsNeeded={SETTINGS_TAPS}
        />
      </div>

      {/* ② Hero — fills remaining vertical space */}
      <div className="hero-section-container" style={{ flex: 1, position: 'relative', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--hero-padding)',
        textAlign: 'center', overflow: 'hidden' }}>

        <BrandDoodles doodles={brandDoodles} />

        {/* "WELCOME TO" with flanking rules */}
        <div className="welcome-wrapper" style={{ position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 'var(--welcome-margin-bottom)', width: '100%', maxWidth: 520 }}>
          <div style={{ flex: 1, height: 1.5,
            background: `linear-gradient(to right, transparent, ${C.amber})` }} />
          <span style={{ fontWeight: 800, fontSize: 'var(--welcome-font-size)',
            color: C.amber, letterSpacing: '0.14em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' }}>
            {t('attract.welcomeTo')}
          </span>
          <div style={{ flex: 1, height: 1.5,
            background: `linear-gradient(to left, transparent, ${C.amber})` }} />
        </div>

        {/* "Order" — dark */}
        <div className="order-title-container" style={{ position: 'relative', zIndex: 2, lineHeight: 0.88,
          marginBottom: 0 }}>
          <span style={{
            display: 'block', fontWeight: 900,
            fontSize: 'var(--hero-font-size)',
            color: C.stone900, letterSpacing: '-0.048em', lineHeight: 0.9,
          }}>
            {t('attract.orderHero1')}
          </span>

          {/* "Here." — amber with sparkle dots matching reference */}
          <span style={{ position: 'relative', display: 'inline-block', fontWeight: 900,
            fontSize: 'var(--hero-font-size)',
            color: C.amber, letterSpacing: '-0.048em', lineHeight: 0.9 }}>
            {t('attract.orderHero2')}
            {/* Decorative sparkle dots (reference has 3 orange dots beside the period) */}
            <span aria-hidden="true" style={{
              position: 'absolute', top: '10%', insetInlineEnd: '-5%',
              display: 'flex', flexDirection: 'column', gap: 'clamp(3px,0.5vw,6px)',
            }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{
                  display: 'block',
                  width:  `clamp(6px,1vw,10px)`,
                  height: `clamp(6px,1vw,10px)`,
                  borderRadius: '50%',
                  background: C.amber,
                  opacity: 0.9 - i * 0.2,
                  transform: `translateX(${i * 3}px)`,
                }} />
              ))}
            </span>
          </span>
        </div>

        {/* Feature badges */}
        <div className="feature-badges-container" style={{ position: 'relative', zIndex: 2, marginTop: 'var(--badges-margin-top)' }}>
          <FeatureBadges labels={[
            t('attract.badge1'),
            t('attract.badge2'),
            t('attract.badge3'),
          ]} />
        </div>

        {/* Instruction */}
        <p className="instruction-text" style={{ position: 'relative', zIndex: 2,
          margin: '0 0 var(--instruction-margin-bottom)',
          fontWeight: 400, fontSize: 'var(--instruction-font-size)',
          color: C.stone500, letterSpacing: '0.01em' }}>
          {t('attract.tapToOrder')}
        </p>

        {/* CTA button — amber pill with fork/knife icon + arrow */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleStart(); }}
          style={{
            position:       'relative', zIndex: 2,
            display:        'flex', alignItems: 'center', justifyContent: 'center',
            gap:            'clamp(8px,1.5vw,14px)',
            width:          'var(--cta-width)',
            height:         'var(--cta-height)',
            flexShrink:     0,
            borderRadius:   999,
            background:     `linear-gradient(135deg, ${C.amberLight}, ${C.amber})`,
            color:          C.white,
            fontWeight:     800,
            fontSize:       'var(--cta-font-size)',
            letterSpacing:  '-0.01em',
            border:         'none',
            cursor:         'pointer',
            boxShadow:      `0 8px 32px rgba(232,114,12,0.40), 0 2px 8px rgba(232,114,12,0.20)`,
            transition:     'transform 130ms ease, box-shadow 130ms ease',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.transform   = 'translateY(-2px)';
            el.style.boxShadow   = `0 14px 40px rgba(232,114,12,0.48), 0 4px 12px rgba(232,114,12,0.24)`;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.transform   = '';
            el.style.boxShadow   = `0 8px 32px rgba(232,114,12,0.40), 0 2px 8px rgba(232,114,12,0.20)`;
          }}
        >
          {/* Fork & knife icon circle */}
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 'var(--cta-icon-circle-size)', height: 'var(--cta-icon-circle-size)',
            borderRadius: '50%', background: 'rgba(255,255,255,0.22)', flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"
              style={{ width: '52%', height: '52%' }}>
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2a5 5 0 00-5 5v6h3.5"/>
              <line x1="16" y1="15" x2="16" y2="22"/>
            </svg>
          </span>

          <span>{t('attract.startOrder')}</span>

          {/* Arrow icon */}
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 'var(--cta-arrow-circle-size)', height: 'var(--cta-arrow-circle-size)',
            borderRadius: '50%', background: 'rgba(255,255,255,0.18)', flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}
              strokeLinecap="round" strokeLinejoin="round"
              style={{ width: '55%', height: '55%' }}>
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </span>
        </button>

        {/* Catalogue loading indicator */}
        {catalogLoading && (
          <div style={{ position: 'relative', zIndex: 2,
            marginTop: 'var(--loader-margin-top)',
            display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%',
              background: C.amber, display: 'block', animation: 'pulse 1.5s ease infinite' }} />
            <span style={{ fontSize: '0.72rem', color: C.stone500 }}>
              {t('attract.loadingMenu')}
            </span>
          </div>
        )}
      </div>

      {/* ③ Browse menu */}
      {showBrowse && (
        <div onClick={(e) => e.stopPropagation()}>
          <BrowseMenu categories={categories} onStart={handleStart} categoryIconMap={categoryIconMap} />
        </div>
      )}

      {/* ④ Footer */}
      <div onClick={(e) => e.stopPropagation()}>
        <FooterBar />
      </div>

      {/* Staff PIN modal */}
      <StaffPinModal
        isOpen={pinOpen}
        onSuccess={() => { setPinOpen(false); history.push('/settings'); }}
        onCancel={() => setPinOpen(false)}
      />
    </div>
  );
}
