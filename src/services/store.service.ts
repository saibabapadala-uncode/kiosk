// src/services/store.service.ts
// Authenticated gateway calls — mirrors ext-store AuthInterceptor for dev_url requests.
//
// Real API response notes (confirmed from live object):
//   • id / store_id / sales_channel_type_id arrive as JSON *numbers*, not strings
//   • is_active arrives as 1 / 0, not a boolean
//   • address lives on the channel itself (not on the store)
//   • code is the channel's short identifier (e.g. "spicekitchenqakiosk")
//
// All numeric IDs are accepted as number | string here and coerced to string in
// toKioskChannel() before being stored in session / sent as API headers.

import axios from 'axios';
import { AUTH_CONFIG } from '@/config/auth.config';
import { getActiveBrandAuthConfig } from '@/config/brand-auth';
import { useAuthStore } from '@/store/authStore';
import { useKioskChannelStore } from '@/store/kioskChannelStore';
import { logger } from '@/utils/logger';

// ─── Kiosk channel type (filter value) ────────────────────────────────────────
// The API returns sales_channel_type_id as a number; we compare via String()
// to avoid a strict-equality mismatch between number and string.
export const KIOSK_CHANNEL_TYPE_ID = '3880391793436453';

// ─── Service IDs ──────────────────────────────────────────────────────────────
// STORES_SERVICE_ID is now read from the active brand's authConfig at call time
// because Holiq uses a different service ID (3828022124411623) than Straunt/Restro
// (3821548006039960). Using the wrong ID returns an empty store list.
// CHANNELS_SERVICE_ID is identical across all brands.
const CHANNELS_SERVICE_ID = '3880470537073453';

// ─── Types (matching the live API response shape) ─────────────────────────────

export interface MerchantStore {
  /** Numeric or string depending on JSON parser — coerce with String() before use */
  id:            number | string;
  name:          string;
  /** Short store code used as a header / identifier */
  code:          string;
  address?:      string;
  city?:         string;
  state?:        string;
  store_status?: string;
  [key: string]: unknown;
}

export interface MerchantSalesChannel {
  /** API returns this as a number (e.g. 3884551256068876) */
  id:                     number | string;
  name:                   string;
  /**
   * Channel short-code (e.g. "spicekitchenqakiosk").
   * Passed as `store_name` to the catalog API (POST store/details).
   */
  code?:                  string;
  /** Optional description shown in the channel picker */
  description?:           string;
  /** API returns this as a number (e.g. 3873034825787231) */
  store_id:               number | string;
  /** Physical address of this kiosk channel */
  address?:               string;
  /** 1 | 0 from the API — treat as truthy */
  is_active:              number | boolean;
  /** API returns this as a number (e.g. 3880391793436453) */
  sales_channel_type_id:  number | string;
  sales_channel_type_name?: string;
  [key: string]: unknown;
}

// ─── Shared-component gateway POST ────────────────────────────────────────────

async function devPost<T>(serviceId: string, payload: Record<string, unknown>): Promise<T> {
  const { user } = useAuthStore.getState();
  if (!user) throw new Error('Not authenticated — cannot call gateway');

  const channelStore = useKioskChannelStore.getState().channel;
  const url          = `${AUTH_CONFIG.DEV_URL}${serviceId}`;

  // prdId must come from the active brand — using a mismatched prd_id causes
  // the shared-component gateway to route to the wrong tenant's data.
  const { prdId } = getActiveBrandAuthConfig();

  // Header names are lowercase to exactly match the working curl command.
  // Some gateway proxies are case-sensitive on custom headers.
  const { data } = await axios.post<T>(url, payload, {
    headers: {
      'content-type':           'application/json',
      is_from_shared_component: 'true',
      controller_id:             AUTH_CONFIG.CONTROLLER_ID,
      shared_application_id:     AUTH_CONFIG.SHARED_APPLICATION_ID,
      shared_environment_id:     AUTH_CONFIG.SHARED_ENVIRONMENT_ID,
      access_key:                user.access_key,
      // SHARED_ENVIRONMENT_ID is required here — the channels endpoint (3880470537073453)
      // only returns kiosk channels when this specific environment ID is sent.
      // GA_ENVIRONMENT_ID works for the stores curl but breaks channels.
      environment_id:            AUTH_CONFIG.SHARED_ENVIRONMENT_ID,
      ext_app_id:                AUTH_CONFIG.EXT_APP_ID,
      ext_user_id:               user.su_id,
      username:                  user.name,
      application_id:            user.tac_application_id || '0',
      prd_id:                    prdId,
      account_id:                AUTH_CONFIG.ACCOUNT_ID,
      controller_data_id:        channelStore?.store_id ?? 'default_application_id',
    },
    timeout: 20_000,
  });
  return data;
}

// ─── Store listing ─────────────────────────────────────────────────────────────

export async function getStores(): Promise<MerchantStore[]> {
  const { storesServiceId, uniqueCode } = getActiveBrandAuthConfig();
  logger.info(`[store] fetching stores — brand: ${uniqueCode}, serviceId: ${storesServiceId}`);
  // limit: 50 — matches the working curl and the Holiq ext-store reference
  // Response shape: { data: { Status, Pagination, data: Store[] } }
  const response = await devPost<{ data?: { Status?: string; data?: MerchantStore[] } }>(
    storesServiceId,
    { limit: 50, offset: 0 },
  );
  const stores: MerchantStore[] = response?.data?.data ?? [];
  logger.info(`[store] ${stores.length} store(s) fetched`);
  return stores;
}

// ─── Kiosk sales-channel listing ──────────────────────────────────────────────
// Fetches all channels for the store, then filters to kiosk-type only.
//
// IMPORTANT: sales_channel_type_id comes from the API as a *number*
// (e.g. 3880391793436453). KIOSK_CHANNEL_TYPE_ID is a string.
// We use String() on both sides so strict equality always works.

export async function getKioskSalesChannels(storeId: number | string): Promise<MerchantSalesChannel[]> {
  logger.info(`[store] fetching kiosk channels for store ${storeId}`);
  // Response shape: { data: Channel[] }
  const response = await devPost<{ data?: MerchantSalesChannel[] }>(
    CHANNELS_SERVICE_ID,
    { limit: 100, offset: 0, store_id: storeId },
  );

  const all = response?.data ?? [];

  // Filter: coerce both sides to string before comparing to handle number ↔ string mismatch
  const kiosk = all.filter(
    (ch) => String(ch.sales_channel_type_id) === KIOSK_CHANNEL_TYPE_ID,
  );

  logger.info(`[store] ${kiosk.length} kiosk channel(s) (from ${all.length} total)`);
  return kiosk;
}
