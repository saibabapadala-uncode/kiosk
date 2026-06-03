// src/config/auth.config.ts
// All authentication configuration read from environment variables.
// Values mirror the ext-store's environment.ts — same gateway, same service IDs.
// Fallback strings match the QA environment so the kiosk works out-of-the-box.
//
// CORS note: The API servers (gapq.scocu.net, growith-01.uncodeapi.com,
// comm.uncodeapi.com) allow cross-origin requests from localhost and
// Capacitor native origins. No proxy is needed — both browser dev (port 3000
// or 8100) and native Capacitor builds call these URLs directly.
//
// Brand-specific values (APP_GROUP_ID, PRD_ID): these are BUILD-TIME defaults
// only. At runtime, ALWAYS use getActiveBrandAuthConfig() from
// src/config/brand-auth.ts which reads the currently selected brand from
// settingsStore and returns the correct per-brand values.

const e = import.meta.env;

export const AUTH_CONFIG = {
  // ── Gateway proxy URLs ─────────────────────────────────────────────────────
  UNAUTH_URL: e.VITE_AUTH_UNAUTH_URL ||
    'https://gapq.scocu.net/api/v1/app_group/unauth_call?url=https://iqacga.uncode.io/api/v1/unauth_call',
  AUTH_URL: e.VITE_AUTH_AUTH_URL ||
    'https://growith-01.uncodeapi.com/qa/api/v1/app_group/auth_call?url=https://iqacga.uncode.io/api/v1/auth_call',

  // ── Service contract target URLs ────────────────────────────────────────────
  LOGIN_URL:            e.VITE_AUTH_LOGIN_URL            || 'https://gapq.scocu.net/api/v1/service_contract/1685558926198893',
  SUBSCRIBED_API:       e.VITE_AUTH_SUBSCRIBED_API       || 'https://gapq.scocu.net/api/v1/service_contract/1649139267261737',
  RENEW_ACCESS_KEY_URL: e.VITE_AUTH_RENEW_ACCESS_KEY_URL || 'https://gapq.scocu.net/api/v1/service_contract/1676372356579476',

  // Authenticated data gateway prefix — append serviceId to call any endpoint
  DEV_URL: e.VITE_AUTH_DEV_URL ||
    'https://growith-01.uncodeapi.com/qa/api/v1/shared_central?url=https://ishs01w01uc-qa-01ctl.scocu.net/api/v1/service_contract/',

  // ── Brand / app identity (build-time defaults only) ─────────────────────────
  // Do NOT use these at runtime for brand-specific calls.
  // Use getActiveBrandAuthConfig() instead.
  APP_GROUP_ID:           e.VITE_AUTH_APP_GROUP_ID           || '1719308705812195',
  PRD_ID:                 e.VITE_AUTH_PRD_ID                 || '1718865526155464',
  SERVICE_ID:             e.VITE_AUTH_SERVICE_ID             || '1685558926198893',
  GA_APPLICATION_ID:      e.VITE_AUTH_GA_APPLICATION_ID      || '1651074845162523',
  GA_ENVIRONMENT_ID:      e.VITE_AUTH_GA_ENVIRONMENT_ID      || '1648476018802981',

  // ── Shared controller identifiers (same for all brands) ─────────────────────
  CONTROLLER_ID:          e.VITE_AUTH_CONTROLLER_ID          || '1694416293926705',
  ACCOUNT_ID:             e.VITE_AUTH_ACCOUNT_ID             || '3827930443493612',
  SHARED_APPLICATION_ID:  e.VITE_AUTH_SHARED_APPLICATION_ID  || '3821568656302798',
  SHARED_ENVIRONMENT_ID:  e.VITE_AUTH_SHARED_ENVIRONMENT_ID  || '1672057321519776',
  TAC_ENVIRONMENT_ID:     e.VITE_AUTH_TAC_ENVIRONMENT_ID     || '1692331872167292',

  // ── Kiosk channel service ID ────────────────────────────────────────────────
  KIOSK_CHANNEL_SERVICE_ID: e.VITE_AUTH_KIOSK_CHANNEL_SERVICE_ID || '',

  // ── Storefront catalog base URL ─────────────────────────────────────────────
  OFFLINE_DB_URL: 'https://comm.uncodeapi.com/qa/',

  // ── Credential encryption (same constants as ext-store) ─────────────────────
  CREDENTIAL_SUFFIX:  'Ajr@123',
  ENCRYPTION_SECRET:  'AjrCredentialKey@2024',
  ENCRYPTION_IV:      'AjrCrdlIv123',

  // ── External app type ────────────────────────────────────────────────────────
  EXT_APP_ID: '2',

  // ── Token renewal window ─────────────────────────────────────────────────────
  TOKEN_RENEWAL_INTERVAL_MS: 15 * 60 * 1000,
} as const;
