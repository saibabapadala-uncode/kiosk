// src/store/catalogStore.ts
// Single source of truth for catalog data (categories + products).
// Populated by catalog.service.ts loadCatalog() — never populated here.
// Read by useCatalog() hook and AttractScreen.

import { create } from 'zustand';
import type { Category, Product } from '@/types/catalog';

interface CatalogState {
  categories: Category[];
  products:   Product[];
  isLoading:  boolean;
  error:      string | null;

  setLoading: (v: boolean) => void;
  setData:    (categories: Category[], products: Product[]) => void;
  setError:   (e: string | null) => void;
  clear:      () => void;
}

export const useCatalogStore = create<CatalogState>()((set) => ({
  categories: [],
  products:   [],
  isLoading:  false,
  error:      null,

  setLoading: (isLoading) => set({ isLoading, error: null }),
  setData:    (categories, products) => set({ categories, products, isLoading: false, error: null }),
  setError:   (error) => set({ error, isLoading: false }),
  clear:      () => set({ categories: [], products: [], error: null, isLoading: false }),
}));
