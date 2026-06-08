// src/modules/catalog/ProductGrid.tsx
//
// EQUAL-HEIGHT GUARANTEE
// ──────────────────────
// CSS Grid by default uses align-items:stretch, so each grid cell expands to
// the height of the tallest card in its row. To propagate that height INTO the
// card component:
//
//   grid cell div  { display:flex; flex-direction:column }   ← flex container
//   article (card) { flex:1 }                                 ← fills the cell
//
// ProductCard internally uses flex:1 on the info area, so the name section
// expands and the price/CTA row is always pinned to the bottom — regardless
// of how many lines the product name takes.
//
// COLUMN FORMULA
// ──────────────
// repeat(auto-fill, minmax(min(196px, 44%), 1fr))
//   • min(196px, 44%) → on containers < 445 px: 44% (keeps 2 cols)
//                     → on containers ≥ 445 px: 196 px floor
//   • At 1062 px grid (1366 px screen − 268 px sidebar − 36 px padding):
//       5 cols × 196 px + 4 gaps × 14 px = 980 + 56 = 1036 px  ✓ fits
//       6 cols × 196 px + 5 gaps × 14 px = 1176 + 70 = 1246 px ✗ too wide

import { useEffect, useRef, useState, useMemo } from 'react';
import { useVirtualizer }                        from '@tanstack/react-virtual';
import type { Product }                          from '@/types/catalog';
import ProductCard                               from './ProductCard';

// ─── Shared grid constants ────────────────────────────────────────────────────

const GRID_COLS_CSS = 'repeat(auto-fill, minmax(min(196px, 44%), 1fr))';
const GRID_GAP      = 14;     // px
const GRID_PADDING  = '16px 18px';

// Virtualizer column map — integer needed for row bucketing
function colsFromWidth(w: number): number {
  if (w < 480) return 2;
  if (w < 700) return 3;
  if (w < 960) return 4;
  return 5;
}

// ─── Skeleton card — mirrors real card proportions exactly ────────────────────

function SkeletonCard() {
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      borderRadius:  'var(--radius-brand-card, 18px)',
      overflow:      'hidden',
      background:    'var(--color-ui-card)',
      boxShadow:     'var(--card-shadow)',
    }}>
      {/* Image placeholder — same 72% ratio as ProductCard */}
      <div style={{ paddingTop: 'var(--card-image-ratio, 72%)', position: 'relative', flexShrink: 0 }}>
        <div style={{
          position:  'absolute',
          inset:     0,
          background: 'var(--gradient-placeholder)',
          animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
        }} />
      </div>
      {/* Info area — same padding, same 2-row name + price row layout */}
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 0,
        background: 'var(--color-ui-card)' }}>
        {/* Name line 1 */}
        <div style={{ height: 13, borderRadius: 5, background: 'var(--color-brand-surface-alt)', width: '78%',
          animation: 'skeleton-shimmer 1.6s ease-in-out infinite 80ms' }} />
        {/* Name line 2 */}
        <div style={{ height: 13, borderRadius: 5, background: 'var(--color-brand-surface-alt)', width: '52%',
          marginTop: 6, animation: 'skeleton-shimmer 1.6s ease-in-out infinite 120ms' }} />
        {/* Price + button row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14 }}>
          <div style={{ height: 16, borderRadius: 5, background: 'var(--color-brand-surface-alt)', width: 48,
            animation: 'skeleton-shimmer 1.6s ease-in-out infinite 160ms' }} />
          <div style={{ flex: 1 }} />
          <div style={{ height: 32, borderRadius: 999, background: 'var(--color-brand-surface-alt)', width: 90,
            animation: 'skeleton-shimmer 1.6s ease-in-out infinite 200ms' }} />
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid({ count = 10 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading menu items"
      style={{
        display:             'grid',
        gridTemplateColumns: GRID_COLS_CSS,
        gap:                 GRID_GAP,
        padding:             GRID_PADDING,
        alignItems:          'start',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// ─── Standard (non-virtual) grid ──────────────────────────────────────────────

interface StandardGridProps {
  products:    Product[];
  onOpenModal: (product: Product) => void;
}

function StandardGrid({ products, onOpenModal }: StandardGridProps) {
  if (products.length === 0) {
    return (
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '80px 32px',
        textAlign:      'center',
      }}>
        <svg aria-hidden="true" style={{ width: 64, height: 64, color: 'var(--color-brand-border)', marginBottom: 16 }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}>
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '1rem', color: 'var(--color-brand-text)', fontFamily: 'var(--font-brand)' }}>
          No items found
        </p>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
          Try a different category or search term
        </p>
      </div>
    );
  }

  return (
    <div
      role="list"
      aria-label="Menu items"
      style={{
        display:             'grid',
        gridTemplateColumns: GRID_COLS_CSS,
        // Grid default is align-items:stretch — each cell expands to the
        // tallest card in its row. The flex wrapper below propagates that
        // height into the article element.
        gap:                 GRID_GAP,
        padding:             GRID_PADDING,
      }}
    >
      {products.map((product, i) => (
        <div
          key={product.id}
          role="listitem"
          // flex wrapper → card fills the stretched grid cell
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <ProductCard
            product={product}
            onOpenModal={onOpenModal}
            animDelay={Math.min(i * 40, 400)}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Virtual grid (large catalogs — Holiq etc.) ───────────────────────────────

interface VirtualGridProps {
  products:             Product[];
  onOpenModal:          (product: Product) => void;
  onScrolledToBottom?:  () => void;
  hasMore?:             boolean;
  isFetchingNextPage?:  boolean;
}

function VirtualGrid({
  products, onOpenModal,
  onScrolledToBottom, hasMore, isFetchingNextPage,
}: VirtualGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const [containerWidth, setContainerWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const colCount = colsFromWidth(containerWidth);

  const rows = useMemo(() => {
    const r: Product[][] = [];
    for (let i = 0; i < products.length; i += colCount) r.push(products.slice(i, i + colCount));
    return r;
  }, [products, colCount]);

  const rowCount = rows.length + (hasMore ? 1 : 0);

  const virtualizer = useVirtualizer({
    count:            rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize:     () => 300,
    overscan:         3,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= rows.length - 1 && hasMore && onScrolledToBottom) onScrolledToBottom();
  }, [virtualItems, rows.length, hasMore, onScrolledToBottom]);

  return (
    <div ref={parentRef} style={{ height: '100%', overflowY: 'auto' }} aria-label="Menu items">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualItems.map(vRow => {
          const rowProducts = rows[vRow.index];
          return (
            <div
              key={vRow.key}
              data-index={vRow.index}
              ref={virtualizer.measureElement}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}
            >
              {rowProducts ? (
                <div style={{
                  display:             'grid',
                  gridTemplateColumns: GRID_COLS_CSS,
                  gap:                 GRID_GAP,
                  padding:             GRID_PADDING,
                }}>
                  {rowProducts.map(product => (
                    <div key={product.id} style={{ display: 'flex', flexDirection: 'column' }}>
                      <ProductCard product={product} onOpenModal={onOpenModal} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  {isFetchingNextPage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)', fontSize: '0.875rem' }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: '50%',
                        border: '2px solid var(--color-brand-primary)', borderTopColor: 'transparent',
                        animation: 'spin-ring 0.8s linear infinite',
                      }} />
                      Loading more…
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Public component ──────────────────────────────────────────────────────────

export interface ProductGridProps {
  products:             Product[];
  onOpenModal:          (product: Product) => void;
  loading?:             boolean;
  virtualScroll?:       boolean;
  onScrolledToBottom?:  () => void;
  hasMore?:             boolean;
  isFetchingNextPage?:  boolean;
}

export default function ProductGrid({
  products, onOpenModal,
  loading = false, virtualScroll = false,
  onScrolledToBottom, hasMore, isFetchingNextPage,
}: ProductGridProps) {
  if (loading) return <SkeletonGrid />;

  if (virtualScroll) {
    return (
      <VirtualGrid
        products={products} onOpenModal={onOpenModal}
        onScrolledToBottom={onScrolledToBottom}
        hasMore={hasMore} isFetchingNextPage={isFetchingNextPage}
      />
    );
  }

  return <StandardGrid products={products} onOpenModal={onOpenModal} />;
}
