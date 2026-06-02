// src/screens/CatalogScreen.tsx
// Catalog screen: sidebar categories (from menu organizer API) + product grid.
// All data is fetched once via useCatalog() and filtered client-side.
// The "All" tab shows every product; category tabs filter by categoryId.

import { useState, useEffect, useCallback, useRef } from 'react';
import { IonPage, IonContent, useIonViewWillEnter } from '@ionic/react';
import { useHistory, useLocation } from 'react-router-dom';
import { useCatalog, useFilteredProducts } from '@/modules/catalog/hooks/useCatalog';
import { loadCatalog } from '@/services/catalog.service';
import { useCartStore } from '@/store/cartStore';
import { useCartDrawerStore } from '@/store/cartDrawerStore';
import { useDebounce } from '@/modules/catalog/hooks/useDebounce';
import { useBrand } from '@/hooks/useBrand';
import { useIsLandscape } from '@/hooks/useOrientation';
import StaffPinModal from '@/components/StaffPinModal';
import { useStoreConfigStore } from '@/store/storeConfigStore';
import { useKioskChannelStore } from '@/store/kioskChannelStore';
import ProductGrid from '@/modules/catalog/ProductGrid';
import ProductModal from '@/modules/catalog/ProductModal';
import { formatPrice } from '@/utils/format';
import type { Product, Category } from '@/types/catalog';

interface CatalogNavState {
  highlightProductId?: string;
  highlightCategoryId?: string;
}

// ─── Category icon resolver ────────────────────────────────────────────────────
// Derives an emoji icon from the category name.
// No hardcoded IDs — purely name-based so it works for any brand.

function getCategoryIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('burger') || n.includes('sandwich'))  return '🍔';
  if (n.includes('chicken') || n.includes('wing'))     return '🍗';
  if (n.includes('bowl') || n.includes('rice'))        return '🥗';
  if (n.includes('side') || n.includes('frie') || n.includes('appetizer')) return '🍟';
  if (n.includes('drink') || n.includes('beverage') || n.includes('juice')) return '🥤';
  if (n.includes('dessert') || n.includes('sweet') || n.includes('cake'))   return '🍰';
  if (n.includes('pizza') || n.includes('flatbread'))  return '🍕';
  if (n.includes('salad') || n.includes('veggie') || n.includes('veg'))     return '🥦';
  if (n.includes('coffee') || n.includes('tea'))       return '☕';
  if (n.includes('combo') || n.includes('meal') || n.includes('special'))   return '🍱';
  if (n.includes('soup'))                               return '🍲';
  if (n.includes('wrap') || n.includes('taco') || n.includes('burrito'))    return '🌮';
  if (n.includes('seafood') || n.includes('fish') || n.includes('shrimp'))  return '🦐';
  if (n.includes('steak') || n.includes('beef') || n.includes('meat'))      return '🥩';
  if (n.includes('pasta') || n.includes('noodle'))     return '🍝';
  return '🍽';
}

// ─── Category gradient palette ─────────────────────────────────────────────────
// Cycles through 8 colours — mirrors storefront's nth-child gradient cards.
// Used for icon badge backgrounds in the sidebar.

const CAT_ICON_COLORS = [
  '#F97316', // orange
  '#EF4444', // red
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#F59E0B', // amber
  '#6366F1', // indigo
  '#06B6D4', // cyan
];

// ─── Sidebar (lg+ / kiosk) ────────────────────────────────────────────────────

function CategorySidebar({
  categories,
  activeId,
  storeName,
  onChange,
}: {
  categories: Category[];
  activeId:   string | null;
  storeName:  string;
  onChange:   (id: string | null) => void;
}) {
  const active_all = activeId === null;
  // Source home.page.ts: is_active filter is COMMENTED OUT — show all categories.
  const visibleCats = categories;

  return (
    <nav
      aria-label="Menu categories"
      className="hidden lg:flex flex-col flex-shrink-0 w-60 h-full overflow-y-auto no-scrollbar py-3 gap-0.5 px-3"
      style={{ background: 'var(--color-ui-card)', borderRight: '1px solid var(--ui-glass-border)' }}
    >
      {/* Store name header */}
      {storeName && (
        <div className="px-3 pb-3 pt-1">
          <p className="text-xs font-bold font-brand uppercase tracking-widest truncate"
            style={{ color: 'var(--color-brand-muted)' }}>
            {storeName}
          </p>
        </div>
      )}

      {/* "All" tab */}
      <button
        onClick={() => onChange(null)}
        aria-current={active_all ? 'true' : undefined}
        className="flex items-center gap-3 px-3 py-3 text-left rounded-2xl transition-all duration-150"
        style={active_all ? {
          background: 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
          color:      'white',
          fontWeight: 700,
          boxShadow:  '0 4px 16px rgba(245,158,11,0.28)',
        } : {
          color:      'var(--color-brand-text)',
          background: 'transparent',
          fontWeight: 500,
        }}
      >
        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg leading-none flex-shrink-0"
          style={active_all
            ? { background: 'rgba(255,255,255,0.2)' }
            : { background: 'rgba(245,158,11,0.12)' }}
          aria-hidden="true"
        >
          🍽
        </span>
        <span className="flex flex-col min-w-0">
          <span className="font-brand text-sm leading-tight">All Items</span>
          {!active_all && (
            <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>
              {categories.reduce((n, c) => n + (c.itemCount ?? 0), 0)} items
            </span>
          )}
        </span>
      </button>

      {/* Dynamic categories from API — source has is_active filter COMMENTED OUT, show all */}
      {visibleCats.map((cat, idx) => {
        const active    = cat.id === activeId;
        const iconColor = CAT_ICON_COLORS[idx % CAT_ICON_COLORS.length];
        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            aria-current={active ? 'true' : undefined}
            className="flex items-center gap-3 px-3 py-3 text-left rounded-2xl transition-all duration-150"
            style={active ? {
              background: 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
              color:      'white',
              fontWeight: 700,
              boxShadow:  '0 4px 16px rgba(245,158,11,0.28)',
            } : {
              color:      'var(--color-brand-text)',
              background: 'transparent',
              fontWeight: 500,
            }}
          >
            {/* Gradient icon badge — cycles through CAT_ICON_COLORS */}
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg leading-none flex-shrink-0"
              style={active
                ? { background: 'rgba(255,255,255,0.2)' }
                : { background: `${iconColor}22` }}
              aria-hidden="true"
            >
              {getCategoryIcon(cat.name)}
            </span>

            {/* Name + item count — mirrors storefront {{cat.itemsCount || '0'}} items */}
            <span className="flex flex-col min-w-0">
              <span className="font-brand text-sm leading-tight line-clamp-2">{cat.name}</span>
              <span
                className="text-xs mt-0.5"
                style={{ color: active ? 'rgba(255,255,255,0.72)' : 'var(--color-brand-muted)' }}
              >
                {cat.itemCount ?? 0} items
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Mobile horizontal tabs ────────────────────────────────────────────────────

function CategoryTabs({
  categories,
  activeId,
  onChange,
}: {
  categories: Category[];
  activeId:   string | null;
  onChange:   (id: string | null) => void;
}) {
  return (
    <div
      className="lg:hidden flex overflow-x-auto no-scrollbar gap-2 px-4 py-3 flex-shrink-0"
      style={{ borderBottom: '1px solid var(--ui-glass-border)' }}
      role="tablist"
      aria-label="Menu categories"
    >
      {/* All tab */}
      <button
        role="tab"
        aria-selected={activeId === null}
        onClick={() => onChange(null)}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold font-brand flex-shrink-0 whitespace-nowrap transition-all active:scale-95"
        style={activeId === null ? {
          background:  'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
          color:       'white',
          boxShadow:   '0 2px 10px rgba(245,158,11,0.30)',
        } : {
          background:  'var(--color-ui-card)',
          color:       'var(--color-brand-muted)',
          border:      '1px solid var(--ui-glass-border)',
        }}
      >
        <span aria-hidden="true">🍽</span>All
      </button>

      {/* Dynamic category tabs — source shows all categories regardless of is_active */}
      {categories.map((cat) => {
        const active = cat.id === activeId;
        return (
          <button
            key={cat.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(cat.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold font-brand flex-shrink-0 whitespace-nowrap transition-all active:scale-95"
            style={active ? {
              background: 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
              color:      'white',
              boxShadow:  '0 2px 10px rgba(245,158,11,0.30)',
            } : {
              background: 'var(--color-ui-card)',
              color:      'var(--color-brand-muted)',
              border:     '1px solid var(--ui-glass-border)',
            }}
          >
            <span aria-hidden="true">{getCategoryIcon(cat.name)}</span>
            {cat.name}
            {(cat.itemCount ?? 0) > 0 && (
              <span
                className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={active
                  ? { background: 'rgba(255,255,255,0.25)', color: 'white' }
                  : { background: 'var(--color-brand-surface)', color: 'var(--color-brand-muted)' }}
              >
                {cat.itemCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Search bar — cycling hints + CSS keyframe animations ─────────────────────

const SEARCH_HINTS = [
  'What are you craving?',
  'Search for chicken wings…',
  'Try a crispy burger…',
  'Looking for desserts?',
  'Find your favorites…',
  'Explore our pizzas…',
];

const SEARCH_CSS = `
  @keyframes ksk-pulse {
    0%, 100% { box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
    50%       { box-shadow: 0 2px 16px rgba(245,158,11,0.18); }
  }
  @keyframes ksk-hint-in {
    from { opacity: 0; transform: translateY(8px);  }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes ksk-hint-out {
    from { opacity: 1; transform: translateY(0);    }
    to   { opacity: 0; transform: translateY(-8px); }
  }
  @keyframes ksk-icon-bounce {
    0%   { transform: scale(1)    rotate(0deg);   }
    28%  { transform: scale(1.32) rotate(-12deg); }
    60%  { transform: scale(0.90) rotate(6deg);   }
    82%  { transform: scale(1.08) rotate(-2deg);  }
    100% { transform: scale(1.12) rotate(0deg);   }
  }
  @keyframes ksk-clear-pop {
    0%   { transform: scale(0.3); opacity: 0; }
    55%  { transform: scale(1.22);            }
    80%  { transform: scale(0.94);            }
    100% { transform: scale(1);   opacity: 1; }
  }
  @keyframes ksk-bar-expand {
    from { transform: scaleX(0.97); opacity: 0.7; }
    to   { transform: scaleX(1);    opacity: 1;   }
  }
`;

function ModernSearchBar({
  search,
  onSearchChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
}) {
  const [focused,     setFocused]     = useState(false);
  const [hintIdx,     setHintIdx]     = useState(0);
  const [hintPhase,   setHintPhase]   = useState<'in' | 'out'>('in');
  const [iconBounce,  setIconBounce]  = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout>>();

  // Cycle placeholder hints every 2.8 s while idle
  useEffect(() => {
    if (focused || search) return;
    const iv = setInterval(() => {
      setHintPhase('out');
      hintTimer.current = setTimeout(() => {
        setHintIdx((i) => (i + 1) % SEARCH_HINTS.length);
        setHintPhase('in');
      }, 360);
    }, 2800);
    return () => {
      clearInterval(iv);
      clearTimeout(hintTimer.current);
    };
  }, [focused, search]);

  // One-shot icon bounce on focus
  useEffect(() => {
    if (!focused) return;
    setIconBounce(true);
    const t = setTimeout(() => setIconBounce(false), 500);
    return () => clearTimeout(t);
  }, [focused]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SEARCH_CSS }} />

      <div className="flex-1" style={{ minWidth: 0, maxWidth: '560px' }}>
        {/* Outer wrapper — drives idle pulse & focus ring via transition */}
        <div
          style={{
            borderRadius: '999px',
            padding:      '3px',
            background:   focused
              ? 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)'
              : 'transparent',
            boxShadow:    focused
              ? '0 6px 28px rgba(245,158,11,0.22)'
              : undefined,
            animation:    (!focused && !search)
              ? 'ksk-pulse 3.5s ease-in-out 1.5s infinite'
              : 'none',
            transition:   'background 220ms ease, box-shadow 220ms ease',
          }}
          onFocusCapture={() => setFocused(true)}
          onBlurCapture={() => setFocused(false)}
        >
          {/* Inner pill */}
          <div
            className="flex items-center px-4"
            style={{
              height:       '48px',
              borderRadius: '999px',
              background:   focused ? '#FFFBF0' : '#F1F5F9',
              gap:          '10px',
              animation:    focused ? 'ksk-bar-expand 220ms cubic-bezier(0.34,1.56,0.64,1)' : 'none',
              transition:   'background 200ms ease',
            }}
          >
            {/* Search icon — bounces on focus */}
            <div
              aria-hidden="true"
              style={{
                flexShrink: 0,
                lineHeight: 0,
                animation:  iconBounce
                  ? 'ksk-icon-bounce 480ms cubic-bezier(0.34,1.56,0.64,1) forwards'
                  : 'none',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                style={{
                  width:      '17px',
                  height:     '17px',
                  color:      focused ? '#F59E0B' : '#94A3B8',
                  transition: 'color 200ms ease',
                  display:    'block',
                }}
              >
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>

            {/* Input + cycling placeholder overlay */}
            <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                aria-label="Search menu items"
                autoComplete="off"
                className="font-brand focus:outline-none w-full"
                style={{
                  fontSize:   '15px',
                  color:      '#1F2937',
                  fontWeight: search ? 500 : 400,
                  background: 'transparent',
                  border:     'none',
                  outline:    'none',
                  display:    'block',
                }}
              />
              {/* Animated cycling hint — shown only when empty */}
              {!search && (
                <div
                  aria-hidden="true"
                  style={{
                    position:      'absolute',
                    inset:         0,
                    display:       'flex',
                    alignItems:    'center',
                    pointerEvents: 'none',
                    overflow:      'hidden',
                    animation:     `ksk-hint-${hintPhase} 360ms cubic-bezier(0.4,0,0.2,1) forwards`,
                  }}
                >
                  <span style={{
                    fontSize:     '15px',
                    color:        '#94A3B8',
                    whiteSpace:   'nowrap',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {SEARCH_HINTS[hintIdx]}
                  </span>
                </div>
              )}
            </div>

            {/* Animated clear button */}
            {search && (
              <button
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                style={{
                  flexShrink:     0,
                  width:          '22px',
                  height:         '22px',
                  borderRadius:   '50%',
                  background:     focused ? 'rgba(245,158,11,0.18)' : '#E2E8F0',
                  border:         'none',
                  cursor:         'pointer',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  animation:      'ksk-clear-pop 320ms cubic-bezier(0.34,1.56,0.64,1) forwards',
                  transition:     'background 180ms ease',
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={focused ? '#F59E0B' : '#64748B'}
                  strokeWidth={3}
                  strokeLinecap="round"
                  style={{ width: '10px', height: '10px', display: 'block' }}
                >
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Top header ────────────────────────────────────────────────────────────────

function CatalogHeader({
  search,
  onSearchChange,
  onSettingsClick,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  onSettingsClick: () => void;
}) {
  const { environment }  = useBrand();
  const channel          = useKioskChannelStore((s) => s.channel);
  // Header shows channel name (e.g. "Spice Kitchen Kiosk") — more specific than brand name
  const displayName      = channel?.name || environment.displayName;
  const itemCount        = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const openCart         = useCartDrawerStore((s) => s.open);
  const history          = useHistory();

  return (
    <header
      className="flex-shrink-0"
      style={{
        background:   '#FFFFFF',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        boxShadow:    '0 1px 12px rgba(0,0,0,0.05)',
        position:     'relative',
        zIndex:       10,
      }}
    >
      <div
        className="flex items-center mx-auto"
        style={{
          height:  '76px',
          maxWidth:'1400px',
          padding: '0 28px',
          gap:     '20px',
        }}
      >

        {/* ── Brand ───────────────────────────────────────────────────── */}
        <button
          onClick={() => history.replace('/attract')}
          aria-label="Back to home"
          className="flex items-center gap-3 flex-shrink-0 transition-opacity active:opacity-60"
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <div
            style={{
              width:          '44px',
              height:         '44px',
              borderRadius:   '13px',
              background:     'linear-gradient(145deg, #FBBF24 0%, #F97316 100%)',
              boxShadow:      '0 4px 14px rgba(245,158,11,0.36)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
            }}
          >
            <span className="font-brand font-black text-white" style={{ fontSize: '21px', lineHeight: 1 }}>
              {displayName[0].toUpperCase()}
            </span>
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="font-brand font-bold leading-tight"
              style={{ fontSize: '16px', color: '#111827', letterSpacing: '-0.3px', whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName}
            </span>
          </div>
        </button>

        {/* ── Modern animated search bar ───────────────────────────────── */}
        <ModernSearchBar search={search} onSearchChange={onSearchChange} />

        {/* ── Cart + Help ──────────────────────────────────────────────── */}
        <div
          className="flex items-center flex-shrink-0"
          style={{ gap: '12px', paddingLeft: '4px' }}
        >
          {/* Cart — amber circle with floating count badge */}
          <div className="relative">
            <button
              onClick={openCart}
              aria-label={`Open cart — ${itemCount} items`}
              className="flex items-center justify-center transition-all active:scale-90"
              style={{
                width:        '48px',
                height:       '48px',
                borderRadius: '50%',
                background:   'linear-gradient(145deg, #FBBF24 0%, #F97316 100%)',
                boxShadow:    '0 4px 16px rgba(245,158,11,0.42)',
                border:       'none',
                cursor:       'pointer',
                flexShrink:   0,
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={2}
                strokeLinecap="round"
                style={{ width: '22px', height: '22px' }}
              >
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
            </button>

            {/* Count badge — floats over top-right corner */}
            {itemCount > 0 && (
              <span
                className="absolute flex items-center justify-center font-black tabular-nums pointer-events-none"
                style={{
                  top:          '-4px',
                  right:        '-4px',
                  minWidth:     '20px',
                  height:       '20px',
                  padding:      '0 5px',
                  borderRadius: '10px',
                  background:   '#FCD34D',
                  color:        '#78350F',
                  fontSize:     '11px',
                  lineHeight:   1,
                  border:       '2px solid #FFFFFF',
                  boxShadow:    '0 1px 5px rgba(0,0,0,0.16)',
                }}
              >
                {itemCount}
              </span>
            )}
          </div>

          {/* Staff settings gear */}
          <button
            onClick={onSettingsClick}
            aria-label="Staff settings"
            className="flex items-center justify-center transition-all active:scale-90"
            style={{
              width:        '42px',
              height:       '42px',
              borderRadius: '50%',
              border:       '1.5px solid rgba(0,0,0,0.10)',
              background:   'transparent',
              color:        '#94A3B8',
              flexShrink:   0,
              cursor:       'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
        </div>

      </div>
    </header>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-brand-bg)' }}>
      {/* Shimmer header strip */}
      <div className="flex-shrink-0 h-14 px-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--ui-glass-border)' }}>
        <div className="w-9 h-9 rounded-xl animate-pulse" style={{ background: 'var(--color-brand-border)' }} />
        <div className="flex-1 h-8 rounded-full animate-pulse" style={{ background: 'var(--color-brand-border)' }} />
        <div className="w-24 h-9 rounded-full animate-pulse" style={{ background: 'var(--color-brand-border)' }} />
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="hidden lg:flex flex-col gap-2 w-56 p-3 flex-shrink-0"
          style={{ background: 'var(--color-ui-card)', borderRight: '1px solid var(--ui-glass-border)' }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-12 rounded-2xl animate-pulse"
              style={{ background: 'var(--color-brand-border)', animationDelay: `${i * 60}ms` }} />
          ))}
        </div>

        {/* Product grid skeleton */}
        <div className="flex-1 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden animate-pulse"
              style={{ background: 'var(--color-ui-card)', animationDelay: `${i * 40}ms` }}>
              <div className="h-36" style={{ background: 'var(--color-brand-border)' }} />
              <div className="p-3 flex flex-col gap-2">
                <div className="h-4 rounded" style={{ background: 'var(--color-brand-border)', width: '75%' }} />
                <div className="h-3 rounded" style={{ background: 'var(--color-brand-border)', width: '55%' }} />
                <div className="h-8 rounded-xl mt-1" style={{ background: 'var(--color-brand-border)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center flex-1 py-20 px-8 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(239,68,68,0.12)' }}>
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
          style={{ color: 'var(--color-brand-error)' }}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p className="text-lg font-bold font-brand mb-1" style={{ color: 'var(--color-brand-text)' }}>
        Unable to load menu
      </p>
      <p className="text-sm font-brand mb-6" style={{ color: 'var(--color-brand-muted)' }}>
        Please check your connection and try again.
      </p>
      <button onClick={onRetry} className="ui-btn-primary px-8 py-3 text-sm">
        Retry
      </button>
    </div>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function CatalogScreen() {
  const location                = useLocation<CatalogNavState>();
  const routerHistory           = useHistory();
  const isLandscape = useIsLandscape();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [searchInput,      setSearchInput]       = useState('');
  const [modalProduct,     setModalProduct]      = useState<Product | null>(null);
  const [pinOpen,          setPinOpen]           = useState(false);

  // panelContainer: the DOM node ProductModal portals into for landscape mode.
  // Using state (not ref) so React re-renders when the element is mounted.
  const [panelContainer, setPanelContainer] = useState<HTMLDivElement | null>(null);
  const panelContainerCb = useCallback((el: HTMLDivElement | null) => setPanelContainer(el), []);

  const panelOpen = isLandscape && modalProduct !== null;
  const searchTerm = useDebounce(searchInput, 300);
  const contentRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useCatalog();
  const categories = data?.categories ?? [];
  const products   = useFilteredProducts(data?.products, activeCategoryId, searchTerm);

  // TRIGGER: fires on EVERY Ionic page activation (fresh mount OR Ionic keep-alive reveal).
  useIonViewWillEnter(() => {
    console.log('[CatalogScreen] ionViewWillEnter → loadCatalog()');
    void loadCatalog();
  });

  // Highlight + scroll when arriving from "Menu Highlights" product strip
  useEffect(() => {
    const { highlightProductId, highlightCategoryId } = location.state ?? {};
    if (!highlightProductId || !data) return;

    // Switch to that product's category first
    if (highlightCategoryId) setActiveCategoryId(highlightCategoryId);

    // Wait for the grid to render, then scroll + pulse
    const timer = setTimeout(() => {
      const el = document.getElementById(`product-${highlightProductId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('product-highlight');
      setTimeout(() => el.classList.remove('product-highlight'), 2200);
    }, 350);

    return () => clearTimeout(timer);
  }, [location.state, data]); // eslint-disable-line react-hooks/exhaustive-deps

  // TRIGGER: Retry button — always calls loadCatalog() fresh
  const handleRetry = useCallback(() => {
    console.log('[CatalogScreen] Retry → loadCatalog()');
    void loadCatalog();
  }, []);

  // Store name from config for sidebar header
  const storeName = useStoreConfigStore((s) => s.store?.name ?? '');

  const handleCategoryChange = useCallback((id: string | null) => {
    setActiveCategoryId(id);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const activeCategoryName = activeCategoryId
    ? (categories.find((c) => c.id === activeCategoryId)?.name ?? '')
    : 'All Items';

  // Show loading skeleton on initial load (no data yet)
  if (isLoading && !data) {
    return (
      <IonPage>
        <IonContent fullscreen scrollY={false}>
          <div className="h-full">
            <CatalogHeader search={searchInput} onSearchChange={setSearchInput} onSettingsClick={() => setPinOpen(true)} />
            <div className="flex-1">
              <LoadingSkeleton />
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--color-brand-bg)' }}>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <CatalogHeader search={searchInput} onSearchChange={setSearchInput} onSettingsClick={() => setPinOpen(true)} />

          {/* ── Mobile category tabs (hidden while searching) ─────────── */}
          {!searchTerm && categories.length > 0 && (
            <CategoryTabs
              categories={categories}
              activeId={activeCategoryId}
              onChange={handleCategoryChange}
            />
          )}

          {/* ── Main content area ─────────────────────────────────────── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Sidebar (kiosk / desktop, hidden while searching) */}
            {!searchTerm && categories.length > 0 && (
              <CategorySidebar
                categories={categories}
                activeId={activeCategoryId}
                storeName={storeName}
                onChange={handleCategoryChange}
              />
            )}

            {/* Inner split: grid (left) + optional detail panel (right) */}
            <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden">

            {/* Products grid — shrinks to 70 % when landscape panel is open */}
            <div
              ref={contentRef}
              className="overflow-y-auto overflow-x-hidden"
              style={{
                flex: panelOpen ? '0 0 58%' : '1 1 auto',
                minWidth: 0,
                transition: 'flex-basis 280ms cubic-bezier(0.32,0.72,0,1)',
              }}
            >

              {/* Section heading */}
              {!searchTerm ? (
                <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
                  <span className="text-2xl leading-none" aria-hidden="true">
                    {activeCategoryId
                      ? getCategoryIcon(categories.find((c) => c.id === activeCategoryId)?.name ?? '')
                      : '🍽'}
                  </span>
                  <h2 className="text-xl font-bold font-brand" style={{ color: 'var(--color-brand-text)' }}>
                    {activeCategoryName}
                  </h2>
                  {products.length > 0 && (
                    <span className="text-xs font-brand ml-1 px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-muted)' }}>
                      {products.length}
                    </span>
                  )}
                </div>
              ) : (
                <div className="px-5 pt-4 pb-2">
                  <p className="text-sm font-brand" style={{ color: 'var(--color-brand-muted)' }}>
                    {products.length > 0
                      ? `${products.length} result${products.length !== 1 ? 's' : ''} for "${searchTerm}"`
                      : `No results for "${searchTerm}"`}
                  </p>
                </div>
              )}

              {/* Error or product grid */}
              {isError ? (
                <ErrorState onRetry={handleRetry} />
              ) : (
                <ProductGrid
                  products={products}
                  onOpenModal={setModalProduct}
                  loading={isLoading}
                  virtualScroll={false}
                />
              )}
            </div>
            {/* end grid */}

            {/* Landscape detail panel — 30 % slot, always mounted so the ref is stable */}
            <div
              ref={panelContainerCb}
              style={{
                flex:         panelOpen ? '0 0 42%' : '0 0 0px',
                overflow:     'hidden',
                minWidth:     0,
                display:      'flex',
                flexDirection:'column',
                borderLeft:   panelOpen ? '1px solid var(--ui-glass-border)' : 'none',
                transition:   'flex-basis 280ms cubic-bezier(0.32,0.72,0,1)',
                background:   'var(--color-ui-card)',
              }}
            />
            {/* end inner split */}
            </div>

          </div>
          {/* end outer content area */}
        </div>

        {/* Product detail modal / panel */}
        <ProductModal
          product={modalProduct}
          isOpen={modalProduct !== null}
          onClose={() => setModalProduct(null)}
          landscapeContainer={panelContainer}
        />

        {/* Staff PIN modal */}
        <StaffPinModal
          isOpen={pinOpen}
          onSuccess={() => { setPinOpen(false); routerHistory.replace('/settings'); }}
          onCancel={() => setPinOpen(false)}
        />
      </IonContent>
    </IonPage>
  );
}
