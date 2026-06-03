// src/modules/catalog/ProductCard.tsx
//
// LAYOUT CONTRACT (guarantees identical card heights per row):
//
//  <article>  flex-column, fills its grid cell (flex:1 + height:100%)
//  ├── <ImageArea>   fixed aspect ratio (var(--card-image-ratio) padding trick),
//  │     absolute children: photo/placeholder, gradient vignette,
//  │     dietary badges, popular badge, unavailable overlay — all
//  │     pointer-events:none so they never affect layout.
//  └── <InfoArea>    flex:1 1 auto, flex-column
//        ├── <Name>   flex:1 1 auto — expands to fill remaining height
//        └── <PriceRow>  flexShrink:0, marginTop:auto — always at bottom

import type { Product } from '@/types/catalog';
import { formatPrice }  from '@/utils/format';
import { useCartStore } from '@/store/cartStore';
import { useTranslation } from 'react-i18next';
import { useBrand }      from '@/hooks/useBrand';
import { useBrandCSSVar } from '@/hooks/useBrandCSSVar';

export interface ProductCardProps {
  product:    Product;
  onOpenModal:(product: Product) => void;
  /** Staggered entrance delay in ms from ProductGrid */
  animDelay?: number;
}

// ─── Dietary badge ─────────────────────────────────────────────────────────────

function DietaryBadge({ label, color, textColor = '#FFFFFF' }: {
  label: string; color: string; textColor?: string;
}) {
  return (
    <span style={{
      display:        'inline-flex',
      alignItems:     'center',
      justifyContent: 'center',
      width:          22,
      height:         22,
      borderRadius:   5,
      background:     color,
      color:          textColor,
      fontSize:       '0.55rem',
      fontWeight:     800,
      letterSpacing:  '0.03em',
      lineHeight:     1,
      boxShadow:      '0 1px 4px rgba(0,0,0,0.28)',
      flexShrink:     0,
    }}>
      {label}
    </span>
  );
}

// ─── Sliders icon ──────────────────────────────────────────────────────────────

function SlidersIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" strokeLinecap="round"
      style={{ flexShrink: 0, display: 'block' }}>
      <line x1="3"  y1="6"  x2="21" y2="6"  stroke="currentColor" strokeWidth={2.2}/>
      <line x1="3"  y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth={2.2}/>
      <line x1="3"  y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth={2.2}/>
      <circle cx="8"  cy="6"  r="2.5" fill="currentColor" stroke="none"/>
      <circle cx="16" cy="12" r="2.5" fill="currentColor" stroke="none"/>
      <circle cx="8"  cy="18" r="2.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}

// ─── Placeholder icon — brand-aware ───────────────────────────────────────────

function ProductPlaceholder() {
  const { environment } = useBrand();
  const isAlcohol = environment.businessRules?.ageVerification?.enabled;

  if (isAlcohol) {
    return (
      <svg viewBox="0 0 64 64" fill="none" style={{ width: '38%', height: '38%', opacity: 0.40 }}>
        {/* Wine bottle */}
        <path d="M26 8 L26 18 Q18 22 18 32 L18 54 Q18 56 20 56 L44 56 Q46 56 46 54 L46 32 Q46 22 38 18 L38 8 Z"
          stroke="#94A3B8" strokeWidth="2" fill="none" strokeLinejoin="round"/>
        <rect x="26" y="4" width="12" height="8" rx="3" stroke="#94A3B8" strokeWidth="1.5" fill="none"/>
        <line x1="18" y1="36" x2="46" y2="36" stroke="#94A3B8" strokeWidth="1.2"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" fill="none" style={{ width: '42%', height: '42%', opacity: 0.45 }}>
      {/* Plate */}
      <circle cx="32" cy="36" r="20" stroke="#C4B5A5" strokeWidth="2"/>
      <circle cx="32" cy="36" r="14" stroke="#C4B5A5" strokeWidth="1.2"/>
      {/* Fork */}
      <line x1="22" y1="10" x2="22" y2="26" stroke="#C4B5A5" strokeWidth="2" strokeLinecap="round"/>
      <line x1="19" y1="10" x2="19" y2="17" stroke="#C4B5A5" strokeWidth="2" strokeLinecap="round"/>
      <line x1="25" y1="10" x2="25" y2="17" stroke="#C4B5A5" strokeWidth="2" strokeLinecap="round"/>
      {/* Knife */}
      <path d="M42 10 Q44 14 44 20 L42 24 L42 10Z" stroke="#C4B5A5" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
      <line x1="42" y1="24" x2="42" y2="38" stroke="#C4B5A5" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────

export default function ProductCard({ product, onOpenModal, animDelay = 0 }: ProductCardProps) {
  const { t }          = useTranslation();
  const addItem        = useCartStore(s => s.addItem);
  const { environment } = useBrand();

  // Read CSS vars at render time for inline mouse-event handlers
  const brandPrimary   = useBrandCSSVar('--color-brand-primary');
  const brandPrimaryRgb = useBrandCSSVar('--color-brand-primary-rgb');

  const needsModal =
    !product.isSingleVariant ||
    product.modifierGroups.length > 0 ||
    product.variants.length > 0;

  const hasImage    = Boolean(product.imageUrl);
  const showCalories = environment.businessRules?.dietary?.showCalories ?? true;
  const badgeConfig  = environment.businessRules?.dietary?.badges ?? {};

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (!product.available) return;
    if (needsModal) { onOpenModal(product); return; }
    const variantId = product.variantIds[0];
    addItem({
      productId: product.id,
      name:      product.name,
      basePrice: product.basePrice,
      imageUrl:  product.imageUrl,
      variant:   variantId
        ? { id: variantId, name: product.name, price: product.basePrice }
        : undefined,
    });
  }

  return (
    <article
      id={`product-${product.id}`}
      onClick={() => product.available && onOpenModal(product)}
      role="button"
      tabIndex={product.available ? 0 : -1}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          product.available && onOpenModal(product);
        }
      }}
      aria-label={product.name}
      style={{
        display:        'flex',
        flexDirection:  'column',
        flex:           1,
        borderRadius:   'var(--radius-brand-card)',
        overflow:       'hidden',
        background:     'var(--color-ui-card)',
        boxShadow:      'var(--card-shadow)',
        cursor:         product.available ? 'pointer' : 'not-allowed',
        transition:     'transform 180ms ease, box-shadow 180ms ease',
        animation:      'card-enter 0.45s ease-out both',
        animationDelay: `${animDelay}ms`,
        userSelect:     'none',
        WebkitUserSelect: 'none',
      }}
      onMouseEnter={e => {
        if (!product.available) return;
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'translateY(-4px)';
        el.style.boxShadow = 'var(--card-shadow-hover)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = '';
        el.style.boxShadow = 'var(--card-shadow)';
      }}
      onPointerDown={e => {
        if (product.available) (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
      }}
      onPointerUp={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
      onPointerCancel={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
    >

      {/* ══ IMAGE AREA ═══════════════════════════════════════════════════ */}
      <div style={{ position: 'relative', paddingTop: 'var(--card-image-ratio)', flexShrink: 0 }}>

        {hasImage ? (
          <img
            src={product.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            style={{
              position:  'absolute',
              inset:     0,
              width:     '100%',
              height:    '100%',
              objectFit: 'cover',
              display:   'block',
            }}
          />
        ) : (
          <div style={{
            position:       'absolute',
            inset:          0,
            background:     'var(--gradient-placeholder)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
          }}>
            <ProductPlaceholder />
          </div>
        )}

        {/* Vignette */}
        {hasImage && (
          <div style={{
            position:      'absolute',
            inset:         0,
            background:    'linear-gradient(to bottom,rgba(0,0,0,0.04) 0%,rgba(0,0,0,0.18) 100%)',
            pointerEvents: 'none',
          }} />
        )}

        {/* Dietary badges — driven by brand config */}
        {(() => {
          const badges: React.ReactNode[] = [];
          if (product.isVeg && badgeConfig['isVeg']) {
            badges.push(<DietaryBadge key="v" label={badgeConfig['isVeg'].label} color={badgeConfig['isVeg'].color} textColor={badgeConfig['isVeg'].textColor} />);
          } else if (product.isVeg) {
            badges.push(<DietaryBadge key="v" label="V" color="var(--color-badge-veg)" />);
          }
          if (product.isVegan && badgeConfig['isVegan']) {
            badges.push(<DietaryBadge key="ve" label={badgeConfig['isVegan'].label} color={badgeConfig['isVegan'].color} textColor={badgeConfig['isVegan'].textColor} />);
          } else if (product.isVegan) {
            badges.push(<DietaryBadge key="ve" label="VE" color="var(--color-badge-vegan)" />);
          }
          if (product.isGlutenFree && badgeConfig['isGlutenFree']) {
            badges.push(<DietaryBadge key="gf" label={badgeConfig['isGlutenFree'].label} color={badgeConfig['isGlutenFree'].color} textColor={badgeConfig['isGlutenFree'].textColor} />);
          } else if (product.isGlutenFree) {
            badges.push(<DietaryBadge key="gf" label="GF" color="var(--color-badge-gf)" />);
          }
          if (badges.length === 0) return null;
          return (
            <div style={{
              position: 'absolute', top: 8, insetInlineEnd: 8,
              display: 'flex', flexDirection: 'column', gap: 3,
              alignItems: 'flex-end', pointerEvents: 'none',
            }}>
              {badges}
            </div>
          );
        })()}

        {/* Popular badge */}
        {product.popular && (
          <div style={{ position: 'absolute', top: 8, insetInlineStart: 8, pointerEvents: 'none' }}>
            <span style={{
              display:    'flex',
              alignItems: 'center',
              gap:        3,
              padding:    '3px 8px',
              borderRadius: 999,
              background: 'linear-gradient(135deg, var(--color-badge-popular-from), var(--color-badge-popular-to))',
              color:      'var(--color-brand-text-inverse)',
              fontSize:   '0.62rem',
              fontWeight: 800,
              boxShadow:  '0 2px 8px rgba(0,0,0,0.24)',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-brand)',
            }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              {t('catalog.popular', 'Popular')}
            </span>
          </div>
        )}

        {/* Calorie chip — hidden when brand disables calories */}
        {hasImage && showCalories && product.calories != null && (
          <div style={{ position: 'absolute', bottom: 8, insetInlineEnd: 8, pointerEvents: 'none' }}>
            <span style={{
              display:        'inline-block',
              padding:        '2px 6px',
              borderRadius:   999,
              background:     'rgba(0,0,0,0.48)',
              backdropFilter: 'blur(4px)',
              color:          'rgba(255,255,255,0.92)',
              fontSize:       '0.58rem',
              fontWeight:     600,
              fontFamily:     'var(--font-brand)',
            }}>
              {product.calories} cal
            </span>
          </div>
        )}

        {/* Unavailable overlay */}
        {!product.available && (
          <div style={{
            position:       'absolute',
            inset:          0,
            background:     'rgba(0,0,0,0.50)',
            backdropFilter: 'blur(2px)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
          }}>
            <span style={{
              padding:    '5px 14px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.14)',
              border:     '1.5px solid rgba(255,255,255,0.35)',
              color:      '#FFFFFF',
              fontSize:   '0.74rem',
              fontWeight: 700,
              fontFamily: 'var(--font-brand)',
            }}>
              {t('catalog.unavailable', 'Unavailable')}
            </span>
          </div>
        )}
      </div>
      {/* end image area */}

      {/* ══ INFO AREA ═════════════════════════════════════════════════════ */}
      <div style={{
        display:       'flex',
        flexDirection: 'column',
        flex:          '1 1 auto',
        padding:       'var(--spacing-card-pad, 10px 12px 12px)',
        background:    'var(--color-ui-card)',
      }}>

        {/* Product name */}
        <h3 style={{
          margin:          0,
          flex:            '1 1 auto',
          fontWeight:      600,
          fontSize:        'var(--font-size-base)',
          color:           'var(--color-brand-text)',
          lineHeight:      1.38,
          display:         '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow:        'hidden',
          fontFamily:      'var(--font-brand)',
          minHeight:       'calc(2 * 1.38 * 0.875rem)',
        }}>
          {product.name}
        </h3>

        {/* Price + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexShrink: 0 }}>

          {/* Price */}
          <span style={{
            flex:          1,
            minWidth:      0,
            fontWeight:    'var(--font-weight-price)' as React.CSSProperties['fontWeight'],
            fontSize:      'var(--font-size-price)',
            color:         'var(--color-brand-primary)',
            lineHeight:    1,
            letterSpacing: '-0.01em',
            fontFamily:    'var(--font-brand)',
            overflow:      'hidden',
            textOverflow:  'ellipsis',
            whiteSpace:    'nowrap',
          }}>
            {formatPrice(product.basePrice)}
          </span>

          {product.available && (
            needsModal ? (

              /* ── Customize ── outlined pill */
              <button
                type="button"
                onClick={handleAdd}
                aria-label={`${t('catalog.customize', 'Customize')} ${product.name}`}
                style={{
                  flexShrink:   0,
                  display:      'flex',
                  alignItems:   'center',
                  gap:          5,
                  height:       32,
                  padding:      '0 11px',
                  borderRadius: 999,
                  border:       '1.5px solid var(--color-brand-primary)',
                  background:   'transparent',
                  color:        'var(--color-brand-primary)',
                  fontSize:     '0.72rem',
                  fontWeight:   700,
                  fontFamily:   'var(--font-brand)',
                  cursor:       'pointer',
                  whiteSpace:   'nowrap',
                  transition:   'background var(--transition-base), color var(--transition-base)',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = brandPrimary;
                  el.style.color      = '#FFFFFF';
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = 'transparent';
                  el.style.color      = brandPrimary;
                }}
              >
                <SlidersIcon />
                {t('catalog.customize', 'Customize')}
              </button>

            ) : (

              /* ── Add ── solid brand-primary pill */
              <button
                type="button"
                onClick={handleAdd}
                aria-label={`${t('catalog.add', 'Add')} ${product.name}`}
                style={{
                  flexShrink:   0,
                  display:      'flex',
                  alignItems:   'center',
                  gap:          4,
                  height:       32,
                  padding:      '0 13px',
                  borderRadius: 999,
                  border:       'none',
                  background:   'var(--color-brand-primary)',
                  color:        'var(--color-brand-text-inverse)',
                  fontSize:     '0.72rem',
                  fontWeight:   700,
                  fontFamily:   'var(--font-brand)',
                  cursor:       'pointer',
                  whiteSpace:   'nowrap',
                  boxShadow:    `0 2px 8px rgba(${brandPrimaryRgb},0.38)`,
                  transition:   'opacity var(--transition-base)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.86'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth={2.8} strokeLinecap="round"
                  style={{ flexShrink: 0 }}>
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5"  y1="12" x2="19" y2="12"/>
                </svg>
                {t('catalog.add', 'Add')}
              </button>

            )
          )}
        </div>

      </div>
      {/* end info area */}

    </article>
  );
}
