/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BRAND: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_KEY: string;
  readonly VITE_BRAND_HEADER: string;

  // ── Auth gateway URLs ────────────────────────────────────────────────────────
  readonly VITE_AUTH_UNAUTH_URL: string;
  readonly VITE_AUTH_AUTH_URL: string;
  readonly VITE_AUTH_LOGIN_URL: string;
  readonly VITE_AUTH_SUBSCRIBED_API: string;
  readonly VITE_AUTH_RENEW_ACCESS_KEY_URL: string;
  readonly VITE_AUTH_DEV_URL: string;

  // ── Brand / app identity ─────────────────────────────────────────────────────
  readonly VITE_AUTH_APP_GROUP_ID: string;
  readonly VITE_AUTH_PRD_ID: string;
  readonly VITE_AUTH_SERVICE_ID: string;
  readonly VITE_AUTH_GA_APPLICATION_ID: string;
  readonly VITE_AUTH_GA_ENVIRONMENT_ID: string;

  // ── Shared controller identifiers ────────────────────────────────────────────
  readonly VITE_AUTH_CONTROLLER_ID: string;
  readonly VITE_AUTH_ACCOUNT_ID: string;
  readonly VITE_AUTH_SHARED_APPLICATION_ID: string;
  readonly VITE_AUTH_SHARED_ENVIRONMENT_ID: string;
  readonly VITE_AUTH_TAC_ENVIRONMENT_ID: string;

  // ── Kiosk sales channel service ID (pending backend) ─────────────────────────
  readonly VITE_AUTH_KIOSK_CHANNEL_SERVICE_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
