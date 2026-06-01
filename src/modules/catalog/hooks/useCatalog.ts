// src/modules/catalog/hooks/useCatalog.ts
//
// Thin hook layer over catalogStore.
// Does NOT make any API calls — data loading is handled exclusively by
// catalog.service.ts loadCatalog(), which is called from:
//   • AttractScreen  useIonViewWillEnter
//   • CatalogScreen  useIonViewWillEnter
//   • CatalogScreen  Retry button
//
// This file only exposes reactive selectors so components re-render when
// catalogStore state changes.

import { useMemo } from 'react';
import { useCatalogStore } from '@/store/catalogStore';
import type { CatalogResponse, Product } from '@/types/catalog';

// ─── Main hook — returns same shape as old TanStack Query result ──────────────
// Shape is intentionally compatible so CatalogScreen changes are minimal.

export function useCatalog(): {
  data:      CatalogResponse | undefined;
  isLoading: boolean;
  isError:   boolean;
  error:     string | null;
} {
  const categories = useCatalogStore((s) => s.categories);
  const products   = useCatalogStore((s) => s.products);
  const isLoading  = useCatalogStore((s) => s.isLoading);
  const error      = useCatalogStore((s) => s.error);

  const data: CatalogResponse | undefined =
    categories.length > 0 || products.length > 0
      ? { categories, products }
      : undefined;

  return { data, isLoading, isError: !!error, error };
}

// ─── Client-side product filter ───────────────────────────────────────────────
// No network call — filters the in-memory products from catalogStore.
// Called on every category tab click and search input change.

export function useFilteredProducts(
  products:   Product[] | undefined,
  categoryId: string | null,
  searchTerm: string,
): Product[] {
  return useMemo(() => {
    if (!products?.length) return [];

    let result = products.filter((p) => p.available);

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term) ||
          p.tags.some((t) => t.toLowerCase().includes(term)),
      );
    } else if (categoryId) {
      result = result.filter((p) => p.categoryId === categoryId);
    }
    // categoryId === null → show all products

    return result.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [products, categoryId, searchTerm]);
}

// ─── Legacy export — kept for any remaining import references ─────────────────
// CatalogScreen imported this; now unused but avoids breaking the build while
// callers are updated.
export function catalogQueryKey(_channelId?: string | null): string[] {
  return ['catalog', 'full', _channelId ?? ''];
}
