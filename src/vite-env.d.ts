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

  // ── Stripe Terminal location IDs ─────────────────────────────────────────────
  readonly VITE_STRIPE_TERMINAL_LOCATION_ID: string;
  readonly VITE_STRIPE_TERMINAL_LOCATION_1_ID: string;
  readonly VITE_STRIPE_TERMINAL_LOCATION_1_LABEL: string;
  readonly VITE_STRIPE_TERMINAL_LOCATION_2_ID: string;
  readonly VITE_STRIPE_TERMINAL_LOCATION_2_LABEL: string;
  readonly VITE_STRIPE_TERMINAL_LOCATION_3_ID: string;
  readonly VITE_STRIPE_TERMINAL_LOCATION_3_LABEL: string;
  readonly VITE_STRIPE_TERMINAL_LOCATION_4_ID: string;
  readonly VITE_STRIPE_TERMINAL_LOCATION_4_LABEL: string;

  // ── Uncode payment credentials (connection-token endpoint) ───────────────────
  readonly VITE_STRIPE_PAY_KEY: string;
  readonly VITE_STRIPE_MERCHANT_ID: string;
  readonly VITE_STRIPE_STORE_ID: string;
  readonly VITE_STRIPE_ENV_TYPE: string;

  // ── Alt-payment / QR-pay ─────────────────────────────────────────────────────
  readonly VITE_STRAUNT_INDUSTRY_ID: string;
  readonly VITE_STRAUNT_DEFAULT_CUSTOMER_ID: string;
  readonly VITE_STRAUNT_DEFAULT_PHONE: string;
  readonly VITE_ANONYMOUS_PROJECT_URL: string;
  readonly VITE_DISPLAY_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
