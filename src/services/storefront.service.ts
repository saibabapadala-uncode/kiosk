// src/services/storefront.service.ts
// Implements every API call found in:
//   kiosk_straunt_storefront/src/app/shared/services/api.service.ts
//
// ── Two URL patterns (identical to the Angular storefront) ─────────────────────
//
//  CATALOG  (offlineDBUrl = https://comm.uncodeapi.com/qa/)
//    No auth headers. application_id (number) + account_id (string) go in POST body only.
//    POST menu_organizer/{id}    → categories tree
//    POST products/list          → product list (with/without category filter)
//    POST search_store/list      → product search
//    POST variants/search        → variant details
//    POST store/details          → full store config (loaded once after channel select)
//
//  ORDERS   (DEV_URL = gateway, service_contract)
//    Full auth headers mirroring placeOrder() in api.service.ts.
//    POST DEV_URL + BLS.reviewAndSubmit   3832691499932242
//    POST DEV_URL + BLS.placeOrder        3856724470973475
//    POST DEV_URL + BLS.orderDetails      3828566399287269
//    POST DEV_URL + BLS.getOrderHistory   3876247119665544
//    POST DEV_URL + BLS.applyCoupon       3850346310060305
//    POST DEV_URL + BLS.getDeliveryCharges 3824830853793258
//
// ── Data flow ──────────────────────────────────────────────────────────────────
//
//  1. loadStoreDetails(channel.code)
//       → storeConfigStore.{store, userDetails}
//  2. getMenuOrganizer(store.menu_organizer_id)
//       → resp.data.menu_organizers__json_data.meta_data   ← actual path
//       → RawMenuCategory[]
//  3. getCategorySource(rawCat)
//       → transforms category_type/category_items → source_type/source_value
//  4. getAllProducts(storeId)  or  getProductsByCategory(menuCat, storeId)
//       → products/list with optional category_id filter

import axios from 'axios';
import { AUTH_CONFIG } from '@/config/auth.config';
import { useAuthStore } from '@/store/authStore';
import { useKioskChannelStore } from '@/store/kioskChannelStore';
import { useStoreConfigStore } from '@/store/storeConfigStore';
import { logger } from '@/utils/logger';

// ─── BLS IDs — from kiosk_straunt_storefront/src/app/core/util/constants.ts ───

const BLS = {
  reviewAndSubmit:    '3832691499932242',
  placeOrder:         '3856724470973475',
  updateOrder:        '3879859620849096',
  orderDetails:       '3828566399287269',
  getOrderHistory:    '3876247119665544',
  applyCoupon:        '3850346310060305',
  getDeliveryCharges: '3824830853793258',
  getAddresses:       '3825441927287336',
  createAddress:      '3829083285460891',
  deleteAddress:      '3830180873988295',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Raw category item inside menu_organizer meta_data.
 * Mirrors the object used in home.page.ts → getCategories().
 */
export interface RawMenuCategory {
  id:                   string | number;
  name:                 string;
  /** "system_category" | "smart_inventory" | "items" | "extenal_link" | "content_template" */
  category_type?:       string;
  /** For system_category — the actual product DB category IDs */
  category_items?:      Array<{ su_id: string | number; display_label?: string }>;
  /** For smart_inventory / items */
  category_type_value?: string | number | (string | number)[];
  option_headers?:      unknown[];
  is_active?:           boolean;
  [key: string]:        unknown;
}

/**
 * Normalised category passed to getProductsByCategory().
 * Produced by getCategorySource() — mirrors the storefront's getCategorySource().
 */
export interface MenuCategory {
  id:           string | number;
  name:         string;
  source_type:  string;
  source_value: string | number | (string | number)[];
  [key: string]: unknown;
}

export interface StorefrontProduct {
  id:                string;
  name:              string;
  pos_name?:         string;
  description:       string;
  pos_description?:  string;
  price:             number;
  pos_price?:        number;
  files:             Array<{ file_url: string }>;
  pos_files?:        Array<{ file_url: string }>;
  category_id:       string;
  is_single_variant: boolean;
  variant_ids:       string[];
  modifier:          unknown;
  dietary_attributes?: unknown;
  [key: string]:     unknown;
}

export interface TaxRate {
  id?:              string | number;
  name?:            string;
  tax_category_id?: string | number;
  tax_rate?:        string | number;
  rate?:            string | number;
  percentage?:      string | number;
  [key: string]:    unknown;
}

export interface PlaceOrderBody {
  store_id:          string | number;
  sales_channel_id?: string | number;
  items:             Array<{
    variant_id:     string | number;
    quantity:       number;
    modifiers?:     unknown[];
    special_notes?: string;
  }>;
  service_type?:     string;
  tip_amount?:       number;
  coupon_code?:      string;
  payment_source?:   unknown;
  [key: string]:     unknown;
}

export interface ReviewSubmitBody {
  store_id:      string | number;
  items:         unknown[];
  service_type?: string;
  [key: string]: unknown;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns credentials for CATALOG API calls (offlineDBUrl endpoints).
 *
 * Source reference — api.service.ts getMenuOrganizer() and getProductsByCategory():
 *   application_id → storeDetails.user_details.application_id   (store's own app ID)
 *   account_id     → storeDetails.user_details.account_id       (store's own account ID)
 *   user_name      → storeDetails.user_details.username         (store's service username)
 *
 * These come from the store/details API response (loadStoreDetails), NOT from
 * the auth login session. The catalog API authenticates using the store's own
 * application context, which can differ from the user's TAC login context.
 *
 * application_id is sent as a NUMBER per the reference cURL payload.
 */
function getCatalogCreds(): { application_id: number; account_id: string; user_name: string } {
  const { userDetails } = useStoreConfigStore.getState();

  if (!userDetails?.application_id) {
    throw new Error(
      '[storefront] storeConfigStore.userDetails.application_id is missing. ' +
      'loadStoreDetails() must succeed before catalog APIs can be called. ' +
      '[DEBUG] Check that store/details returned user_details.application_id',
    );
  }
  if (!userDetails?.account_id) {
    throw new Error(
      '[storefront] storeConfigStore.userDetails.account_id is missing. ' +
      '[DEBUG] Check store/details response for user_details.account_id',
    );
  }

  const creds = {
    application_id: Number(userDetails.application_id),
    account_id:     userDetails.account_id,
    user_name:      userDetails.username ?? '',
  };

  console.log('[storefront:creds] getCatalogCreds →', {
    application_id: creds.application_id,
    account_id:     creds.account_id,
    user_name:      creds.user_name,
    source:         'storeConfigStore.userDetails',
  });

  return creds;
}

/**
 * Catalog POST — offlineDBUrl pattern.
 * NO auth headers; application_id and account_id go in the body only.
 */
async function catalogPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${AUTH_CONFIG.OFFLINE_DB_URL}${path}`;
  const { data } = await axios.post<T>(url, body, {
    headers: { 'Content-Type': 'application/json', accept: 'application/json, text/plain, */*' },
    timeout: 20_000,
  });
  return data;
}

/**
 * Gateway POST — service_contract pattern.
 * Full auth headers matching api.service.ts#placeOrder.
 */
async function gatewayPost<T>(blsId: string, body: Record<string, unknown>): Promise<T> {
  const { user }                 = useAuthStore.getState();
  const { store, userDetails }   = useStoreConfigStore.getState();
  const channel                  = useKioskChannelStore.getState().channel;

  if (!user) throw new Error('[storefront] Not authenticated');

  const { data } = await axios.post<T>(`${AUTH_CONFIG.DEV_URL}${blsId}`, body, {
    headers: {
      'Content-Type':           'application/json',
      account_id:               userDetails?.account_id             || user.account_id,
      application_id:           userDetails?.application_id         || user.tac_application_id,
      environment_id:           userDetails?.environment_id         || AUTH_CONFIG.SHARED_ENVIRONMENT_ID,
      access_key:               user.access_key,
      controller_id:            store?.controller_id                || AUTH_CONFIG.CONTROLLER_ID,
      controller_data_id:       channel?.store_id                   || 'default_application_id',
      ext_app_id:               '2',
      is_from_shared_component: 'true',
      prd_id:                   userDetails?.app_id                 || AUTH_CONFIG.PRD_ID,
      shared_application_id:    userDetails?.shared_application_id  || AUTH_CONFIG.SHARED_APPLICATION_ID,
      shared_environment_id:    userDetails?.shared_environment_id  || AUTH_CONFIG.SHARED_ENVIRONMENT_ID,
    },
    timeout: 20_000,
  });
  return data;
}

// ─── getCategorySource ─────────────────────────────────────────────────────────
/**
 * Transforms a RawMenuCategory (from meta_data) into the normalised MenuCategory
 * shape expected by getProductsByCategory().
 *
 * Ported from:
 *   products.page.ts → getCategorySource()
 *   home.page.ts → selectCategory({ type: "category", category: rawCat })
 */
export function getCategorySource(rawCat: RawMenuCategory): MenuCategory {
  const catType = rawCat.category_type || 'system_category';
  // Spread rawCat first so explicit fields override any same-named keys from rawCat
  const base: MenuCategory = {
    ...rawCat,
    id:           rawCat.id,
    name:         rawCat.name,
    source_type:  catType,
    source_value: [],
  };

  if (catType === 'system_category') {
    const items = rawCat.category_items ?? [{ su_id: rawCat.id }];
    base.source_value = items.map((c) => String(c.su_id));
  } else if (catType === 'smart_inventory' || catType === 'items') {
    base.source_value = Array.isArray(rawCat.category_type_value)
      ? rawCat.category_type_value.map(String)
      : String(rawCat.category_type_value || rawCat.id);
  }

  return base;
}

// ─── CATALOG APIs ─────────────────────────────────────────────────────────────

/**
 * Load full store configuration using the kiosk channel's short code.
 * Must be called once after channel selection before any catalog API.
 *
 * POST https://comm.uncodeapi.com/qa/store/details
 * Body: { store_name: storeCode.toLowerCase() }
 */
// ── Session-scoped cache ───────────────────────────────────────────────────────
//
// _loadedForCode tracks which channel code was last successfully loaded THIS
// in-memory session.  It is intentionally NOT persisted — every new app start
// (or explicit resetCatalogSession() call) forces a fresh store/details call so
// the menu_organizer_id and catalog credentials are always up-to-date.
//
// The old implementation used conf.store.store_code (a different field than the
// channel code) as a cache key, which produced false cache hits that silently
// skipped the store/details API call even when the session was brand-new.
// That bug is fixed here: the ONLY valid cache hit is a previous in-session load
// for the exact same channel code.

let _loadingPromise: Promise<void> | null = null;
let _loadedForCode:  string | null        = null;

/**
 * Reset the in-session catalog cache so the next useCatalog() call forces a
 * fresh POST store/details request.  Call this at the start of every new order
 * (AttractScreen → handleStart) to ensure the menu_organizer_id and catalog
 * credentials are always current.
 */
export function resetCatalogSession(): void {
  _loadedForCode = null;
  logger.info('[storefront] catalog session reset — next load will call store/details fresh');
}

export async function loadStoreDetails(
  storeCode: string,
  options: { force?: boolean } = {},
): Promise<void> {
  const normalizedCode = storeCode.toLowerCase().trim();

  if (!normalizedCode) {
    throw new Error('[storefront] loadStoreDetails: storeCode must not be empty');
  }

  const conf = useStoreConfigStore.getState();

  // If the channel code changed from the last load, clear the stale config so
  // the new channel's credentials are fetched cleanly.
  if (_loadedForCode !== null && _loadedForCode !== normalizedCode && conf.isLoaded) {
    logger.info(`[storefront] channel changed from "${_loadedForCode}" → "${normalizedCode}", clearing stale config`);
    useStoreConfigStore.getState().clear();
    _loadedForCode = null;
  }

  // Cache hit: already loaded for this exact code THIS in-memory session.
  // Bootstrap data (isLoaded=true but _loadedForCode=null) is NOT a cache hit —
  // we always want a fresh API call at the start of each session.
  if (!options.force && _loadedForCode === normalizedCode && conf.isLoaded) {
    console.log(`[storefront:debug] loadStoreDetails — session cache hit for "${normalizedCode}"`);
    return;
  }

  // In-flight dedup — return the same promise to all concurrent callers
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = (async () => {
    useStoreConfigStore.getState().setLoading(true);
    logger.info(`[storefront] loading store details for "${normalizedCode}"`);
    console.log(`[storefront:debug] loadStoreDetails → POST store/details { store_name: "${normalizedCode}" }`);
    try {
      const rawResp = await catalogPost<Record<string, unknown>>('store/details', {
        store_name: normalizedCode,
      });

      // ── Unwrap { status, data } envelope ──────────────────────────────────────
      // Every catalog API (menu_organizer, products/list, taxrates/list) returns
      // { status: "success", data: { ...actual payload... } }.
      // store/details is no different.  Pass resp.data to parseConfig, NOT resp.
      // Without this unwrap, parseConfig reads resp.is_sales_channel/store/user_details
      // as undefined and ALL credentials + menu_organizer_id come out empty,
      // which causes getCatalogCreds() to throw BEFORE getMenuOrganizer() is called.
      const resp: Record<string, unknown> =
        rawResp?.data && typeof rawResp.data === 'object' && !Array.isArray(rawResp.data)
          ? rawResp.data as Record<string, unknown>
          : rawResp;

      console.log('[storefront:debug] loadStoreDetails response (after envelope unwrap) →', {
        envelope_detected:             rawResp !== resp,
        is_sales_channel:              resp.is_sales_channel,
        'store.id':                    (resp.store as Record<string, unknown>)?.id,
        'store.menu_organizer_id':     (resp.store as Record<string, unknown>)?.menu_organizer_id,
        'brand.menu_organizer_id':     (resp.brand as Record<string, unknown>)?.menu_organizer_id,
        'user_details.application_id': (resp.user_details as Record<string, unknown>)?.application_id,
        'user_details.account_id':     (resp.user_details as Record<string, unknown>)?.account_id,
        'user_details.username':       (resp.user_details as Record<string, unknown>)?.username,
        'user_details.user_name':      (resp.user_details as Record<string, unknown>)?.user_name,
      });
      _loadedForCode = normalizedCode;
      useStoreConfigStore.getState().setConfig(resp);
    } catch (err) {
      logger.error('[storefront] loadStoreDetails failed', err);
      console.error('[storefront:debug] loadStoreDetails ERROR →', err);
      useStoreConfigStore.getState().setError(
        err instanceof Error ? err.message : 'Failed to load store details',
      );
      throw err;
    } finally {
      _loadingPromise = null; // reset so a retry after error is allowed
    }
  })();

  return _loadingPromise;
}

/**
 * Load the menu organizer to get the category tree (meta_data).
 *
 * POST https://comm.uncodeapi.com/qa/menu_organizer/{menuOrganizerId}
 * Body: { application_id (number), account_id, s_created_ip, user_name }
 *
 * Response path (from home.page.ts):
 *   resp.data.menu_organizers__json_data.meta_data → RawMenuCategory[]
 *
 * Note: application_id is sent as a NUMBER per the reference cURL.
 */
export async function getMenuOrganizer(
  menuOrganizerId: string | number,
): Promise<RawMenuCategory[]> {
  // Source: api.service.ts getMenuOrganizer() — uses storeDetails.user_details credentials
  const creds = getCatalogCreds();
  logger.info(`[storefront] loading menu organizer ${menuOrganizerId}`);

  const requestBody = {
    application_id: creds.application_id,
    account_id:     creds.account_id,
    s_created_ip:   '1.0.0.1',
    user_name:      creds.user_name,
  };

  console.log('[storefront:debug] getMenuOrganizer request →', {
    url:  `${AUTH_CONFIG.OFFLINE_DB_URL}menu_organizer/${menuOrganizerId}`,
    body: requestBody,
  });

  const resp = await catalogPost<{
    data?: {
      menu_organizers__json_data?: {
        meta_data?: RawMenuCategory[];
      };
    };
  }>(
    `menu_organizer/${menuOrganizerId}`,
    requestBody,
  );

  console.log('[storefront:debug] getMenuOrganizer raw response →', resp);

  const categories = resp?.data?.menu_organizers__json_data?.meta_data ?? [];

  console.log('[storefront:debug] getMenuOrganizer extracted categories →', {
    count: categories.length,
    first: categories[0],
    ids:   categories.map((c) => ({ id: c.id, name: c.name, category_type: c.category_type, category_items_count: c.category_items?.length })),
  });

  logger.info(`[storefront] ${categories.length} categories from menu organizer`);
  return categories;
}

/**
 * Load tax rates for the store catalog session.
 *
 * POST https://comm.uncodeapi.com/qa/taxrates/list
 * Body: { application_id, account_id }
 */
export async function getTaxRates(): Promise<TaxRate[]> {
  const creds = getCatalogCreds();
  logger.info('[storefront] loading tax rates');

  const requestBody = {
    application_id: creds.application_id,
    account_id:     creds.account_id,
  };

  console.log('[storefront:debug] getTaxRates request →', {
    url:  `${AUTH_CONFIG.OFFLINE_DB_URL}taxrates/list`,
    body: requestBody,
  });

  const resp = await catalogPost<{ data?: TaxRate[] }>('taxrates/list', requestBody);
  const taxRates = resp.data ?? [];

  console.log('[storefront:debug] getTaxRates response →', {
    count: taxRates.length,
    sample: taxRates.slice(0, 3),
  });

  logger.info(`[storefront] ${taxRates.length} tax rate(s) loaded`);
  return taxRates;
}

/**
 * Load ALL products for the store without category filter.
 * Used for Straunt-style full catalog load (limit = 1000, filter client-side).
 *
 * POST https://comm.uncodeapi.com/qa/products/list
 */
export async function getAllProducts(
  storeId: string,
  limit   = 1000,
  offset  = 0,
): Promise<StorefrontProduct[]> {
  // Source: api.service.ts getProductsByCategory() — uses storeDetails.user_details credentials
  const creds = getCatalogCreds();
  if (!storeId) throw new Error('[storefront] getAllProducts: storeId is required');
  logger.info(`[storefront] loading all products for store ${storeId}`);

  console.log('[storefront:debug] getAllProducts request →', {
    url:      `${AUTH_CONFIG.OFFLINE_DB_URL}products/list`,
    store_id: storeId,
    application_id: creds.application_id,
    account_id:     creds.account_id,
    limit,
  });

  const resp = await catalogPost<{ data?: Record<string, unknown>[] }>(
    'products/list',
    {
      application_id: creds.application_id,
      account_id:     creds.account_id,
      store_id:       [storeId],
      table_name:     'products',
      limit,
      offset,
      sort:           'products__name',
      sort_type:      'asc',
      search_request: {
        select_columns: [
          'products__id',           'products__pos_name',    'products__pos_description',
          'products__pos_price',    'products__pos_files',   'products__name',
          'products__description',  'products__price',       'products__files',
          'products__tax_category_id', 'products__category_id', 'products__is_single_variant',
          'products__prod_size',    'products__brand',       'products__variant_ids',
          'products__type',         'products__modifier',    'products__dietary_attributes',
        ],
        filter_groups: {
          operator: 'and',
          filters: [
            { field: 'products__store_id', val: storeId,  cond: 'eq', data_type: 'bigint' },
            { field: 'products__status',   val: 'active', cond: 'eq', data_type: 'string' },
          ],
        },
      },
    },
  );

  const products = stripPrefix(resp.data ?? []);

  console.log('[storefront:debug] getAllProducts response →', {
    total:         products.length,
    sample3:       products.slice(0, 3).map((p) => ({
      id:          p.id,
      name:        p.name || p.pos_name,
      category_id: p.category_id,
    })),
    category_ids_sample: [...new Set(products.slice(0, 20).map((p) => String(p.category_id)))],
  });

  return products;
}

/**
 * Load products for a specific category (filtered by source_value/category IDs).
 * category must be the normalised MenuCategory (output of getCategorySource).
 *
 * POST https://comm.uncodeapi.com/qa/products/list  (or smart_inventory/execute)
 */
export async function getProductsByCategory(
  category: MenuCategory,
  storeId:  string,
  limit     = 1000,
  offset    = 0,
): Promise<StorefrontProduct[]> {
  const creds = getCatalogCreds();
  if (!storeId) throw new Error('[storefront] getProductsByCategory: storeId is required');

  const isSmartInventory = category.source_type === 'smart_inventory';
  const url  = isSmartInventory ? 'smart_inventory/execute' : 'products/list';
  const body: Record<string, unknown> = isSmartInventory
    ? {
        application_id:    creds.application_id,
        account_id:        creds.account_id,
        store_id:          [storeId],
        smart_inventory_id: Array.isArray(category.source_value)
          ? (category.source_value as (string | number)[]).join(',')
          : category.source_value,
        limit, offset,
        sort:      'variants__s_updated_at',
        sort_type: 'desc',
        data:      {},
      }
    : {
        application_id: creds.application_id,
        account_id:     creds.account_id,
        store_id:       [storeId],
        table_name:     'products',
        limit, offset,
        sort:           'products__name',
        sort_type:      'asc',
        search_request: {
          select_columns: [
            'products__id',        'products__pos_name',       'products__pos_description',
            'products__pos_price', 'products__pos_files',      'products__name',
            'products__description','products__price',          'products__files',
            'products__tax_category_id', 'products__category_id', 'products__is_single_variant',
            'products__prod_size', 'products__brand',           'products__variant_ids',
            'products__type',      'products__modifier',        'products__dietary_attributes',
          ],
          filter_groups: {
            operator: 'and',
            filters: [
              { field: 'products__store_id', val: storeId,  cond: 'eq', data_type: 'bigint' },
              { field: 'products__status',   val: 'active', cond: 'eq', data_type: 'string' },
            ],
          },
        },
      };

  // Add category filter when source_type === "system_category" with a source_value
  if (
    !isSmartInventory &&
    category.source_type === 'system_category' &&
    Array.isArray(category.source_value) &&
    (category.source_value as unknown[]).length > 0
  ) {
    const vals    = (category.source_value as (string | number)[]).join(',');
    const condOp  = (category.source_value as unknown[]).length > 1 ? 'inop' : 'eq';
    (
      (body.search_request as { filter_groups: { filters: unknown[] } })
        .filter_groups.filters
    ).push({
      field:     'products__category_id',
      val:       vals,
      cond:      condOp,
      data_type: 'bigint',
    });
  }

  const resp = await catalogPost<{ data?: Record<string, unknown>[] }>(url, body);
  return stripPrefix(resp.data ?? []);
}

/**
 * Search products by text.
 *
 * POST https://comm.uncodeapi.com/qa/search_store/list
 */
export async function searchProducts(
  searchText: string,
  storeId:    string,
  limit       = 1000,
  offset      = 0,
): Promise<StorefrontProduct[]> {
  const creds = getCatalogCreds();
  if (!searchText.trim()) throw new Error('[storefront] searchProducts: searchText is required');
  if (!storeId) throw new Error('[storefront] searchProducts: storeId is required');
  logger.info(`[storefront] searching: "${searchText}"`);

  const resp = await catalogPost<{ data?: Record<string, unknown>[] }>(
    'search_store/list',
    {
      application_id: creds.application_id,
      account_id:     creds.account_id,
      search_text:    searchText,
      store_id:       [storeId],
      limit, offset,
      sort:      'products__name',
      sort_type: 'asc',
    },
  );
  return stripPrefix(resp.data ?? []);
}

/**
 * Load updated variant details for cart items.
 *
 * POST https://comm.uncodeapi.com/qa/variants/search
 */
export async function getVariants(
  variantIds: (string | number)[],
  storeId:    string,
): Promise<Record<string, unknown>[]> {
  const creds = getCatalogCreds();
  if (!variantIds.length) throw new Error('[storefront] getVariants: variantIds is empty');
  if (!storeId) throw new Error('[storefront] getVariants: storeId is required');

  const resp = await catalogPost<{ data?: Record<string, unknown>[] }>(
    'variants/search',
    {
      application_id: creds.application_id,
      account_id:     creds.account_id,
      store_id:       [storeId],
      table_name:     'variants',
      limit:          variantIds.length || 1,
      offset:         0,
      sort:           'variants__s_updated_at',
      sort_type:      'desc',
      search_request: {
        select_columns: [],
        filter_groups: {
          operator: 'and',
          filters: [
            { field: 'variants__id',        val: variantIds.join(','), cond: 'inop', data_type: 'bigint' },
            { field: 'variants__is_active', val: true,                 cond: 'eq',   data_type: 'bit'    },
          ],
        },
      },
    },
  );
  return resp.data ?? [];
}

// ─── ORDER APIs ───────────────────────────────────────────────────────────────

/** POST DEV_URL/service_contract/3832691499932242 */
export async function reviewAndSubmit(body: ReviewSubmitBody): Promise<unknown> {
  return gatewayPost(BLS.reviewAndSubmit, body as unknown as Record<string, unknown>);
}

/** POST DEV_URL/service_contract/3856724470973475 */
export async function placeOrder(body: PlaceOrderBody): Promise<unknown> {
  return gatewayPost(BLS.placeOrder, body as unknown as Record<string, unknown>);
}

/** POST DEV_URL/service_contract/3828566399287269 */
export async function getOrderDetails(orderId: string): Promise<unknown> {
  return gatewayPost(BLS.orderDetails, { order_id: orderId });
}

/** POST DEV_URL/service_contract/3876247119665544 */
export async function getOrderHistory(body: Record<string, unknown>): Promise<unknown> {
  return gatewayPost(BLS.getOrderHistory, body);
}

/** POST DEV_URL/service_contract/3850346310060305 */
export async function applyCoupon(
  couponCode: string,
  amount:     number,
  storeId:    string,
  customerId?: string,
): Promise<unknown> {
  return gatewayPost(BLS.applyCoupon, {
    coupon_code: couponCode,
    customer_id: customerId ?? '',
    amount,
    store_id: storeId,
  });
}

/** POST DEV_URL/service_contract/3824830853793258 */
export async function getDeliveryCharges(body: Record<string, unknown>): Promise<unknown> {
  return gatewayPost(BLS.getDeliveryCharges, body);
}

// ─── Internal util ────────────────────────────────────────────────────────────

/**
 * Strip the "products__" prefix from API response field names.
 * Mirrors: api.service.ts → getProductsByCategory() forEach loop.
 */
function stripPrefix(rows: Record<string, unknown>[]): StorefrontProduct[] {
  return rows.map((item) => {
    const cleaned: Record<string, unknown> = {};
    for (const key in item) {
      cleaned[key.replace('products__', '')] = item[key];
    }
    return cleaned as StorefrontProduct;
  });
}
