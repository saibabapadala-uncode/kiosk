// src/types/catalog.ts

export interface Category {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  sortOrder: number;
  available: boolean;
  /** Product count in this category — populated by useCatalog after products load */
  itemCount?: number;
}

export interface ModifierOption {
  id: string;
  name: string;
  price: number;        // additional dollars on top of base/variant price
  default?: boolean;
  available: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;        // absolute price — replaces basePrice
  available: boolean;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  basePrice: number;
  imageUrl: string;
  available: boolean;
  popular: boolean;
  modifierGroups: ModifierGroup[];
  variants: ProductVariant[];
  tags: string[];
  allergens: string[];
  calories?: number;
  sortOrder: number;
  // From API — used for cart item and variant selection
  variantIds:       string[];       // variant_ids from products/list
  isSingleVariant:  boolean;        // is_single_variant from products/list
  // Dietary flags (from dietary_attributes field)
  isVeg:        boolean;
  isVegan:      boolean;
  isGlutenFree: boolean;
}

// Full catalog response (Straunt strategy — single fetch)
export interface CatalogResponse {
  categories: Category[];
  products: Product[];
}

// Paginated response (Holiq strategy)
export interface PaginatedProducts {
  data: Product[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface CatalogQueryParams {
  categoryId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}
