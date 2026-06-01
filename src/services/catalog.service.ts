// src/services/catalog.service.ts
//
// Complete rewrite of the Menu Links → Categories → Products loading flow.
// Mirrors kiosk_straunt_storefront/home.page.ts + products.page.ts exactly.
//
// Called explicitly on EVERY trigger — no caching, no staleTime, no React Query:
//   • "Tap Anywhere to Order"  (AttractScreen useIonViewWillEnter)
//   • "View Menu"              (CatalogScreen useIonViewWillEnter)
//   • Retry button             (CatalogScreen error state onClick)
//
// Flow:
//   1.  Ensure store/details loaded → get menu_organizer_id + store_id
//   2.  POST menu_organizer/{id}    → RawMenuCategory[] (meta_data)
//   3.  Build su_id → category id lookup
//   4.  Map meta_data → Category[]
//   5.  POST products/list          → StorefrontProduct[]
//   6.  Map products → Product[], assign categoryId via lookup
//   7.  Calculate itemCount per category
//   8.  Write to catalogStore → Zustand → UI re-renders
//
// Credentials:
//   application_id → kiosk_auth_user.tac_application_id  (as specified)
//   account_id     → kiosk_auth_user.account_id
//   user_name      → kiosk_auth_user.name
//   s_created_ip   → "1.0.0.1"

import axios from 'axios';
import { AUTH_CONFIG } from '@/config/auth.config';
import { useAuthStore } from '@/store/authStore';
import { useKioskChannelStore } from '@/store/kioskChannelStore';
import { useStoreConfigStore } from '@/store/storeConfigStore';
import { useCatalogStore } from '@/store/catalogStore';
import { loadStoreDetails } from '@/services/storefront.service';
import type { Category, Product } from '@/types/catalog';
import type { RawMenuCategory, StorefrontProduct } from '@/services/storefront.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildCategoryLookup(rawCats: RawMenuCategory[]): Map<string, string> {
  const map = new Map<string, string>(); // su_id → menu-organizer category id
  rawCats.forEach((raw) => {
    const menuCatId = String(raw.id);
    const items = raw.category_items ?? [{ su_id: raw.id }];
    items.forEach((item) => map.set(String(item.su_id), menuCatId));
  });
  return map;
}

function mapCategory(raw: RawMenuCategory, idx: number): Category {
  return {
    id:          String(raw.id),
    name:        String(raw.name ?? ''),
    description: String((raw.description as string) ?? ''),
    imageUrl:    (raw.image_url ?? raw.logo_url ?? raw.image) as string | undefined,
    // Source has is_active filter commented out — show all categories
    available:   raw.is_active == null || Boolean(raw.is_active),
    sortOrder:   Number(raw.sort_order ?? raw.position ?? idx),
    itemCount:   0, // calculated after products load
  };
}

// ─── JSON field parser ────────────────────────────────────────────────────────
// API returns files / modifier as JSON string OR already-parsed object/array.
// Source: api.service.ts → typeof x == "string" ? JSON.parse(x) : x

function safeParseJson(value: unknown): unknown {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value;
}

function parseJsonArray<T>(value: unknown): T[] {
  const parsed = safeParseJson(value);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

// ─── Modifier parser ──────────────────────────────────────────────────────────
// Source structure (from reference assets): p.modifier.modifiers[]
// Each group has: id, name, is_required, min_qty, max_qty, options[]
// Each option has: id, name, price, is_default
//
// Handles both { modifiers: [...] } object form AND flat array form.

import type { ModifierGroup, ModifierOption } from '@/types/catalog';

function parseModifierGroups(raw: unknown): ModifierGroup[] {
  if (!raw) return [];
  const obj = safeParseJson(raw);
  if (!obj) return [];

  // Shape 1 (most common): { modifiers: [...] }
  const byModifiers = (obj as Record<string, unknown>).modifiers;
  if (Array.isArray(byModifiers) && byModifiers.length > 0)
    return byModifiers.map((g, i) => parseOneGroup(g as Record<string, unknown>, i));

  // Shape 2: flat array [group, group, ...]
  if (Array.isArray(obj) && obj.length > 0)
    return obj.map((g, i) => parseOneGroup(g as Record<string, unknown>, i));

  return [];
}

function parseOneGroup(g: Record<string, unknown>, idx: number): ModifierGroup {
  const minQty = Number(g.min_qty ?? g.min_count ?? g.minSelections ?? 0);
  const maxQty = Number(g.max_qty ?? g.max_count ?? g.maxSelections ?? 1);

  // ── Options field name lookup ─────────────────────────────────────────────
  // Source (kiosk_straunt_storefront global.service.ts + checkout.page.ts):
  //   Each group item has: id, name, default_price, item_available, sell_item_own
  //
  // Field priority:
  //   "items"          — primary field name in the actual API response
  //   "options"        — fallback for alternate API shapes
  //   "option_values"  — older API versions
  //   "modifier_options" — another variant
  //   "modifiers"      — when groups are nested as flat array
  const rawOptions =
    g.items ??          // ← PRIMARY: confirmed field name from source project
    g.options ??
    g.option_values ??
    g.modifier_options ??
    g.modifiers ??
    [];

  const options: ModifierOption[] = parseJsonArray<Record<string, unknown>>(rawOptions).map(
    (o, i) => ({
      id:   String(o.id ?? o.modifier_id ?? i),
      name: String(o.name ?? o.modifier_name ?? o.label ?? ''),

      // ── Price: source uses "default_price" (confirmed: checkout.page.ts line 698)
      //    total += +m.default_price * m.quantity * p.quantity
      price: Number(
        o.default_price ??  // ← PRIMARY field name (source: default_price)
        o.price ??
        o.modifier_price ??
        o.additional_price ??
        0,
      ),

      default: Boolean(o.is_default ?? o.default ?? false),

      // ── Available: source uses "item_available" (confirmed: global.service.ts modifiersMatch)
      //    m.item_available === mod2[index].item_available
      available: o.item_available != null
        ? Boolean(o.item_available)
        : o.is_active != null
          ? Boolean(o.is_active)
          : true,
    }),
  );

  return {
    id:            String(g.id ?? g.modifier_group_id ?? idx),
    name:          String(g.name ?? g.modifier_group_name ?? g.group_name ?? ''),
    required:      Boolean(g.is_required ?? g.required ?? (minQty > 0)),
    minSelections: minQty,
    maxSelections: Math.max(maxQty, 1),
    options,
  };
}

function mapProduct(p: StorefrontProduct, categoryId: string): Product {
  // pos_files / files can arrive as a JSON string OR array
  // Source: api.service.ts setProducts() → d.files = typeof d.files == "string" ? JSON.parse(d.files) : d.files
  const filesRaw = p.pos_files ?? p.files;
  const fileList = parseJsonArray<Record<string, unknown>>(
    typeof filesRaw === 'string' ? filesRaw : JSON.stringify(filesRaw ?? []),
  );

  const imageUrl = fileList
    .map((f) => {
      let url = String(f.file_url ?? '');
      if (!url && f.file_id)
        url = `https://assets.growith.io/images/${f.file_id}`;
      return url.replace('https://venus-scocu-assets.s3.amazonaws.com/', 'https://assets.scocu.net/');
    })
    .find((u) => !!u) ?? '';

  // Parse modifier groups from p.modifier.modifiers[]
  const modifierGroups = parseModifierGroups(p.modifier);

  // Dietary attributes — source: p.dietary_attributes.includes('Veg') etc.
  const dietaryRaw = parseJsonArray<string>(p.dietary_attributes) as string[];
  const dietaryStr = typeof p.dietary_attributes === 'string'
    ? p.dietary_attributes
    : dietaryRaw.join(',');

  // variant_ids: used as cart item ID for single-variant products
  const variantIds = parseJsonArray<string>(p.variant_ids).map(String);

  return {
    id:              String(p.id ?? ''),
    categoryId,
    name:            String(p.pos_name ?? p.name ?? ''),
    description:     String(p.pos_description ?? p.description ?? ''),
    basePrice:       Number(p.pos_price ?? p.price ?? 0),
    imageUrl,
    available:       true,
    popular:         Boolean(p.popular),
    modifierGroups,
    variants:        [],
    tags:            parseJsonArray<string>(p.tags),
    allergens:       parseJsonArray<string>(p.allergens),
    calories:        p.calories != null ? Number(p.calories) : undefined,
    sortOrder:       Number(p.sort_order ?? 0),
    variantIds,
    isSingleVariant: Boolean(p.is_single_variant),
    isVeg:           dietaryStr.includes('Veg'),
    isVegan:         dietaryStr.includes('Vegan'),
    isGlutenFree:    dietaryStr.includes('Gluten Free'),
  };
}

function stripPrefix(rows: Record<string, unknown>[]): StorefrontProduct[] {
  return rows.map((item) => {
    const out: Record<string, unknown> = {};
    for (const key in item) out[key.replace('products__', '')] = item[key];
    return out as StorefrontProduct;
  });
}

// ─── Product Detail (variants/search) ─────────────────────────────────────────
//
// Called when a product card is tapped — before showing the modal.
// Mirrors the kiosk_straunt_storefront quick-view flow:
//   1. POST variants/search filtered by products__id
//   2. Parse all variant rows → VariantData[] (for size/option selector)
//   3. Parse products__modifier from first row → ModifierGroup[]
//   4. Return ProductDetail for the modal to render
//
// Two cURLs shown in requirements are the same request — one call is enough.

export interface VariantData {
  id:        string;   // variants__id — used as cart item's variant.id
  price:     number;   // variants__pos_price ?? variants__price
  name:      string;   // variant label (e.g. "Small", "Large")
  available: boolean;  // variants__is_active
  imageUrl:  string;   // variants__files[0] or products__pos_files[0]
}

export interface ProductDetail {
  productId:      string;
  name:           string;
  description:    string;
  basePrice:      number;
  imageUrl:       string;
  variants:       VariantData[];    // empty when single-variant (no size choice needed)
  modifierGroups: ModifierGroup[];  // from products__modifier via variants/search
  isVeg:          boolean;
  isVegan:        boolean;
  isGlutenFree:   boolean;
  calories?:      number;
  allergens:      string[];
}

// Exclude columns exactly as in the reference cURL — avoids sending unnecessary data
const VARIANTS_EXCLUDE_COLS = [
  'variants__sku','variants__weight','variants__height','variants__width',
  'variants__depth','variants__is_master','variants__product_id',
  'variants__cost_price','variants__cost_currency','variants__track_inventory',
  'variants__discontinue_on','variants__private_metadata','variants__barcode',
  'variants__stock','variants__compare_price','variants__barcode_type',
  'variants__price_currency','variants__compare_price_currency',
  'variants__cost_price_currency_symbol','variants__compare_price_currency_symbol',
  'variants__price_currency_symbol','variants__application_id','variants__account_id',
  'variants__is_deleted','variants__s_created_ip','variants__s_updated_ip',
  'variants__s_created_by','variants__s_updated_by','variants__s_created_at','variants__s_updated_at',
  'products__id','products__available_on','products__tax_category_id','products__promotionable',
  'products__meta_title','products__discontinue_on','products__status','products__store_id',
  'products__taxon_id','products__category_id','products__option_type_ids','products__sku',
  'products__addon_id','products__barcode','products__service_type','products__price',
  'products__industry_id','products__is_single_variant','products__application_id',
  'products__account_id','products__is_deleted','products__s_created_ip','products__s_updated_ip',
  'products__s_created_by','products__s_updated_by','products__s_created_at','products__s_updated_at',
  'products__brand','products__abv','products__country_of_origin','products__size',
  'products__tasting_notes','products__years_aged','products__speciality','products__base_ingridients',
  'products__food_pairing','products__product_type','products__region',
  'search_variant_key','search_product_key','search_key_option_values','variants__options_c',
];

function resolveImage(raw: unknown): string {
  const list = parseJsonArray<Record<string, unknown>>(
    typeof raw === 'string' ? raw : JSON.stringify(raw ?? []),
  );
  return list
    .map((f) => {
      let url = String(f.file_url ?? '');
      if (!url && f.file_id) url = `https://assets.growith.io/images/${f.file_id}`;
      return url.replace('https://venus-scocu-assets.s3.amazonaws.com/', 'https://assets.scocu.net/');
    })
    .find((u) => !!u) ?? '';
}

export async function loadProductDetail(product: Product): Promise<ProductDetail> {
  let storeConf   = useStoreConfigStore.getState();
  let userDetails = storeConf.userDetails;

  // If credentials are missing, force-refresh store/details (bypass in-session cache).
  // We pass { force: true } because the cache may be set even when parseConfig returned
  // empty credentials (the API response has them at an unexpected field path).
  if (!userDetails?.application_id || !userDetails?.account_id) {
    const channel = useKioskChannelStore.getState().channel;
    if (channel?.code) {
      await loadStoreDetails(channel.code, { force: true });
      storeConf   = useStoreConfigStore.getState();
      userDetails = storeConf.userDetails;
    }
  }

  // Credential resolution: userDetails (from store/details) → authUser (from login) fallback.
  // authUser.tac_application_id is the same platform application_id used in catalog APIs.
  const authUser = useAuthStore.getState().user;
  const appId    = Number(userDetails?.application_id || authUser?.tac_application_id || '0');
  const acctId   = userDetails?.account_id            || authUser?.account_id            || '';
  const username = userDetails?.username ?? '';

  console.log('[productDetail] credentials', {
    source: userDetails?.application_id ? 'userDetails' : 'authUser-fallback',
    appId, acctId,
    userDetails_appId:   userDetails?.application_id,
    authUser_tacAppId:   authUser?.tac_application_id,
  });

  if (!appId || !acctId)
    throw new Error('[productDetail] No credentials available — please log in again');
  if (!storeConf.store?.id)
    throw new Error('[productDetail] Store not loaded');

  const storeId = storeConf.store.id;

  // Shared headers — body credentials match subscribed_tac_* headers
  const apiHeaders: Record<string, string> = {
    'Content-Type':                  'application/json',
    'accept':                        '*/*',
    'enable_cross_env':              'true',
    'x-api-key':                     'becca70d6ea142689e647de3351a4e4d',
    'subscribed_tac_account_id':     acctId,
    'subscribed_tac_application_id': String(appId),
    'subscribed_tac_username':       username,
  };

  // ── API 1: variants/search ─────────────────────────────────────────────────
  // Returns variant rows with variants__variant_options.config_data (size options)
  // and products__modifier.modifiers[] (modifier group IDs).

  console.log('[productDetail] API 1 → variants/search', {
    product_id: product.id, product_name: product.name,
    application_id: appId, account_id: acctId, store_id: storeId,
  });

  type Row = Record<string, unknown>;
  const varResp = await axios.post<{ data?: Row[] }>(
    `${AUTH_CONFIG.OFFLINE_DB_URL}variants/search`,
    {
      application_id: appId,
      account_id:     acctId,
      store_id:       [storeId],
      table_name:     'variants',
      limit:          1000,
      offset:         0,
      sort:           'variants__name',
      sort_type:      'asc',
      search_request: {
        select_columns:  [],
        exclude_columns: VARIANTS_EXCLUDE_COLS,
        filter_groups: {
          operator: 'and',
          filters: [
            { field: 'products__id', val: Number(product.id), cond: 'eq', data_type: 'bigint' },
          ],
        },
      },
    },
    { headers: apiHeaders, timeout: 20_000 },
  );

  const rows: Row[] = varResp.data?.data ?? [];

  console.log('[productDetail] API 1 ← variants/search', {
    rows: rows.length,
    has_variant_options: !!(rows[0]?.variants__variant_options),
    has_modifier:        !!(rows[0]?.products__modifier),
  });

  // Fallback: no rows → use catalog snapshot
  if (rows.length === 0) {
    console.warn('[productDetail] 0 rows — using catalog snapshot');
    return {
      productId:      product.id,
      name:           product.name,
      description:    product.description,
      basePrice:      product.basePrice,
      imageUrl:       product.imageUrl,
      variants:       [],
      modifierGroups: product.modifierGroups,
      isVeg:          product.isVeg,
      isVegan:        product.isVegan,
      isGlutenFree:   product.isGlutenFree,
      calories:       product.calories,
      allergens:      product.allergens,
    };
  }

  // ── Extract size options from variants__variant_options.config_data ────────
  // Each config_data item is a purchasable size (Small / Large / Extra Large).
  // id = the option's own ID used as the variant selection in the cart.

  type ConfigOption = {
    option_name:   string;
    option_price:  string | number;
    is_active:     boolean;
    id:            number | string;
    modifiers?:    unknown[];
    has_modifier?: boolean;
  };

  const variantOptions = rows[0].variants__variant_options as { config_data?: ConfigOption[] } | null;
  const configData: ConfigOption[] = variantOptions?.config_data ?? [];

  const prodImageUrl =
    resolveImage(rows[0].products__pos_files ?? rows[0].products__files) || product.imageUrl;

  const variants: VariantData[] = configData
    .filter((opt) => opt.is_active !== false)
    .map((opt): VariantData => ({
      id:        String(opt.id),
      name:      String(opt.option_name),
      price:     Number(opt.option_price),
      available: opt.is_active !== false,
      imageUrl:  prodImageUrl,
    }));

  // ── Extract modifier group metadata from products__modifier ────────────────
  // Each group carries: modifier_group_id, modifier_group_name, selected_modifiers
  // (comma-separated modifier IDs), is_required, min_qty, max_qty.

  const rawModifier  = rows[0].products__modifier;
  const parsedModObj = typeof rawModifier === 'string'
    ? (() => { try { return JSON.parse(rawModifier as string); } catch { return null; } })()
    : rawModifier;

  interface RawModGroup {
    modifier_group_id:   number | string;
    modifier_group_name: string;
    selected_modifiers:  string;   // comma-separated modifier IDs
    is_required:         boolean;
    min_qty:             number;
    max_qty:             number;
    min_count:           number;
    max_count:           number;
    is_customize?:       boolean;
  }

  const rawModGroups: RawModGroup[] =
    (parsedModObj as { modifiers?: RawModGroup[] } | null)?.modifiers ?? [];

  // Collect all unique modifier IDs across all groups
  const allModifierIds: string[] = [];
  for (const g of rawModGroups) {
    if (!g.selected_modifiers) continue;
    for (const id of g.selected_modifiers.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!allModifierIds.includes(id)) allModifierIds.push(id);
    }
  }

  // ── API 2: modifiers/search ────────────────────────────────────────────────
  // Fetches full modifier option details (name, price, availability) for the IDs
  // collected from products__modifier.modifiers[].selected_modifiers.

  let modifierGroups: ModifierGroup[] = [];

  if (allModifierIds.length > 0) {
    console.log('[productDetail] API 2 → modifiers/search', {
      ids: allModifierIds, count: allModifierIds.length,
    });

    const modResp = await axios.post<{ data?: Row[] }>(
      `${AUTH_CONFIG.OFFLINE_DB_URL}modifiers/search`,
      {
        application_id: appId,
        account_id:     acctId,
        limit:          1000,
        offset:         0,
        sort:           'modifiers__s_updated_at',
        sort_type:      'desc',
        search_request: {
          select_columns: [
            'modifiers__id',
            'modifiers__name',
            'modifiers__default_price',
            'modifiers__item_available',
            'modifiers__sell_item_own',
            'modifiers__tax_category_id',
            'modifiers__quantity',
          ],
          exclude_columns: [],
          filter_groups: {
            operator: 'and',
            filters: [
              {
                field:     'modifiers__id',
                val:       allModifierIds.join(','),
                cond:      'inop',
                data_type: 'bigint',
              },
            ],
          },
        },
      },
      { headers: apiHeaders, timeout: 20_000 },
    );

    const modRows: Row[] = modResp.data?.data ?? [];

    console.log('[productDetail] API 2 ← modifiers/search', {
      rows: modRows.length,
      sample: modRows.slice(0, 3).map((r) => ({
        id: r.modifiers__id, name: r.modifiers__name, price: r.modifiers__default_price,
      })),
    });

    // Build lookup: modifiers__id → full row
    const modLookup = new Map<string, Row>();
    for (const row of modRows) {
      modLookup.set(String(row.modifiers__id), row);
    }

    // Build ModifierGroup[] using group metadata + fetched modifier details
    modifierGroups = rawModGroups
      .filter((g) => !!g.selected_modifiers)
      .map((g, idx): ModifierGroup => {
        const optionIds = g.selected_modifiers.split(',').map((s) => s.trim()).filter(Boolean);
        const options: ModifierOption[] = optionIds
          .map((oid): ModifierOption | null => {
            const mod = modLookup.get(oid);
            if (!mod) return null;
            return {
              id:        String(mod.modifiers__id),
              name:      String(mod.modifiers__name ?? ''),
              price:     Number(mod.modifiers__default_price ?? 0),
              available: mod.modifiers__item_available != null
                ? Boolean(mod.modifiers__item_available)
                : true,
              default: false,
            };
          })
          .filter((o): o is ModifierOption => o !== null);

        const minSel = Number(g.min_qty ?? g.min_count ?? 0);
        const maxSel = Number(g.max_qty ?? g.max_count ?? 0);
        // max=0 means unlimited — cap at number of options so UI radio/checkbox logic works
        const effectiveMax = maxSel === 0 ? (options.length || 1) : maxSel;

        return {
          id:            String(g.modifier_group_id ?? idx),
          name:          String(g.modifier_group_name ?? ''),
          required:      Boolean(g.is_required ?? (minSel > 0)),
          minSelections: minSel,
          maxSelections: Math.max(effectiveMax, 1),
          options,
        };
      })
      .filter((g) => g.options.length > 0);
  } else {
    // No modifier IDs in response — fall back to catalog snapshot
    modifierGroups = product.modifierGroups;
  }

  // ── Build ProductDetail ────────────────────────────────────────────────────
  const name        = String(rows[0].products__pos_name ?? rows[0].products__name ?? product.name);
  const description = String(rows[0].products__pos_description ?? rows[0].products__description ?? product.description);
  const basePrice   = variants[0]?.price ?? product.basePrice;

  const dietaryRaw = rows[0].products__dietary_attributes;
  const dietaryArr = Array.isArray(dietaryRaw) ? (dietaryRaw as string[]) : [];
  const dietaryStr = typeof dietaryRaw === 'string' ? dietaryRaw : dietaryArr.join(',');
  const allergens  = parseJsonArray<string>(
    rows[0].products__allergens ?? rows[0].allergens ?? product.allergens,
  );

  return {
    productId:      product.id,
    name,
    description,
    basePrice,
    imageUrl:       variants[0]?.imageUrl || prodImageUrl || product.imageUrl,
    // Show variant selector only when there are multiple size options
    variants:       variants.length > 1 ? variants : [],
    modifierGroups,
    isVeg:          dietaryArr.includes('Veg')        || dietaryStr.includes('Veg'),
    isVegan:        dietaryArr.includes('Vegan')       || dietaryStr.includes('Vegan'),
    isGlutenFree:   dietaryArr.includes('Gluten Free') || dietaryStr.includes('Gluten Free'),
    calories:       rows[0].products__calories != null
      ? Number(rows[0].products__calories)
      : product.calories,
    allergens,
  };
}

// ─── Concurrency guard ────────────────────────────────────────────────────────
// Prevents a double-load when AttractScreen + CatalogScreen both fire
// useIonViewWillEnter on the same page transition.
let _inFlight: Promise<void> | null = null;

// ─── Main entry point ─────────────────────────────────────────────────────────
// Public. Called directly from every trigger point — no React Query involved.

export async function loadCatalog(): Promise<void> {
  if (_inFlight) {
    console.log('[MENU] Already loading — returning in-flight promise');
    return _inFlight;
  }

  _inFlight = _load().finally(() => { _inFlight = null; });
  return _inFlight;
}

async function _load(): Promise<void> {
  const catalog  = useCatalogStore.getState();
  const authUser = useAuthStore.getState().user;
  const channel  = useKioskChannelStore.getState().channel;

  // ── [MENU] Start loading ───────────────────────────────────────────────────
  console.log('[MENU] Start loading', {
    channel_code: channel?.code,
    has_user:     !!authUser,
    tac_app_id:   authUser?.tac_application_id,
    account_id:   authUser?.account_id,
  });

  if (!authUser?.tac_application_id || !authUser?.account_id) {
    console.error('[MENU] Auth credentials missing — aborting');
    catalog.setError('Not authenticated. Please log in again.');
    return;
  }
  if (!channel?.code) {
    console.error('[MENU] No kiosk channel selected — aborting');
    catalog.setError('No kiosk channel selected. Please log in again.');
    return;
  }

  catalog.setLoading(true);

  // ── Step 0: Ensure store/details is loaded ─────────────────────────────────
  // loadStoreDetails caches per storeCode — re-uses if already loaded, reloads
  // if channel changed. Provides menu_organizer_id and store.id.
  try {
    await loadStoreDetails(channel.code);
  } catch (err) {
    console.error('[MENU] store/details failed', err);
    catalog.setError(err instanceof Error ? err.message : 'Failed to load store configuration');
    return;
  }

  const storeConf       = useStoreConfigStore.getState();
  const menuOrganizerId = storeConf.store?.menu_organizer_id;
  const storeId         = storeConf.store?.id;

  if (!menuOrganizerId) {
    console.error('[MENU] menu_organizer_id missing from store config', storeConf.store);
    catalog.setError('Store menu configuration is missing (no menu_organizer_id).');
    return;
  }
  if (!storeId) {
    console.error('[MENU] store.id missing from store config');
    catalog.setError('Store ID is missing from configuration.');
    return;
  }

  // ── Step 1: Credentials ────────────────────────────────────────────────────
  // application_id → kiosk_auth_user.tac_application_id  (as specified)
  const creds = {
    application_id: Number(authUser.tac_application_id),
    account_id:     authUser.account_id,
    user_name:      authUser.name ?? '',
    s_created_ip:   '1.0.0.1',
  };

  // ── Step 2: Call menu_organizer API ───────────────────────────────────────
  const menuUrl = `${AUTH_CONFIG.OFFLINE_DB_URL}menu_organizer/${menuOrganizerId}`;
  console.log('[MENU] Calling menu_organizer API', { url: menuUrl, body: creds });

  let rawCategories: RawMenuCategory[] = [];
  try {
    const resp = await axios.post<{
      status?: string;
      data?: {
        menu_organizers__id?: string | number;
        menu_organizers__name?: string;
        menu_organizers__json_data?: {
          meta_data?: RawMenuCategory[];
        };
      };
    }>(menuUrl, creds, {
      headers: { 'Content-Type': 'application/json', accept: 'application/json, text/plain, */*' },
      timeout: 20_000,
    });

    console.log('[MENU] Response received', {
      status:       resp.data?.status,
      organizer_id: resp.data?.data?.['menu_organizers__id'],
      name:         resp.data?.data?.['menu_organizers__name'],
      has_meta:     !!resp.data?.data?.menu_organizers__json_data?.meta_data,
    });

    rawCategories = resp.data?.data?.menu_organizers__json_data?.meta_data ?? [];
  } catch (err) {
    console.error('[MENU] menu_organizer API error', err);
    catalog.setError(err instanceof Error ? err.message : 'Failed to load menu');
    return;
  }

  if (rawCategories.length === 0) {
    console.warn('[MENU] menu_organizer returned 0 categories', {
      hint: 'Check application_id / account_id in request body',
      used: { application_id: creds.application_id, account_id: creds.account_id },
    });
    catalog.setError('No menu categories returned. Check store configuration.');
    return;
  }

  // ── Step 3: Map categories ─────────────────────────────────────────────────
  const categories: Category[] = rawCategories
    .map((c, idx) => mapCategory(c, idx))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const lookup = buildCategoryLookup(rawCategories);

  console.log('[MENU] Categories mapped');
  console.log('[MENU] Categories count:', categories.length);
  console.log('[MENU] Category → su_id lookup (first 5):',
    Object.fromEntries(Array.from(lookup.entries()).slice(0, 5)));

  // ── Step 4: Call products API ──────────────────────────────────────────────
  console.log('[MENU] Loading products', { store_id: storeId, limit: 1000 });

  const productsUrl = `${AUTH_CONFIG.OFFLINE_DB_URL}products/list`;
  let rawProducts: StorefrontProduct[] = [];
  try {
    const prodResp = await axios.post<{ data?: Record<string, unknown>[] }>(
      productsUrl,
      {
        application_id: creds.application_id,
        account_id:     creds.account_id,
        store_id:       [storeId],
        table_name:     'products',
        limit:          1000,
        offset:         0,
        sort:           'products__name',
        sort_type:      'asc',
        search_request: {
          select_columns: [
            'products__id',             'products__pos_name',       'products__pos_description',
            'products__pos_price',      'products__pos_files',      'products__name',
            'products__description',    'products__price',          'products__files',
            'products__tax_category_id','products__category_id',    'products__is_single_variant',
            'products__prod_size',      'products__brand',          'products__variant_ids',
            'products__type',           'products__modifier',       'products__dietary_attributes',
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
      {
        headers: { 'Content-Type': 'application/json', accept: 'application/json, text/plain, */*' },
        timeout: 20_000,
      },
    );

    rawProducts = stripPrefix(prodResp.data?.data ?? []);
  } catch (err) {
    console.error('[MENU] products API error', err);
    catalog.setError(err instanceof Error ? err.message : 'Failed to load products');
    return;
  }

  // ── Step 5: Map products → assign categoryId via su_id lookup ────────────
  const noMatchLog: string[] = [];
  const products: Product[] = rawProducts
    .filter((p) => p.id)
    .map((p) => {
      const catId = lookup.get(String(p.category_id));
      if (!catId) noMatchLog.push(`${String(p.pos_name ?? p.name)} (cat_id=${p.category_id})`);
      return mapProduct(p, catId ?? '');
    });

  if (noMatchLog.length > 0) {
    console.warn('[MENU] Products with no matching category (first 5):', noMatchLog.slice(0, 5));
  }

  // ── Step 6: Calculate itemCount per category ──────────────────────────────
  const countMap = new Map<string, number>();
  products.forEach((p) => {
    if (p.categoryId) countMap.set(p.categoryId, (countMap.get(p.categoryId) ?? 0) + 1);
  });
  categories.forEach((c) => { c.itemCount = countMap.get(c.id) ?? 0; });

  // ── [MENU] Products loaded ─────────────────────────────────────────────────
  console.log('[MENU] Products loaded');
  console.log('[MENU] Products count:', products.length);
  console.log('[MENU] UI updated', {
    categories: categories.length,
    products:   products.length,
    breakdown:  categories.map((c) => `${c.name}: ${c.itemCount}`).join(', '),
  });

  // Validation logs (as specified in requirements)
  console.log('Categories State:', categories);
  console.log('Products State:', products);
  console.log('Selected Category:', categories[0] ?? null);

  // ── Step 7: Persist to Zustand store → UI re-renders ─────────────────────
  catalog.setData(categories, products);
}
