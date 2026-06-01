// src/modules/kiosk/AttractScreen.tsx
//
// ── Trigger: loadCatalog() on every Ionic page activation ────────────────────
//   useIonViewWillEnter fires whether the page is freshly mounted OR revealed
//   from Ionic's keep-alive DOM cache. Calling loadCatalog() here guarantees
//   the menu_organizer + products APIs are called on:
//     • First login  →  attract screen
//     • Every "Start Over"  →  back to attract
//   catalog.service.ts deduplicates concurrent calls via a module-level promise.
//
// ── Dynamic sections — zero hardcoded promotional labels ─────────────────────
//   Sections render ONLY when the API returned data for them:
//   • ≥ 2 available products with popular=true  → "Popular Items" strip
//   • ≥ 2 available products, none popular      → "Menu Highlights" strip
//   • < 2 available products                    → no strip
//   • ≥ 1 category from menu organizer          → category row
//   • 0 categories                              → category row hidden
//   • Loading / no data yet                     → hero only (clean brand state)

import { useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useIonViewWillEnter } from '@ionic/react';
import { useBrand } from '@/hooks/useBrand';
import { useCartStore } from '@/store/cartStore';
import { useSessionStore } from '@/store/sessionStore';
import { usePaymentStore } from '@/store/paymentStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useKioskChannelStore } from '@/store/kioskChannelStore';
import { useStoreConfigStore } from '@/store/storeConfigStore';
import { useCatalogStore } from '@/store/catalogStore';
import { loadCatalog } from '@/services/catalog.service';
import type { Product, Category } from '@/types/catalog';
import { formatPrice } from '@/utils/format';

const SETTINGS_TAPS   = 5;
const SETTINGS_WIN_MS = 3_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function catIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('burger') || n.includes('sandwich'))                           return '🍔';
  if (n.includes('chicken') || n.includes('wing'))                              return '🍗';
  if (n.includes('bowl') || n.includes('rice'))                                 return '🥗';
  if (n.includes('side') || n.includes('frie') || n.includes('appetizer'))     return '🍟';
  if (n.includes('drink') || n.includes('bev') || n.includes('juice'))         return '🥤';
  if (n.includes('dessert') || n.includes('sweet') || n.includes('cake'))      return '🍰';
  if (n.includes('pizza') || n.includes('flatbread'))                           return '🍕';
  if (n.includes('salad') || n.includes('veggie'))                              return '🥦';
  if (n.includes('coffee') || n.includes('tea'))                                return '☕';
  if (n.includes('soup'))                                                        return '🍲';
  if (n.includes('wrap') || n.includes('taco') || n.includes('burrito'))       return '🌮';
  if (n.includes('seafood') || n.includes('fish'))                              return '🦐';
  if (n.includes('steak') || n.includes('beef') || n.includes('meat'))         return '🥩';
  if (n.includes('pasta') || n.includes('noodle'))                              return '🍝';
  if (n.includes('whiskey') || n.includes('bourbon'))                           return '🥃';
  if (n.includes('wine'))                                                        return '🍷';
  if (n.includes('beer') || n.includes('ipa'))                                  return '🍺';
  if (n.includes('spirit') || n.includes('cocktail'))                           return '🫙';
  if (n.includes('combo') || n.includes('meal') || n.includes('special'))      return '🍱';
  return '🍽';
}

const CAT_GRADIENTS = [
  'linear-gradient(135deg,#b91c1c,#dc2626)',
  'linear-gradient(135deg,#d97706,#f59e0b)',
  'linear-gradient(135deg,#047857,#10b981)',
  'linear-gradient(135deg,#1d4ed8,#3b82f6)',
  'linear-gradient(135deg,#7c3aed,#a855f7)',
  'linear-gradient(135deg,#0f766e,#14b8a6)',
  'linear-gradient(135deg,#9d174d,#ec4899)',
  'linear-gradient(135deg,#92400e,#d97706)',
];

// ─── Live clock ───────────────────────────────────────────────────────────────

function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className="text-white/95 font-brand font-bold tabular-nums tracking-wide drop-shadow"
        style={{ fontSize: 'clamp(1.2rem,2.5vw,1.6rem)' }}>
        {t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
      </span>
      <span className="text-white/55 font-brand tracking-wider"
        style={{ fontSize: 'clamp(0.6rem,1.2vw,0.75rem)' }}>
        {t.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
      </span>
    </div>
  );
}

// ─── Product card ─────────────────────────────────────────────────────────────

function ProductCard({ product }: { product: Product }) {
  return (
    <div
      className="flex-shrink-0 flex flex-col overflow-hidden rounded-2xl"
      style={{
        width:      'clamp(130px,13vw,168px)',
        background: 'var(--color-ui-card)',
        border:     '1px solid var(--ui-glass-border)',
        boxShadow:  'var(--ui-card-shadow)',
      }}
    >
      <div className="relative overflow-hidden" style={{ aspectRatio: '4/3' }}>
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy"
            className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl"
            style={{ background: 'linear-gradient(135deg,var(--color-brand-surface),var(--color-brand-border))' }}>
            {catIcon(product.name)}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {product.calories != null && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
            style={{ background: 'rgba(0,0,0,0.58)', color: 'rgba(255,255,255,0.80)' }}>
            {product.calories} cal
          </span>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="text-xs font-bold font-brand line-clamp-1 leading-tight"
          style={{ color: 'var(--color-brand-text)' }}>
          {product.name}
        </p>
        <p className="text-xs font-bold font-brand mt-1"
          style={{ color: 'var(--color-brand-primary)' }}>
          {formatPrice(product.basePrice)}
        </p>
      </div>
    </div>
  );
}

// ─── Scrolling product strip ──────────────────────────────────────────────────
// label is derived from API data — never a hardcoded promotional claim.

function ProductStrip({ products, label }: { products: Product[]; label: string }) {
  const items = [...products, ...products]; // double for seamless marquee
  return (
    <div
      className="flex flex-col justify-center"
      style={{
        flex:         '0 0 21%',
        borderTop:    '1px solid var(--ui-glass-border)',
        borderBottom: '1px solid var(--ui-glass-border)',
        background:   'var(--color-brand-bg)',
        overflow:     'hidden',
      }}
    >
      <div className="flex items-center gap-1.5 px-5 mb-1.5 flex-shrink-0" style={{ paddingTop: '0.4rem' }}>
        <span className="text-sm" aria-hidden="true">🔥</span>
        <span className="font-bold font-brand"
          style={{ fontSize: 'clamp(0.7rem,1.4vw,0.85rem)', color: 'var(--color-brand-text)' }}>
          {label}
        </span>
      </div>
      <div className="relative overflow-hidden flex-1 flex items-center">
        <div className="absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right,var(--color-brand-bg),transparent)' }} />
        <div className="absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to left,var(--color-brand-bg),transparent)' }} />
        <div className="flex gap-3 px-5 animate-marquee"
          style={{ height: 'calc(100% - 6px)', alignItems: 'stretch' }}>
          {items.map((p, i) => <ProductCard key={`${p.id}-${i}`} product={p} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ categories, onStart }: { categories: Category[]; onStart: () => void }) {
  return (
    <div
      className="flex flex-col justify-center px-5"
      style={{ flex: '0 0 18%', background: 'var(--color-brand-bg)' }}
    >
      <p className="font-bold font-brand uppercase tracking-widest mb-2 flex-shrink-0"
        style={{ fontSize: 'clamp(0.55rem,1.1vw,0.7rem)', color: 'var(--color-brand-muted)' }}>
        Browse the Menu
      </p>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar flex-1 items-stretch pb-0.5">
        {categories.map((cat, idx) => (
          <button
            key={cat.id}
            onClick={(e) => { e.stopPropagation(); onStart(); }}
            aria-label={`Browse ${cat.name}`}
            className="flex-shrink-0 flex flex-col items-center justify-center gap-1 rounded-2xl transition-all active:scale-90 hover:scale-105"
            style={{
              background: CAT_GRADIENTS[idx % CAT_GRADIENTS.length],
              minWidth:   'clamp(64px,7vw,96px)',
              height:     '100%',
              padding:    '0.5rem 0.4rem',
              boxShadow:  '0 4px 14px rgba(0,0,0,0.20)',
            }}
          >
            <span className="leading-none" style={{ fontSize: 'clamp(1.3rem,2.5vw,1.75rem)' }}>
              {catIcon(cat.name)}
            </span>
            <span className="text-white font-bold font-brand text-center leading-tight line-clamp-2"
              style={{ fontSize: 'clamp(0.6rem,1.1vw,0.75rem)' }}>
              {cat.name}
            </span>
            {(cat.itemCount ?? 0) > 0 && (
              <span className="text-white/60 font-brand"
                style={{ fontSize: 'clamp(0.5rem,0.9vw,0.65rem)' }}>
                {cat.itemCount} items
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────

export default function AttractScreenContent() {
  const history                  = useHistory();
  const { brandId, environment } = useBrand();
  const logoUrl                  = useSettingsStore((s) => s.theme.logoUrl);
  const channel                  = useKioskChannelStore((s) => s.channel);
  const storeName                = useStoreConfigStore((s) => s.store?.name ?? '');
  const clearCart                = useCartStore((s) => s.clearCart);
  const resetSession             = useSessionStore((s) => s.resetSession);
  const resetPayment             = usePaymentStore((s) => s.reset);
  const startOrder               = useSessionStore((s) => s.startOrder);

  // ── Read catalog data from Zustand store ───────────────────────────────────
  // catalogStore is populated by loadCatalog() called in useIonViewWillEnter.
  // These selectors re-render this component whenever the store updates.
  const catalogCategories = useCatalogStore((s) => s.categories);
  const catalogProducts   = useCatalogStore((s) => s.products);
  const catalogLoading    = useCatalogStore((s) => s.isLoading);

  // ── TRIGGER: call loadCatalog() on every Ionic page activation ─────────────
  // This fires on fresh mount AND when Ionic reveals a cached page.
  // menu_organizer + products APIs are called every time, no caching.
  useIonViewWillEnter(() => {
    console.log('[AttractScreen] ionViewWillEnter → loadCatalog()');
    void loadCatalog();
  });

  // ── Derive what sections to show — driven entirely by API data ─────────────
  const allAvailable   = catalogProducts.filter((p) => p.available);
  const popularItems   = allAvailable.filter((p) => p.popular);

  const usePopular     = popularItems.length >= 2;
  const stripItems     = usePopular ? popularItems.slice(0, 12) : allAvailable.slice(0, 12);
  // Label derived from data — no hardcoded "Fan Favourites" / "Best Sellers" etc.
  const stripLabel     = usePopular ? 'Popular Items' : 'Menu Highlights';
  const showStrip      = stripItems.length >= 2; // need ≥2 for a meaningful scroll

  const categories     = catalogCategories.slice(0, 8);
  const showCategories = categories.length > 0;

  // Display name: real store name from API > channel name > brand name
  const displayName    = storeName || channel?.store_name || environment.displayName;

  // ── Settings tap counter ────────────────────────────────────────────────────
  const [settingsTaps, setSettingsTaps] = useState(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>();

  // Clean slate on every attract screen visit
  useEffect(() => {
    clearCart(); resetSession(); resetPayment();
  }, [clearCart, resetSession, resetPayment]);

  function handleStart() {
    startOrder();
    history.push('/menu');
  }

  function handleSettingsTap(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation();
    const next = settingsTaps + 1;
    setSettingsTaps(next);
    clearTimeout(tapTimer.current);
    if (next >= SETTINGS_TAPS) {
      setSettingsTaps(0);
      history.push('/settings');
      return;
    }
    tapTimer.current = setTimeout(() => setSettingsTaps(0), SETTINGS_WIN_MS);
  }

  const heroGradient = brandId === 'holiq'
    ? 'linear-gradient(145deg,#020617 0%,#0f172a 20%,#1e3a5f 45%,#0c4a6e 65%,var(--color-brand-accent) 100%)'
    : 'linear-gradient(145deg,var(--color-brand-primary) 0%,var(--color-brand-secondary) 28%,color-mix(in srgb,var(--color-brand-primary) 70%,#f59e0b) 55%,color-mix(in srgb,var(--color-brand-primary) 60%,black) 100%)';

  return (
    <div
      onClick={handleStart}
      className="flex flex-col w-full h-full select-none overflow-hidden"
      style={{ background: 'var(--color-brand-bg)', cursor: 'pointer' }}
    >

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 flex-shrink-0 relative z-20"
        style={{ height: '9%', background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand chip */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center text-white font-bold font-brand"
            style={{
              width: '1.6rem', height: '1.6rem', borderRadius: '0.4rem', fontSize: '0.7rem',
              background: 'linear-gradient(135deg,var(--color-brand-primary),var(--color-brand-secondary))',
            }}
          >
            {environment.displayName[0]}
          </div>
          <span className="font-brand font-medium hidden sm:block"
            style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)' }}>
            Welcome to&nbsp;<span className="text-white font-bold">{displayName}</span>
          </span>
        </div>

        {/* Clock */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <LiveClock />
        </div>

        {/* Subtle loading indicator while APIs are in-flight */}
        {catalogLoading && (
          <span
            className="absolute w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ right: '3.5rem', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.40)' }}
            aria-hidden="true"
          />
        )}

        {/* Settings tap zone */}
        <button
          onClick={handleSettingsTap}
          aria-label="Settings"
          className="w-8 h-8 flex items-center justify-center rounded-full relative"
          style={{ color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.06)' }}
        >
          {settingsTaps > 0 && (
            <span className="absolute inset-0 rounded-full border border-white/40 flex items-center justify-center text-[10px] text-white/60 font-bold font-brand">
              {SETTINGS_TAPS - settingsTaps}
            </span>
          )}
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div
        className="relative flex flex-col items-center justify-center text-center px-6 overflow-hidden"
        style={{ flex: showStrip || showCategories ? '0 0 43%' : '1 1 auto' }}
        onClick={handleStart}
      >
        <div className="absolute inset-0 animate-gradient-shift"
          style={{ background: heroGradient, backgroundSize: '300% 300%' }} aria-hidden="true" />
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
          style={{ background: 'linear-gradient(to bottom,rgba(0,0,0,0.08) 0%,rgba(0,0,0,0.32) 100%)' }} />
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full animate-float"
            style={{ background: 'rgba(255,255,255,0.07)' }} />
          <div className="absolute -bottom-24 -left-12 w-64 h-64 rounded-full animate-float-slow"
            style={{ background: 'rgba(255,255,255,0.05)' }} />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-2">
          {/* Logo */}
          <div className="animate-fade-in-up mb-1">
            {logoUrl ? (
              <img src={logoUrl} alt={environment.displayName} loading="eager"
                className="object-contain drop-shadow-2xl"
                style={{ height: 'clamp(2.5rem,5vw,3.5rem)' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div
                className="flex items-center justify-center font-bold text-white font-brand shadow-2xl"
                style={{
                  width: 'clamp(3rem,6vw,3.8rem)', height: 'clamp(3rem,6vw,3.8rem)',
                  fontSize: 'clamp(1.4rem,3vw,2rem)', borderRadius: '1rem',
                  background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)',
                  border: '1.5px solid rgba(255,255,255,0.28)',
                }}
              >
                {environment.displayName[0]}
              </div>
            )}
          </div>

          <h1
            className="font-bold text-white tracking-tight animate-fade-in-up-d1"
            style={{
              fontFamily: 'var(--font-brand)',
              fontSize:   'clamp(2rem,5.5vw,3.8rem)',
              textShadow: '0 2px 24px rgba(0,0,0,0.28)',
              lineHeight:  1.05,
            }}
          >
            {displayName}
          </h1>

          <p className="font-medium animate-fade-in-up-d2"
            style={{
              fontFamily: 'var(--font-brand)',
              fontSize:   'clamp(0.9rem,2.2vw,1.35rem)',
              color:      'rgba(255,255,255,0.80)',
              marginTop:  '0.15rem',
            }}>
            {storeName && storeName !== environment.displayName
              ? storeName
              : 'Fresh. Fast. Made for You.'}
          </p>

          <p className="animate-fade-in-up-d2"
            style={{
              fontFamily: 'var(--font-brand)',
              fontSize:   'clamp(0.7rem,1.4vw,0.875rem)',
              color:      'rgba(255,255,255,0.50)',
            }}>
            Tap anywhere to start your order
          </p>

          {/* CTA pill */}
          <div className="animate-fade-in-up-d3 animate-breathe animate-glow-pulse"
            style={{ marginTop: 'clamp(0.75rem,1.5vw,1.25rem)' }}>
            <div
              className="relative overflow-hidden rounded-full font-bold"
              style={{
                background: 'rgba(255,255,255,0.96)',
                color:      'var(--color-brand-primary)',
                fontFamily: 'var(--font-brand)',
                fontSize:   'clamp(0.85rem,1.8vw,1.1rem)',
                padding:    'clamp(0.6rem,1.2vw,0.9rem) clamp(1.8rem,4vw,3.5rem)',
                boxShadow:  '0 8px 32px rgba(0,0,0,0.22)',
              }}
            >
              Tap Anywhere to Order
            </div>
          </div>
        </div>
      </div>

      {/* ── Product strip — only when API returned ≥ 2 products ─────────── */}
      {showStrip && (
        <ProductStrip products={stripItems} label={stripLabel} />
      )}

      {/* ── Category row — only when API returned ≥ 1 category ──────────── */}
      {showCategories && (
        <CategoryRow categories={categories} onStart={handleStart} />
      )}

      {/* ── Bottom CTA strip — always shown ──────────────────────────────── */}
      <div
        className="relative flex items-center overflow-hidden cursor-pointer flex-shrink-0"
        style={{ height: '11%', minHeight: '52px' }}
        onClick={handleStart}
      >
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg,var(--color-brand-primary) 0%,var(--color-brand-secondary) 100%)' }} />
        <div className="absolute right-0 top-1/2 w-40 h-40 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: 'white', transform: 'translate(35%,-50%)' }} aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-4 px-5 lg:px-8 w-full">
          <div className="flex flex-col flex-1 min-w-0">
            <h3 className="font-bold font-brand text-white leading-tight line-clamp-1"
              style={{ fontSize: 'clamp(0.85rem,1.8vw,1.15rem)' }}>
              {displayName ? `Order at ${displayName}` : 'Start Your Order'}
            </h3>
            <p className="font-brand leading-snug"
              style={{ fontSize: 'clamp(0.65rem,1.2vw,0.78rem)', color: 'rgba(255,255,255,0.65)' }}>
              Tap to explore the full menu
            </p>
          </div>
          <div
            className="flex-shrink-0 rounded-full font-bold font-brand whitespace-nowrap active:scale-90 transition-transform"
            style={{
              background: 'rgba(255,255,255,0.92)',
              color:      'var(--color-brand-primary)',
              fontSize:   'clamp(0.65rem,1.2vw,0.8rem)',
              padding:    'clamp(0.35rem,0.8vw,0.5rem) clamp(0.8rem,1.8vw,1.25rem)',
              boxShadow:  '0 4px 14px rgba(0,0,0,0.18)',
            }}
          >
            View Menu →
          </div>
        </div>
      </div>
    </div>
  );
}
