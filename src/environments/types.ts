/**
 * Flat environment configuration — mirrors kiosk_straunt_storefront shape.
 *
 * Platform-level fields (URLs, credentials, service IDs) are shared across all
 * brands.  Brand-specific payment fields (store_id, merchant_id, etc.) are
 * inlined into the same object — the active brand section is uncommented in
 * each environment file while the other brand sections remain commented out.
 */
export interface Environment {
  production: boolean;

  // ── Platform API ──────────────────────────────────────────────────────────
  apiBaseUrl: string;
  aphSid: string;
  apiKey: string;

  // ── Stripe publishable keys (keyed by industry_id) ───────────────────────
  stripeKey: Record<string, string>;

  // ── Offline / sync DB ─────────────────────────────────────────────────────
  offlineDBUrl: string;
  offlineDBapiKey: string;

  // ── Assets ────────────────────────────────────────────────────────────────
  imageBaseUrl: string;

  // ── Real-time ─────────────────────────────────────────────────────────────
  messagesWSUrl: string;
  SOCKET_URL: string;

  // ── Identity provider ─────────────────────────────────────────────────────
  idpUrl: string;

  // ── Shared controller ─────────────────────────────────────────────────────
  sharedApiBaseUrl?: string;
  sharedApplicationId?: string;
  sharedEnvironmentId?: string;

  // ── GA platform ───────────────────────────────────────────────────────────
  environment_id: string;
  ga_base_url: string;
  unauth_url: string;
  auth_url: string;
  ga_application_id: string;
  ga_account_id: string;
  ga_environment_id: string;

  // ── BLS service IDs ───────────────────────────────────────────────────────
  registration_bls_id: string;
  login_bls_id: string;
  reset_password_bls_id: string;
  forgot_password_bls_id: string;

  // ── Other platform endpoints ──────────────────────────────────────────────
  resthook_base_url: string;
  universal_uncode_base_url: string;
  customApiUrl: string;
  pollingTriggerUrl: string;

  // ── Brand-specific payment config (one brand active per build) ────────────
  env_type: 'dev' | 'qa' | 'prod' | 'work';
  industry_id: string;
  store_id: string;
  location_id: string;
  merchant_id: string;
  pay_key: string;

  // ── Brand URLs ────────────────────────────────────────────────────────────
  backofficeUrl: string;
  anonymousProjectUrl: string;

  // ── Dev / test credentials (omitted in production) ────────────────────────
  username?: string;
  password?: string;
}
