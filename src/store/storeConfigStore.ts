// src/store/storeConfigStore.ts
// Stores the full storeDetails response loaded from the catalog API.
//
// Loaded via: POST https://comm.uncodeapi.com/qa/store/details
//              { store_name: channel.code.toLowerCase() }
//
// All catalog API calls (products/list, menu_organizer, search_store)
// require application_id and account_id from user_details.
// All order API calls (service_contract/*) require the shared environment
// fields and access_key from the auth store.

import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';
import { logger } from '@/utils/logger';

// ─── Types (subset of the storeDetails response shape) ────────────────────────

export interface StoreUserDetails {
  application_id:      string;
  account_id:          string;
  environment_id:      string;
  /** app_id = prd_id used in order API headers */
  app_id:              string;
  shared_application_id: string;
  shared_environment_id: string;
  username:            string;
  user_id:             string;
  /** gateway_url returned by the store details API for service_contract calls */
  gateway_url?:        string;
}

export interface StoreInfo {
  id:                 string;
  name:               string;
  store_code:         string;
  menu_organizer_id:  string;
  controller_id:      string;
  logo?:              string;
  banner_logo?:       string;
  header_logo?:       string;
  default_product_icon?: string;
  settings?:          Record<string, unknown>;
  [key: string]: unknown;
}

export interface StoreConfig {
  /** Full response from POST store/details */
  raw:          Record<string, unknown> | null;
  store:        StoreInfo | null;
  userDetails:  StoreUserDetails | null;
  /** true when is_sales_channel flag is present in response */
  isSalesChannel: boolean;
  /**
   * Brand identifier extracted from the store/details brand sub-object.
   * Used by useBrandDetection as Signal 2 to resolve the active brand at runtime.
   * Empty string when the API response does not include a recognizable brand code.
   */
  brandCode:    string;
  isLoaded:     boolean;
  isLoading:    boolean;
  error:        string | null;
}

const PREF_KEY = 'kiosk_store_config';

// ─── Store ────────────────────────────────────────────────────────────────────

interface StoreConfigState extends StoreConfig {
  setConfig:    (raw: Record<string, unknown>) => void;
  setLoading:   (v: boolean) => void;
  setError:     (e: string | null) => void;
  clear:        () => void;
  bootstrap:    () => Promise<void>;
}

function parseConfig(raw: Record<string, unknown>): Pick<StoreConfig, 'store' | 'userDetails' | 'isSalesChannel' | 'brandCode'> {
  // Defensive: if loadStoreDetails somehow passed the envelope instead of the
  // unwrapped payload, unwrap here too so parseConfig is always safe.
  const payload: Record<string, unknown> =
    raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
      ? raw.data as Record<string, unknown>
      : raw;

  const isSalesChannel = Boolean(payload.is_sales_channel);

  // Try both plural and singular field names for user details
  const rawStore = (payload.store ?? {}) as Record<string, unknown>;
  const rawUser  = (
    payload.user_details ?? payload.user_detail ?? {}
  ) as Record<string, unknown>;
  const rawBrand = (payload.brand as Record<string, unknown> | undefined) ?? {};

  // DEBUG: log the raw fields so we can verify extraction
  console.log('[storeConfig:debug] parseConfig raw fields →', {
    is_sales_channel:          payload.is_sales_channel,
    'store.id':                rawStore.id,
    'store.menu_organizer_id': rawStore.menu_organizer_id,
    'brand.menu_organizer_id': rawBrand.menu_organizer_id,
    'top-level.menu_organizer_id': payload.menu_organizer_id,
    'user_details.application_id': rawUser.application_id,
    'user_details.account_id':     rawUser.account_id,
    'user_details.username':       rawUser.username,
    'user_details.user_name':      rawUser.user_name,
  });

  // Resolve menu_organizer_id — try brand first (sales-channel path), then store,
  // then top-level as a last resort.
  const menuOrganizerId = String(
    (isSalesChannel
      ? (rawBrand.menu_organizer_id ?? rawStore.menu_organizer_id)
      : rawStore.menu_organizer_id)
    ?? payload.menu_organizer_id   // top-level fallback
    ?? '',
  );

  // Spread rawStore first (picks up any extra fields), then override the fields
  // we explicitly control so rawStore cannot clobber them with wrong types.
  const store: StoreInfo = {
    ...rawStore,
    id:                   String(rawStore.id ?? ''),
    name:                 String(rawStore.name ?? ''),
    store_code:           String(rawStore.store_code ?? ''),
    menu_organizer_id:    menuOrganizerId,
    controller_id:        String(rawStore.controller_id ?? ''),
    logo:                 rawStore.logo as string | undefined,
    banner_logo:          rawStore.banner_logo as string | undefined,
    header_logo:          rawStore.header_logo as string | undefined,
    default_product_icon: rawStore.default_product_icon as string | undefined,
    settings:             rawStore.settings as Record<string, unknown> | undefined,
  };

  const userDetails: StoreUserDetails = {
    // application_id — check several field names the API may use
    application_id: String(
      rawUser.application_id ??
      rawUser.tac_application_id ??
      rawUser.app_application_id ??
      '',
    ),
    account_id:           String(rawUser.account_id ?? ''),
    environment_id:       String(rawUser.environment_id ?? ''),
    app_id:               String(rawUser.app_id ?? ''),
    shared_application_id: String(rawUser.shared_application_id ?? ''),
    shared_environment_id: String(rawUser.shared_environment_id ?? ''),
    username:             String(rawUser.username ?? rawUser.user_name ?? ''),
    user_id:              String(rawUser.user_id ?? ''),
    gateway_url:          rawUser.gateway_url as string | undefined,
  };

  console.log('[storeConfig:debug] parseConfig result →', {
    store_id:              store.id,
    store_name:            store.name,
    menu_organizer_id:     store.menu_organizer_id,
    isSalesChannel,
    userDetails_app_id:    userDetails.application_id,
    userDetails_account:   userDetails.account_id,
    userDetails_username:  userDetails.username,
  });

  // Extract brand code from the brand sub-object for runtime brand detection (Signal 2).
  const brandCode = String(
    rawBrand?.id ?? rawBrand?.code ?? rawBrand?.brand_id ?? rawBrand?.brand_code ?? '',
  );

  return { store, userDetails, isSalesChannel, brandCode };
}

export const useStoreConfigStore = create<StoreConfigState>()((set) => ({
  raw:            null,
  store:          null,
  userDetails:    null,
  isSalesChannel: false,
  brandCode:      '',
  isLoaded:       false,
  isLoading:      false,
  error:          null,

  setConfig(raw) {
    const parsed = parseConfig(raw);
    void Preferences.set({ key: PREF_KEY, value: JSON.stringify(raw) });
    set({ raw, ...parsed, isLoaded: true, isLoading: false, error: null });
    logger.info(`[storeConfig] loaded: ${parsed.store?.name} (id: ${parsed.store?.id})`);
  },

  setLoading(isLoading) { set({ isLoading }); },
  setError(error)       { set({ error, isLoading: false }); },

  clear() {
    void Preferences.remove({ key: PREF_KEY });
    set({ raw: null, store: null, userDetails: null, isSalesChannel: false, brandCode: '', isLoaded: false, error: null });
  },

  async bootstrap() {
    try {
      const { value } = await Preferences.get({ key: PREF_KEY });
      if (!value) return;
      const raw    = JSON.parse(value) as Record<string, unknown>;
      const parsed = parseConfig(raw);
      set({ raw, ...parsed, isLoaded: true });
      logger.info(`[storeConfig] restored: ${parsed.store?.name}`);
    } catch {
      // No cached config — will be loaded fresh on catalog load
    }
  },
}));
