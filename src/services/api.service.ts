// src/services/api.service.ts
// Axios instance used for all kiosk backend API calls.
// The request interceptor injects:
//   - Brand headers (from settingsStore) — used by the kiosk backend
//   - Auth headers (from authStore)       — used by the ext-store gateway
//   - Token renewal every 15 min          — mirrors ext-store AuthInterceptor
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { useKioskChannelStore } from '@/store/kioskChannelStore';
import { AUTH_CONFIG } from '@/config/auth.config';
import { renewAccessKey } from '@/services/auth.service';
import { USE_STATIC_PAYMENT_FLOW, delay, getFlowDelay } from './stripe/static.mock';

// ─── Retry augmentation ────────────────────────────────────────────────────────

interface RetryConfig extends InternalAxiosRequestConfig {
  _retryCount?: number;
  _skipRenewal?: boolean;
}

const MAX_RETRIES = 3;

// ─── Axios instance ────────────────────────────────────────────────────────────

export const api = axios.create({
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Request interceptor ────────────────────────────────────────────────────────
// Injects brand + auth headers and handles token renewal (mirrors ext-store).
api.interceptors.request.use(async (config: RetryConfig) => {
  const settings = useSettingsStore.getState();
  const auth     = useAuthStore.getState();
  const channel  = useKioskChannelStore.getState().channel;

  // ── Brand headers (kiosk backend) ──────────────────────────────────────────
  config.baseURL              = settings.api.apiBaseUrl;
  config.headers['X-Brand-ID']     = settings.brandId;
  config.headers['X-Api-Key']      = settings.api.apiKey;
  config.headers['X-Brand-Header'] = settings.api.brandHeader;

  // ── Auth headers (ext-store gateway) — only when authenticated ──────────────
  if (auth.user && !config._skipRenewal) {
    const { user, lastTokenRenewal } = auth;
    const now = Date.now();

    // Renew access key if 15-minute window has elapsed (mirrors ext-store interceptor)
    if (now - lastTokenRenewal >= AUTH_CONFIG.TOKEN_RENEWAL_INTERVAL_MS) {
      // Fire renewal in background — don't block current request
      void renewAccessKey();
    }

    config.headers['access_key']          = user.access_key;
    config.headers['application_id']      = user.tac_application_id;
    config.headers['controller_id']       = AUTH_CONFIG.CONTROLLER_ID;
    config.headers['environment_id']      = AUTH_CONFIG.GA_ENVIRONMENT_ID;
    config.headers['shared_application_id'] = AUTH_CONFIG.SHARED_APPLICATION_ID;
    config.headers['Shared_environment_id'] = AUTH_CONFIG.SHARED_ENVIRONMENT_ID;
    config.headers['account_id']          = AUTH_CONFIG.ACCOUNT_ID;
    config.headers['prd_id']              = AUTH_CONFIG.PRD_ID;
    config.headers['Ext_app_id']          = AUTH_CONFIG.EXT_APP_ID;
    config.headers['Ext_user_id']         = user.su_id;
    config.headers['Username']            = user.name;

    // controller_data_id = selected kiosk channel's store_id
    // falls back to 'default_application_id' when no channel is set
    config.headers['controller_data_id']      = channel?.store_id             ?? 'default_application_id';
    // Kiosk channel session — attached to every subsequent call per requirements
    config.headers['sales_channel_id']        = channel?.id                    ?? '';
    config.headers['sales_channel_type_id']   = channel?.sales_channel_type_id ?? '';
  }

  return config;
});

// ── Response interceptor: retry on network / 5xx + 401 logout ─────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    const status = error.response?.status;

    // 401 — session expired, sign out
    if (status === 401) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    // 403 — wrong credentials / no access
    if (status === 403) return Promise.reject(error);

    if (!config || (config._retryCount ?? 0) >= MAX_RETRIES) return Promise.reject(error);

    const isRetryable = !error.response || (status !== undefined && status >= 500);
    if (!isRetryable) return Promise.reject(error);

    config._retryCount = (config._retryCount ?? 0) + 1;
    await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** config._retryCount!, 30_000)));
    return api(config);
  },
);

// ─── Convenience health check ──────────────────────────────────────────────────

export async function testConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  if (USE_STATIC_PAYMENT_FLOW) {
    await delay(getFlowDelay('connectionTestMs', 250));
    return { ok: true, latencyMs: Date.now() - start };
  }
  try {
    await api.get('/health', { timeout: 5_000 });
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, latencyMs: Date.now() - start, error: msg };
  }
}
