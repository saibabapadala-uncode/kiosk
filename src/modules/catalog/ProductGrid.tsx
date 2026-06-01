// src/modules/catalog/ProductGrid.tsx
import { useEffect, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Product } from '@/types/catalog';
import ProductCard from './ProductCard';

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col rounded-brand overflow-hidden bg-brand-surface border border-brand-border animate-pulse"
    >
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
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// ─── Column count ──────────────────────────────────────────────────────────────

function getColCount(width: number): number {
  if (width < 640) return 2;
  if (width < 1024) return 3;
  return 4;
}

// ─── Standard (non-virtual) grid — used by Straunt ───────────────────────────

interface StandardGridProps {
  products: Product[];
  onOpenModal: (product: Product) => void;
}

function StandardGrid({ products, onOpenModal }: StandardGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-brand-muted font-brand">
        <svg aria-hidden="true" className="w-16 h-16 mb-4 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-4"
    >
      {products.map((product) => (
        <div key={product.id} role="listitem">
          <ProductCard product={product} onOpenModal={onOpenModal} />
        </div>
      ))}
    </div>
  );
}

// ─── Virtual grid — used by Holiq (1000+ items) ────────────────────────────────

interface VirtualGridProps {
  products: Product[];
  onOpenModal: (product: Product) => void;
  onScrolledToBottom?: () => void;
  hasMore?: boolean;
  isFetchingNextPage?: boolean;
}

function VirtualGrid({
  products,
  onOpenModal,
  onScrolledToBottom,
  hasMore,
  isFetchingNextPage,
}: VirtualGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Use a fixed column count of 4 for kiosk (1280px); respond to window width
  const colCount = getColCount(
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );

  // Group flat product list into rows of colCount
  const rows = useMemo(() => {
    const r: Product[][] = [];
    for (let i = 0; i < products.length; i += colCount) {
      r.push(products.slice(i, i + colCount));
    }
    return r;
  }, [products, colCount]);

  // Total row count +1 for the load-more sentinel row when there are more pages
  const rowCount = rows.length + (hasMore ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 320, // estimated row height (px)
    overscan: 3,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Trigger fetchNextPage when sentinel row becomes visible
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= rows.length - 1 && hasMore && onScrolledToBottom) {
      onScrolledToBottom();
    }
  }, [virtualItems, rows.length, hasMore, onScrolledToBottom]);

  return (
    <div
      ref={parentRef}
      style={{ height: '100%', overflowY: 'auto' }}
      aria-label="Menu items"
    >
      {/* Total scrollable height */}
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualItems.map((virtualRow) => {
          const rowProducts = rows[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {rowProducts ? (
                /* Product row */
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                  {rowProducts.map((product) => (
                    <ProductCard key={product.id} product={product} onOpenModal={onOpenModal} />
                  ))}
                </div>
              ) : (
                /* Sentinel / load-more row */
                <div className="flex justify-center py-8">
                  {isFetchingNextPage ? (
                    <div className="flex items-center gap-2 text-brand-muted font-brand text-sm">
                      <div className="w-4 h-4 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
                      Loading more...
                    </div>
                  ) : null}
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
  products: Product[];
  onOpenModal: (product: Product) => void;
  loading?: boolean;
  virtualScroll?: boolean;
  onScrolledToBottom?: () => void;
  hasMore?: boolean;
  isFetchingNextPage?: boolean;
}

export default function ProductGrid({
  products,
  onOpenModal,
  loading = false,
  virtualScroll = false,
  onScrolledToBottom,
  hasMore,
  isFetchingNextPage,
}: ProductGridProps) {
  if (loading) return <SkeletonGrid />;

  if (virtualScroll) {
    return (
      <VirtualGrid
        products={products}
        onOpenModal={onOpenModal}
        onScrolledToBottom={onScrolledToBottom}
        hasMore={hasMore}
        isFetchingNextPage={isFetchingNextPage}
      />
    );
  }

  return <StandardGrid products={products} onOpenModal={onOpenModal} />;
}
