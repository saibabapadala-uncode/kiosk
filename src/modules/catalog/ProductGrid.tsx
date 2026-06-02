// src/modules/catalog/ProductGrid.tsx
// Grid layout uses CSS auto-fill + minmax so column count is determined by the
// *container* width, not the viewport width.  This is critical for the landscape
// split-panel layout where the grid occupies only 70 % of the screen — Tailwind
// responsive classes (sm:, lg:) would keep using the full viewport width and
// render too many columns inside the narrower container.
//
// auto-fill column formula:  repeat(auto-fill, minmax(min(200px, 45%), 1fr))
//   min(200px, 45%) ensures at least 2 columns even on very narrow containers
//   while setting a 200 px floor for the card width on wider containers.
//   Result at common widths (container, not viewport):
//     280 px  → 2 cols  (portrait phone, no sidebar)
//     560 px  → 2 cols  (narrow tablet)
//     720 px  → 3 cols  (70 % grid with panel open on 1024 px screen)
//     840 px  → 4 cols  (full grid on 1024 px screen minus sidebar)
//    1040 px  → 5 cols  (full grid on 1280 px screen minus sidebar)

import { useEffect, useRef, useState, useMemo } from 'react';
import { useVirtualizer }                        from '@tanstack/react-virtual';
import type { Product }                          from '@/types/catalog';
import ProductCard                               from './ProductCard';

// ─── Grid column config ────────────────────────────────────────────────────────

// For the virtualizer (which needs an integer col count), map container px → cols.
function colsFromWidth(w: number): number {
  if (w < 480) return 2;
  if (w < 700) return 3;
  if (w < 960) return 4;
  return 5;
}

// The CSS minmax value used in the non-virtual grid.
// min(200px, 45%) guarantees at least 2 cols even on very narrow containers.
const GRID_COLS_CSS = 'repeat(auto-fill, minmax(min(200px, 45%), 1fr))';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div aria-hidden="true"
      className="flex flex-col rounded-brand overflow-hidden bg-brand-surface border border-brand-border animate-pulse">
      <div className="aspect-[4/3] bg-brand-border" />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-4 bg-brand-border rounded w-3/4" />
        <div className="h-3 bg-brand-border rounded w-1/2" />
        <div className="h-8 bg-brand-border rounded mt-2" />
      </div>
    </div>
  );
}

function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading menu items"
      style={{ display: 'grid', gridTemplateColumns: GRID_COLS_CSS, gap: '1rem', padding: '1rem' }}
    >
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
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
      <div className="flex flex-col items-center justify-center py-20 text-brand-muted font-brand">
        <svg aria-hidden="true" className="w-16 h-16 mb-4 opacity-40" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p className="text-lg">No items found</p>
        <p className="text-sm mt-1">Try a different category or search term</p>
      </div>
    );
  }

  return (
    <div
      role="list"
      aria-label="Menu items"
      style={{ display: 'grid', gridTemplateColumns: GRID_COLS_CSS, gap: '1rem', padding: '1rem' }}
    >
      {products.map((product) => (
        <div key={product.id} role="listitem">
          <ProductCard product={product} onOpenModal={onOpenModal} />
        </div>
      ))}
    </div>
  );
}

// ─── Virtual grid (Holiq — 1 000 + items) ─────────────────────────────────────

interface VirtualGridProps {
  products:             Product[];
  onOpenModal:          (product: Product) => void;
  onScrolledToBottom?:  () => void;
  hasMore?:             boolean;
  isFetchingNextPage?:  boolean;
}

function VirtualGrid({ products, onOpenModal, onScrolledToBottom, hasMore, isFetchingNextPage }: VirtualGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Track actual container width with ResizeObserver so columns respond to the
  // container (not the viewport) — same reason as the non-virtual grid above.
  const [containerWidth, setContainerWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const colCount = colsFromWidth(containerWidth);

  const rows = useMemo(() => {
    const r: Product[][] = [];
    for (let i = 0; i < products.length; i += colCount) {
      r.push(products.slice(i, i + colCount));
    }
    return r;
  }, [products, colCount]);

  const rowCount = rows.length + (hasMore ? 1 : 0);

  const virtualizer = useVirtualizer({
    count:           rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize:    () => 320,
    overscan:        3,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= rows.length - 1 && hasMore && onScrolledToBottom) {
      onScrolledToBottom();
    }
  }, [virtualItems, rows.length, hasMore, onScrolledToBottom]);

  return (
    <div ref={parentRef} style={{ height: '100%', overflowY: 'auto' }} aria-label="Menu items">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualItems.map((vRow) => {
          const rowProducts = rows[vRow.index];
          return (
            <div key={vRow.key} data-index={vRow.index} ref={virtualizer.measureElement}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}
            >
              {rowProducts ? (
                <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS_CSS, gap: '1rem', padding: '1rem' }}>
                  {rowProducts.map((product) => (
                    <ProductCard key={product.id} product={product} onOpenModal={onOpenModal} />
                  ))}
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  {isFetchingNextPage && (
                    <div className="flex items-center gap-2 text-brand-muted font-brand text-sm">
                      <div className="w-4 h-4 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
                      Loading more...
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
      <VirtualGrid products={products} onOpenModal={onOpenModal}
        onScrolledToBottom={onScrolledToBottom} hasMore={hasMore}
        isFetchingNextPage={isFetchingNextPage} />
    );
  }

  return <StandardGrid products={products} onOpenModal={onOpenModal} />;
}
