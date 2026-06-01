// src/config/auth.config.ts
// All authentication configuration read from environment variables.
// Values mirror the ext-store's environment.ts — same gateway, same service IDs.
// Fallback strings match the QA environment so the kiosk works out-of-the-box.

const e = import.meta.env;

export const AUTH_CONFIG = {
  // ── Gateway proxy URLs ───────────────────────────────────────────────────────
  // Unauthenticated calls (login step 1, check user)
  UNAUTH_URL: e.VITE_AUTH_UNAUTH_URL ||
    'https://gapq.scocu.net/api/v1/app_group/unauth_call?url=https://iqacga.uncode.io/api/v1/unauth_call',
  // Authenticated calls (subscription check, data APIs)
  AUTH_URL: e.VITE_AUTH_AUTH_URL ||
    'https://growith-01.uncodeapi.com/qa/api/v1/app_group/auth_call?url=https://iqacga.uncode.io/api/v1/auth_call',

  // ── Service contract target URLs (wrapped inside gateway body) ───────────────
  LOGIN_URL:              e.VITE_AUTH_LOGIN_URL              || 'https://gapq.scocu.net/api/v1/service_contract/1685558926198893',
  SUBSCRIBED_API:         e.VITE_AUTH_SUBSCRIBED_API         || 'https://gapq.scocu.net/api/v1/service_contract/1649139267261737',
  RENEW_ACCESS_KEY_URL:   e.VITE_AUTH_RENEW_ACCESS_KEY_URL   || 'https://gapq.scocu.net/api/v1/service_contract/1676372356579476',

  // Authenticated data gateway prefix — append serviceId to call any endpoint
  DEV_URL:                e.VITE_AUTH_DEV_URL                ||
    'https://growith-01.uncodeapi.com/qa/api/v1/shared_central?url=https://ishs01w01uc-qa-01ctl.scocu.net/api/v1/service_contract/',

  // ── Brand / app identity ─────────────────────────────────────────────────────
  APP_GROUP_ID:           e.VITE_AUTH_APP_GROUP_ID           || '1719308705812195',
  PRD_ID:                 e.VITE_AUTH_PRD_ID                 || '1718865526155464',
  SERVICE_ID:             e.VITE_AUTH_SERVICE_ID             || '1685558926198893',
  GA_APPLICATION_ID:      e.VITE_AUTH_GA_APPLICATION_ID      || '1651074845162523',
  GA_ENVIRONMENT_ID:      e.VITE_AUTH_GA_ENVIRONMENT_ID      || '1648476018802981',

  // ── Shared controller identifiers ────────────────────────────────────────────
  CONTROLLER_ID:          e.VITE_AUTH_CONTROLLER_ID          || '1694416293926705',
  ACCOUNT_ID:             e.VITE_AUTH_ACCOUNT_ID             || '3827930443493612',
  SHARED_APPLICATION_ID:  e.VITE_AUTH_SHARED_APPLICATION_ID  || '3821568656302798',
  SHARED_ENVIRONMENT_ID:  e.VITE_AUTH_SHARED_ENVIRONMENT_ID  || '1672057321519776',
  TAC_ENVIRONMENT_ID:     e.VITE_AUTH_TAC_ENVIRONMENT_ID     || '1692331872167292',

  // ── Kiosk channel service ID (pending — left blank until backend is ready) ───
  KIOSK_CHANNEL_SERVICE_ID: e.VITE_AUTH_KIOSK_CHANNEL_SERVICE_ID || '',

  // ── Storefront catalog base URL (offlineDBUrl in kiosk_straunt_storefront) ──
  // Used by: store/details, menu_organizer/{id}, products/list, search_store/list
  // Auth: application_id + account_id go in the POST body only, no auth headers.
  OFFLINE_DB_URL: 'https://comm.uncodeapi.com/qa/',

  // ── Credential encryption constants (identical to ext-store) ─────────────────
  CREDENTIAL_SUFFIX:  'Ajr@123',
  ENCRYPTION_SECRET:  'AjrCredentialKey@2024', // padded/sliced to 32 bytes
  ENCRYPTION_IV:      'AjrCrdlIv123',          // 12 bytes

  // ── External app type (kiosk = ext_app_id 2) ─────────────────────────────────
  EXT_APP_ID: '2',

  // ── Access-key renewal window ─────────────────────────────────────────────────
  TOKEN_RENEWAL_INTERVAL_MS: 15 * 60 * 1000, // 15 minutes
} as const;
