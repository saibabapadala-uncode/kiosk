// src/screens/CatalogScreen.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { IonPage, IonContent, useIonViewWillEnter } from '@ionic/react';
import { useHistory, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCatalog, useFilteredProducts } from '@/modules/catalog/hooks/useCatalog';
import { loadCatalog } from '@/services/catalog.service';
import { useCartStore } from '@/store/cartStore';
import { useCartDrawerStore } from '@/store/cartDrawerStore';
import { useDebounce } from '@/modules/catalog/hooks/useDebounce';
import { useIsLandscape } from '@/hooks/useOrientation';
import { useKioskName } from '@/hooks/useKioskName';
import { useSettingsStore } from '@/store/settingsStore';
import { useBrand } from '@/hooks/useBrand';
import { useBrandCSSVar } from '@/hooks/useBrandCSSVar';
import LanguageSelector from '@/components/LanguageSelector';
import StaffPinModal from '@/components/StaffPinModal';
import ProductGrid from '@/modules/catalog/ProductGrid';
import ProductModal from '@/modules/catalog/ProductModal';
import type { Product, Category } from '@/types/catalog';

interface CatalogNavState {
  highlightProductId?: string;
  highlightCategoryId?: string;
}

// ─── Brand-aware category icon resolver ───────────────────────────────────────

const FOOD_FALLBACK_MAP: Record<string, string> = {
  'burger': '🍔', 'sandwich': '🥪', 'chicken': '🍗', 'wing': '🍗',
  'bowl': '🥗', 'rice': '🍚', 'side': '🍟', 'frie': '🍟', 'appetizer': '🥟',
  'drink': '🥤', 'beverage': '🥤', 'juice': '🍹', 'dessert': '🍰',
  'sweet': '🧁', 'cake': '🎂', 'pizza': '🍕', 'flatbread': '🫓',
  'salad': '🥦', 'veggie': '🥗', 'coffee': '☕', 'tea': '🫖',
  'combo': '🍱', 'meal': '🍱', 'special': '⭐', 'soup': '🍲',
  'wrap': '🌯', 'taco': '🌮', 'burrito': '🌯', 'seafood': '🦐',
  'fish': '🐟', 'shrimp': '🍤', 'steak': '🥩', 'beef': '🥩',
  'meat': '🍖', 'pasta': '🍝', 'noodle': '🍜', 'bread': '🫓',
  'roti': '🫓', 'naan': '🫓', 'breakfast': '🍳', 'morning': '🍳',
  'snack': '🍿', 'bite': '🧆', 'dosa': '🥞', 'curry': '🍛',
};

function resolveCategoryIcon(
  name: string,
  brandMap?: Record<string, string>,
  fallbackIcon = '🍽',
): string {
  const n = name.toLowerCase();
  const map = brandMap ?? FOOD_FALLBACK_MAP;
  for (const [key, icon] of Object.entries(map)) {
    if (n.includes(key)) return icon;
  }
  return fallbackIcon;
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  categories,
  activeId,
  onChange,
  categoryIconMap,
}: {
  categories:     Category[];
  activeId:       string | null;
  onChange:       (id: string | null) => void;
  categoryIconMap?: Record<string, string>;
}) {
  const { t }           = useTranslation();
  const brandPrimary    = useBrandCSSVar('--color-brand-primary');
  const brandPrimaryRgb = useBrandCSSVar('--color-brand-primary-rgb');
  const allActive       = activeId === null;
  const total           = categories.reduce((s, c) => s + (c.itemCount ?? 0), 0);

  const activeGradient  = 'var(--gradient-cta)';
  const activeShadow    = `0 4px 18px rgba(${brandPrimaryRgb},0.32)`;

  return (
    <nav
      aria-label={t('catalog.categoriesLabel', 'Categories')}
      className="hidden lg:flex flex-col flex-shrink-0 overflow-y-auto no-scrollbar"
      style={{
        width:           'var(--sidebar-width)',
        height:          '100%',
        background:      'var(--color-ui-sidebar)',
        borderInlineEnd: '1px solid var(--ui-glass-border)',
        padding:         '20px 12px',
      }}
    >
      {/* Label */}
      <p style={{
        margin:        '0 0 10px 6px',
        fontSize:      '0.62rem',
        fontWeight:    800,
        color:         'var(--color-brand-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.16em',
        fontFamily:    'var(--font-brand)',
      }}>
        {t('catalog.catalogLabel', 'Catalog')}
      </p>

      {/* All Items */}
      <button
        onClick={() => onChange(null)}
        aria-current={allActive ? 'page' : undefined}
        style={{
          display:      'flex',
          alignItems:   'center',
          gap:          11,
          width:        '100%',
          padding:      '10px 12px',
          borderRadius: 'var(--sidebar-item-radius)',
          border:       'none',
          cursor:       'pointer',
          textAlign:    'left',
          marginBottom: 4,
          transition:   'all 200ms ease',
          background:   allActive ? activeGradient : 'transparent',
          boxShadow:    allActive ? activeShadow : 'none',
        }}
        onMouseEnter={e => { if (!allActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-brand-surface)'; }}
        onMouseLeave={e => { if (!allActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        <span style={{
          width: 42, height: 42,
          borderRadius:   'var(--radius-icon-wrap)',
          flexShrink:     0,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          background:     allActive ? 'rgba(255,255,255,0.22)' : `rgba(${brandPrimaryRgb},0.12)`,
          transition:     'background 200ms',
        }}>
          {/* Grid/catalog icon — brand-neutral */}
          <svg viewBox="0 0 24 24" fill="none"
            stroke={allActive ? '#FFFFFF' : brandPrimary}
            strokeWidth={2} strokeLinecap="round" style={{ width: 20, height: 20 }}>
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </span>

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display:    'block',
            fontWeight: 700,
            fontSize:   '0.9rem',
            color:      allActive ? '#FFFFFF' : 'var(--color-brand-text)',
            fontFamily: 'var(--font-brand)',
            lineHeight: 1.2,
          }}>
            {t('catalog.allItems', 'All Items')}
          </span>
          {!allActive && (
            <span style={{ fontSize: '0.7rem', color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
              {total} {t('catalog.items', 'items')}
            </span>
          )}
        </span>

        <span style={{
          padding:      '2px 8px',
          borderRadius: 999,
          fontSize:     '0.71rem',
          fontWeight:   700,
          fontFamily:   'var(--font-brand)',
          background:   allActive ? 'rgba(255,255,255,0.25)' : 'var(--color-brand-badge-bg)',
          color:        allActive ? '#FFFFFF' : 'var(--color-brand-muted)',
          transition:   'all 200ms',
        }}>
          {total}
        </span>
      </button>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--ui-glass-border)', margin: '4px 6px 8px' }} />

      {/* Categories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {categories.map((cat) => {
          const active = cat.id === activeId;
          return (
            <button
              key={cat.id}
              onClick={() => onChange(cat.id)}
              aria-current={active ? 'page' : undefined}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          11,
                width:        '100%',
                padding:      '9px 12px',
                borderRadius: 'var(--sidebar-item-radius)',
                border:       'none',
                cursor:       'pointer',
                textAlign:    'left',
                transition:   'all 200ms ease',
                background:   active ? activeGradient : 'transparent',
                boxShadow:    active ? activeShadow : 'none',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-brand-surface)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <span style={{
                width: 42, height: 42,
                borderRadius:   'var(--radius-icon-wrap)',
                flexShrink:     0,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       '1.15rem',
                background:     active ? 'rgba(255,255,255,0.22)' : `rgba(${brandPrimaryRgb},0.10)`,
                transition:     'background 200ms',
              }}>
                {resolveCategoryIcon(cat.name, categoryIconMap)}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display:      'block',
                  fontWeight:   active ? 700 : 500,
                  fontSize:     '0.875rem',
                  color:        active ? '#FFFFFF' : 'var(--color-brand-text)',
                  fontFamily:   'var(--font-brand)',
                  lineHeight:   1.25,
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}>
                  {cat.name}
                </span>
                <span style={{
                  fontSize:   '0.7rem',
                  fontFamily: 'var(--font-brand)',
                  color:      active ? 'rgba(255,255,255,0.75)' : 'var(--color-brand-muted)',
                }}>
                  {cat.itemCount ?? 0} {t('catalog.items', 'items')}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Mobile category tabs ──────────────────────────────────────────────────────

function MobileTabs({
  categories, activeId, onChange, categoryIconMap,
}: {
  categories:     Category[];
  activeId:       string | null;
  onChange:       (id: string | null) => void;
  categoryIconMap?: Record<string, string>;
}) {
  const brandPrimaryRgb = useBrandCSSVar('--color-brand-primary-rgb');

  return (
    <div
      className="lg:hidden flex overflow-x-auto no-scrollbar gap-2 px-4 py-3 flex-shrink-0"
      style={{ borderBottom: '1px solid var(--ui-glass-border)', background: 'var(--color-ui-header)' }}
      role="tablist"
    >
      {[
        { id: null as string | null, icon: '▦', name: 'All' },
        ...categories.map(c => ({ id: c.id, icon: resolveCategoryIcon(c.name, categoryIconMap), name: c.name })),
      ].map(tab => {
        const active = tab.id === activeId;
        return (
          <button key={tab.id ?? '__all__'} role="tab" aria-selected={active}
            onClick={() => onChange(tab.id)}
            className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold font-brand whitespace-nowrap transition-all active:scale-95"
            style={active
              ? {
                  background: 'var(--gradient-cta)',
                  color:      'var(--color-brand-text-inverse)',
                  boxShadow:  `0 2px 10px rgba(${brandPrimaryRgb},0.30)`,
                }
              : {
                  background: 'var(--color-brand-surface)',
                  color:      'var(--color-brand-muted)',
                  border:     '1px solid var(--ui-glass-border)',
                }
            }
          >
            {tab.icon} {tab.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── Search bar ────────────────────────────────────────────────────────────────

const SEARCH_CSS = `
  @keyframes _hint-in  { from{opacity:0;transform:translateY(7px)}  to{opacity:1;transform:translateY(0)} }
  @keyframes _hint-out { from{opacity:1;transform:translateY(0)}    to{opacity:0;transform:translateY(-7px)} }
  @keyframes _sb-glow  {
    0%,100%{box-shadow:0 1px 4px rgba(0,0,0,0.05)}
    50%{box-shadow:0 2px 18px rgba(var(--color-brand-primary-rgb,245,158,11),0.15)}
  }
`;

function SearchBar({
  value, onChange, hints,
}: {
  value:   string;
  onChange:(v: string) => void;
  hints:   string[];
}) {
  const brandPrimary    = useBrandCSSVar('--color-brand-primary');
  const brandPrimaryRgb = useBrandCSSVar('--color-brand-primary-rgb');

  const [focused,  setFocused]  = useState(false);
  const [hintIdx,  setHintIdx]  = useState(0);
  const [hintAnim, setHintAnim] = useState<'in' | 'out'>('in');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (focused || value || hints.length === 0) return;
    const iv = setInterval(() => {
      setHintAnim('out');
      timer.current = setTimeout(() => {
        setHintIdx(i => (i + 1) % hints.length);
        setHintAnim('in');
      }, 300);
    }, 2800);
    return () => { clearInterval(iv); clearTimeout(timer.current); };
  }, [focused, value, hints.length]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SEARCH_CSS }} />
      <div style={{ flex: 1, minWidth: 0, maxWidth: 560 }}>
        <div
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            height:       50,
            borderRadius: 999,
            padding:      '0 18px',
            background:   focused ? 'var(--color-brand-surface)' : 'var(--color-brand-surface-alt)',
            border:       `1.5px solid ${focused ? brandPrimary : 'transparent'}`,
            boxShadow:    focused
              ? `0 0 0 3px rgba(${brandPrimaryRgb},0.12)`
              : '0 1px 4px rgba(0,0,0,0.05)',
            transition:   'all 200ms ease',
            animation:    (!focused && !value) ? '_sb-glow 4s ease-in-out 2s infinite' : 'none',
          }}
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={() => setFocused(false)}
        >
          <svg viewBox="0 0 24 24" fill="none"
            stroke={focused ? brandPrimary : 'var(--color-brand-muted)'}
            strokeWidth={2.2} strokeLinecap="round"
            style={{ width: 17, height: 17, flexShrink: 0, transition: 'stroke 200ms' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>

          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <input
              type="search"
              value={value}
              onChange={e => onChange(e.target.value)}
              aria-label={useTranslation().t('catalog.searchLabel', 'Search products')}
              autoComplete="off"
              className="font-brand w-full focus:outline-none"
              style={{ fontSize: 15, color: 'var(--color-brand-text)', background: 'transparent', border: 'none', outline: 'none', display: 'block' }}
            />
            {!value && hints.length > 0 && (
              <div aria-hidden="true" style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center',
                pointerEvents: 'none', overflow: 'hidden',
                animation: `_hint-${hintAnim} 300ms ease both`,
              }}>
                <span style={{ fontSize: 15, color: 'var(--color-brand-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {hints[hintIdx]}
                </span>
              </div>
            )}
          </div>

          {value && (
            <button onClick={() => onChange('')} aria-label="Clear search"
              style={{
                width: 20, height: 20, borderRadius: '50%',
                background: 'var(--color-brand-border)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-muted)" strokeWidth={3} strokeLinecap="round"
                style={{ width: 9, height: 9 }}>
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────────

function Header({
  search, onSearchChange, onSettingsClick, hints,
}: {
  search:           string;
  onSearchChange:   (v: string) => void;
  onSettingsClick:  () => void;
  hints:            string[];
}) {
  const displayName   = useKioskName();
  const logoUrl       = useSettingsStore(s => s.theme.logoUrl);
  const tagline       = useSettingsStore(s => s.theme.tagline ?? '');
  const itemCount     = useCartStore(s => s.items.reduce((n, i) => n + i.quantity, 0));
  const openCart      = useCartDrawerStore(s => s.open);
  const history       = useHistory();
  const brandPrimary  = useBrandCSSVar('--color-brand-primary');
  const brandPrimaryRgb = useBrandCSSVar('--color-brand-primary-rgb');

  return (
    <header style={{
      background:   'var(--color-ui-header)',
      borderBottom: '1px solid var(--ui-glass-border)',
      boxShadow:    '0 2px 16px rgba(0,0,0,0.05)',
      flexShrink:   0,
      zIndex:       20,
      position:     'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', height: 76, padding: '0 24px', gap: 16 }}>

        {/* Logo + name */}
        <button onClick={() => history.replace('/attract')} aria-label="Home"
          style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, flexShrink: 0,
            background:  logoUrl ? 'var(--color-ui-card)' : 'var(--gradient-cta)',
            border:      logoUrl ? '1.5px solid var(--ui-glass-border)' : 'none',
            boxShadow:   '0 3px 12px rgba(0,0,0,0.12)',
            display:     'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            {logoUrl ? (
              <img src={logoUrl} alt={displayName}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round"
                style={{ width: 30, height: 30 }}>
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            )}
          </div>
          <div className="hidden sm:flex flex-col" style={{ maxWidth: 200 }}>
            <span style={{
              fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-brand-text)',
              letterSpacing: '-0.02em', lineHeight: 1.2,
              fontFamily: 'var(--font-brand)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{displayName}</span>
            {tagline && (
              <span style={{
                fontWeight: 500, fontSize: '0.72rem', color: 'var(--color-brand-muted)', marginTop: 1,
                fontFamily: 'var(--font-brand)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{tagline}</span>
            )}
          </div>
        </button>

        {/* Search */}
        <SearchBar value={search} onChange={onSearchChange} hints={hints} />

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>

          {/* Cart button */}
          <div style={{ position: 'relative' }}>
            <button onClick={openCart} aria-label={`Cart — ${itemCount} items`}
              style={{
                width: 48, height: 48, borderRadius: '50%',
                background:  'var(--gradient-cta)',
                boxShadow:   `0 4px 16px rgba(${brandPrimaryRgb},0.42)`,
                border:      'none', cursor: 'pointer', flexShrink: 0,
                display:     'flex', alignItems: 'center', justifyContent: 'center',
                transition:  'opacity var(--transition-base)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-text-inverse)" strokeWidth={2} strokeLinecap="round"
                style={{ width: 22, height: 22 }}>
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
            </button>
            {itemCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, insetInlineEnd: -4,
                minWidth: 20, height: 20, padding: '0 4px', borderRadius: 10,
                background: 'var(--color-ui-card)', color: brandPrimary,
                fontSize: 11, fontWeight: 800, lineHeight: 1,
                border: `2px solid ${brandPrimary}`, boxShadow: '0 1px 5px rgba(0,0,0,0.14)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-brand)', pointerEvents: 'none',
              }}>
                {itemCount}
              </span>
            )}
          </div>

          {/* Settings */}
          <button onClick={onSettingsClick} aria-label="Staff settings"
            style={{
              width: 42, height: 42, borderRadius: '50%',
              border: '1.5px solid var(--ui-glass-border)', background: 'var(--color-brand-surface)',
              cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background var(--transition-base), border-color var(--transition-base)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background   = brandPrimary;
              el.style.borderColor  = brandPrimary;
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background   = 'var(--color-brand-surface)';
              el.style.borderColor  = 'var(--ui-glass-border)';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--color-brand-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>

          <LanguageSelector variant="header" />
        </div>
      </div>
    </header>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  const { t } = useTranslation();
  return (
    <div style={{
      flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexWrap: 'wrap', gap: '4px 20px',
      padding: '9px 24px',
      background: 'var(--color-ui-header)',
      borderTop: '1px solid var(--ui-glass-border)',
      boxShadow: '0 -1px 8px rgba(0,0,0,0.04)',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.73rem', color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {t('attract.footerHelp', 'Need assistance? Press the help button on the side.')}
      </span>
      <div style={{ width: 1, height: 14, background: 'var(--color-brand-border)' }} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.73rem', color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
        </svg>
        {t('attract.footerLang', 'We serve you in multiple languages.')}
      </span>
    </div>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', background: 'var(--color-brand-bg)' }}>
      {/* Sidebar skeleton */}
      <div className="hidden lg:flex flex-col gap-2 p-3 flex-shrink-0"
        style={{ width: 'var(--sidebar-width)', background: 'var(--color-ui-sidebar)', borderInlineEnd: '1px solid var(--ui-glass-border)' }}>
        <div style={{ height: 10, width: 40, borderRadius: 4, background: 'var(--color-brand-border)', margin: '4px 4px 8px' }} />
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{
            height: 56, borderRadius: 14,
            background: i === 0 ? 'var(--gradient-cta)' : 'var(--color-brand-surface)',
            opacity: i === 0 ? 1 : 0.7,
            animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
            animationDelay: `${i * 80}ms`,
          }} />
        ))}
      </div>
      {/* Grid skeleton */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(196px,44%),1fr))', gap: 14, padding: '16px 18px', alignContent: 'start' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{
            borderRadius: 'var(--radius-brand-card)', overflow: 'hidden', background: 'var(--color-ui-card)',
            boxShadow: 'var(--card-shadow)',
            animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
            animationDelay: `${i * 60}ms`,
          }}>
            <div style={{ paddingTop: '70%', background: 'var(--gradient-placeholder)' }} />
            <div style={{ padding: '10px 12px 13px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 13, borderRadius: 5, background: 'var(--color-brand-border)', width: '70%' }} />
              <div style={{ height: 10, borderRadius: 5, background: 'var(--color-brand-surface)', width: '45%' }} />
              <div style={{ height: 32, borderRadius: 999, background: 'var(--color-brand-border)', marginTop: 2 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '80px 32px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(239,68,68,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-error)" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-brand-text)', fontFamily: 'var(--font-brand)' }}>
        {t('catalog.loadError', 'Unable to load catalog')}
      </p>
      <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
        {t('catalog.loadErrorHint', 'Please check your connection and try again.')}
      </p>
      <button onClick={onRetry} className="ui-btn-primary px-8 py-3 text-sm">{t('common.retry', 'Retry')}</button>
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptySearch({ term }: { term: string }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', textAlign: 'center' }}>
      <svg aria-hidden="true" style={{ width: 64, height: 64, color: 'var(--color-brand-border)', marginBottom: 16 }} viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth={1.4}>
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '1rem', color: 'var(--color-brand-text)', fontFamily: 'var(--font-brand)' }}>
        {t('catalog.noResults', 'No results for "{{term}}"', { term })}
      </p>
      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
        {t('catalog.noResultsHint', 'Try a different category or search term')}
      </p>
    </div>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function CatalogScreen() {
  const location    = useLocation<CatalogNavState>();
  const history     = useHistory();
  const isLandscape = useIsLandscape();
  const { t }       = useTranslation();
  const { environment } = useBrand();

  const brandPrimaryRgb = useBrandCSSVar('--color-brand-primary-rgb');

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchInput,    setSearchInput]    = useState('');
  const [modalProduct,   setModalProduct]   = useState<Product | null>(null);
  const [pinOpen,        setPinOpen]        = useState(false);
  const [panelContainer, setPanelContainer] = useState<HTMLDivElement | null>(null);
  const panelContainerCb = useCallback((el: HTMLDivElement | null) => setPanelContainer(el), []);

  const panelOpen  = isLandscape && modalProduct !== null;
  const searchTerm = useDebounce(searchInput, 300);
  const scrollRef  = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useCatalog();
  const categories  = data?.categories ?? [];
  const products    = useFilteredProducts(data?.products, activeCategory, searchTerm);

  // Brand-specific config
  const categoryIconMap = environment.categoryIconMap;
  const hints = environment.searchHints ?? [t('catalog.searchHint', 'Search products…')];

  useIonViewWillEnter(() => { void loadCatalog(); });

  useEffect(() => {
    const { highlightProductId, highlightCategoryId } = location.state ?? {};
    if (!highlightProductId || !data) return;
    if (highlightCategoryId) setActiveCategory(highlightCategoryId);
    const timer = setTimeout(() => {
      const el = document.getElementById(`product-${highlightProductId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('product-highlight');
      setTimeout(() => el.classList.remove('product-highlight'), 2200);
    }, 350);
    return () => clearTimeout(timer);
  }, [location.state, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = useCallback(() => { void loadCatalog(); }, []);

  const handleCategoryChange = useCallback((id: string | null) => {
    setActiveCategory(id);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const activeName = activeCategory
    ? (categories.find(c => c.id === activeCategory)?.name ?? '')
    : t('catalog.allItems', 'All Items');

  const showSidebar = !searchTerm && categories.length > 0;

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--color-brand-bg)' }}>

          <Header
            search={searchInput}
            onSearchChange={setSearchInput}
            onSettingsClick={() => setPinOpen(true)}
            hints={hints}
          />

          {/* Mobile tabs */}
          {!searchTerm && categories.length > 0 && (
            <MobileTabs
              categories={categories}
              activeId={activeCategory}
              onChange={handleCategoryChange}
              categoryIconMap={categoryIconMap}
            />
          )}

          {/* Body */}
          {isLoading && !data ? (
            <LoadingSkeleton />
          ) : (
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

              {showSidebar && (
                <Sidebar
                  categories={categories}
                  activeId={activeCategory}
                  onChange={handleCategoryChange}
                  categoryIconMap={categoryIconMap}
                />
              )}

              <div style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>

                {/* Scroll container */}
                <div ref={scrollRef} style={{
                  flex:      panelOpen ? '0 0 58%' : '1 1 auto',
                  minWidth:  0,
                  overflowY: 'auto', overflowX: 'hidden',
                  transition: 'flex-basis var(--transition-layout)',
                }}>
                  {/* Section heading */}
                  {!searchTerm ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 18px 10px' }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 11,
                        background:  'var(--color-brand-primary)',
                        boxShadow:   `0 2px 10px rgba(${brandPrimaryRgb},0.30)`,
                        display:     'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {/* Active category icon or generic grid icon */}
                        {activeCategory ? (
                          <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>
                            {resolveCategoryIcon(activeName, categoryIconMap)}
                          </span>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round"
                            style={{ width: 18, height: 18 }}>
                            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                          </svg>
                        )}
                      </div>
                      <h2 style={{
                        margin: 0, fontWeight: 800,
                        fontSize: 'var(--font-size-heading)',
                        color: 'var(--color-brand-text)', letterSpacing: '-0.025em', fontFamily: 'var(--font-brand)',
                      }}>
                        {activeName}
                      </h2>
                      {products.length > 0 && (
                        <span style={{
                          padding: '3px 10px', borderRadius: 999,
                          background: 'var(--color-brand-badge-bg)', color: 'var(--color-brand-muted)',
                          fontSize: '0.76rem', fontWeight: 700, fontFamily: 'var(--font-brand)',
                        }}>
                          {products.length}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '16px 18px 8px' }}>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
                        {products.length > 0
                          ? `${products.length} result${products.length !== 1 ? 's' : ''} for "${searchTerm}"`
                          : null}
                      </p>
                      {products.length === 0 && <EmptySearch term={searchTerm} />}
                    </div>
                  )}

                  {isError ? (
                    <ErrorState onRetry={handleRetry} />
                  ) : products.length > 0 || searchTerm ? (
                    <ProductGrid
                      products={products}
                      onOpenModal={setModalProduct}
                      loading={isLoading}
                      virtualScroll={false}
                    />
                  ) : null}
                </div>

                {/* Landscape detail panel */}
                <div
                  ref={panelContainerCb}
                  style={{
                    flex:              panelOpen ? '0 0 42%' : '0 0 0px',
                    overflow:          'hidden', minWidth: 0,
                    display:           'flex', flexDirection: 'column',
                    borderInlineStart: panelOpen ? '1px solid var(--ui-glass-border)' : 'none',
                    transition:        'flex-basis var(--transition-layout)',
                    background:        'var(--color-ui-card)',
                  }}
                />
              </div>
            </div>
          )}

          <Footer />
        </div>

        <ProductModal
          product={modalProduct}
          isOpen={modalProduct !== null}
          onClose={() => setModalProduct(null)}
          landscapeContainer={panelContainer}
        />
        <StaffPinModal
          isOpen={pinOpen}
          onSuccess={() => { setPinOpen(false); history.replace('/settings'); }}
          onCancel={() => setPinOpen(false)}
        />
      </IonContent>
    </IonPage>
  );
}
