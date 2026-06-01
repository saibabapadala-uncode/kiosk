// src/modules/catalog/hooks/useCatalogPaginated.ts
// Holiq strategy: paginated API with server-side filtering.
import { useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { getStaticCategories, getStaticProductsPage } from '@/services/static.catalog';
import type { Category, PaginatedProducts } from '@/types/catalog';

const PAGE_SIZE = 20;

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: getStaticCategories,
    staleTime: 30 * 60 * 1000, // categories rarely change
    gcTime: 60 * 60 * 1000,
  });
}

export function useCatalogPaginated(params: {
  categoryId?: string | null;
  search?: string;
}) {
  const { categoryId, search } = params;

  return useInfiniteQuery<PaginatedProducts>({
    queryKey: ['catalog', 'paginated', { categoryId, search }],
    queryFn: ({ pageParam }) => getStaticProductsPage({
      page: Number(pageParam),
      pageSize: PAGE_SIZE,
      categoryId,
      search,
    }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Flatten infinite query pages into a single product array
export function useFlatProducts(
  data: ReturnType<typeof useCatalogPaginated>['data'],
) {
  return useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
}
