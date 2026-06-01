// src/services/auth.service.ts
// Authentication service — exact port of ext-store's flow to Axios/Zustand.
//
// Gateway request pattern (same as ext-store):
//   POST unauth_url  { url, method, headers, payload, is_auth, environment_id, ... }
//   POST auth_url    { url, method, headers, payload, is_auth, ... }
//
// No Angular dependencies — pure TypeScript + Axios + Zustand.

import axios from 'axios';
import { AUTH_CONFIG } from '@/config/auth.config';
import { useAuthStore, type AuthUser } from '@/store/authStore';
import { encryptCredentials, decryptCredentials, appendSuffix, removeSuffix } from '@/utils/crypto';
import { logger } from '@/utils/logger';

// ─── Dedicated axios instance (no interceptors — auth calls are self-contained) ─

const gw = axios.create({ timeout: 20_000 });

// ─── Gateway request builders ──────────────────────────────────────────────────

function unauthGatewayBody(
  url: string,
  payload: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
) {
  return {
    url,
    method: 'post',
    headers: {
      app_group_id:    AUTH_CONFIG.APP_GROUP_ID,
      application_id:  AUTH_CONFIG.GA_APPLICATION_ID,
      ...extraHeaders,
    },
    payload,
    is_auth:        false,
    environment_id: AUTH_CONFIG.GA_ENVIRONMENT_ID,
    application_id: AUTH_CONFIG.GA_APPLICATION_ID,
    service_id:     AUTH_CONFIG.SERVICE_ID,
  };
}

function authGatewayBody(
  url: string,
  serviceId: string | number,
  payload: Record<string, unknown>,
  accessKey: string,
  accountId: string,
) {
  return {
    url,
    method:         'post',
    headers:        { application_id: AUTH_CONFIG.GA_APPLICATION_ID },
    payload,
    is_auth:        false,
    environment_id: AUTH_CONFIG.GA_ENVIRONMENT_ID,
    application_id: AUTH_CONFIG.GA_APPLICATION_ID,
    service_id:     serviceId,
    // Gateway-level auth headers
    _access_key:    accessKey,
    _account_id:    accountId,
  };
}

// ─── Step 1: Check user exists (email only, empty password) ───────────────────

export async function checkUser(
  email: string,
): Promise<{ exists: boolean; error?: string }> {
  try {
    const body = unauthGatewayBody(AUTH_CONFIG.LOGIN_URL, {
      username: email,
      password: '',
    });
    const { data } = await gw.post(AUTH_CONFIG.UNAUTH_URL, body, {
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = (data?.status ?? '').toLowerCase() === 'success';
    return { exists: ok, error: ok ? undefined : (data?.message ?? 'User not found') };
  } catch (err: unknown) {
    const msg = parseError(err);
    logger.warn('[auth] checkUser error', msg);
    return { exists: false, error: msg };
  }
}

// ─── Step 2: Full login (email + password) ────────────────────────────────────

export interface LoginResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  // 2a. Authenticate credentials
  let loginData: Record<string, unknown>;
  try {
    const body = unauthGatewayBody(AUTH_CONFIG.LOGIN_URL, { username: email, password });
    const { data } = await gw.post(AUTH_CONFIG.UNAUTH_URL, body, {
      headers: { 'Content-Type': 'application/json' },
    });
    if ((data?.status ?? '').toLowerCase() !== 'success') {
      return { success: false, error: data?.message ?? 'Login failed' };
    }
    loginData = data.data as Record<string, unknown>;
  } catch (err: unknown) {
    return { success: false, error: parseError(err) };
  }

  const { access_key, account_id, su_id, name } = loginData as {
    access_key: string; account_id: string; su_id: string; name: string;
  };

  // 2b. Subscription check — flexible fallback (mirrors subscribedApps in ext-store
  //     but does NOT hard-block when the specific prd_id is not found).
  //
  //   Priority:
  //     1. Subscription matching AUTH_CONFIG.PRD_ID → use its tac_application_id
  //     2. Any other subscription → use the first one's tac_application_id
  //     3. No subscriptions / network error → use '0' (gateway still accepts it for
  //        store-listing and channel-listing calls)
  //
  //   The old behaviour blocked login entirely when prd_id didn't match. For the
  //   kiosk the merchant's account may be subscribed to a different product; we
  //   still want them to reach the store / channel selection flow.
  let tacApplicationId = '0';
  try {
    const payload = { user_id: su_id, app_group_id: AUTH_CONFIG.APP_GROUP_ID };
    const body = {
      url:            AUTH_CONFIG.SUBSCRIBED_API,
      method:         'post',
      headers:        { application_id: AUTH_CONFIG.GA_APPLICATION_ID },
      payload,
      is_auth:        false,
      environment_id: AUTH_CONFIG.GA_ENVIRONMENT_ID,
      application_id: AUTH_CONFIG.GA_APPLICATION_ID,
      service_id:     1649139267261737,
    };
    const { data } = await gw.post(AUTH_CONFIG.AUTH_URL, body, {
      headers: {
        'Content-Type': 'application/json',
        access_key,
        account_id,
        application_id: '0',
      },
    });

    const subscribed = (data?.Subscribed ?? []) as Array<{ app_id: string; tac_application_id: string }>;

    // 1. Exact product match
    const exactMatch = subscribed.find((s) => s.app_id === AUTH_CONFIG.PRD_ID);
    if (exactMatch) {
      tacApplicationId = exactMatch.tac_application_id;
      logger.info('[auth] subscription matched prd_id');
    } else if (subscribed.length > 0) {
      // 2. Fallback: first available subscription
      tacApplicationId = subscribed[0].tac_application_id;
      logger.info('[auth] prd_id not in subscriptions — using first available tac_application_id');
    } else {
      // 3. No subscriptions — proceed with '0'
      logger.warn('[auth] no subscriptions found — using tac_application_id=0');
    }
  } catch (err: unknown) {
    // Network / API error — proceed anyway; store listing will reveal real access issues
    logger.warn('[auth] subscription check failed, proceeding with tac_application_id=0', parseError(err));
  }

  // 2c. Build user, commit to store + storage
  const user: AuthUser = { access_key, account_id, su_id, name, email, tac_application_id: tacApplicationId };
  useAuthStore.getState().setUser(user);

  // 2d. Encrypt and persist credentials (same AES-GCM as ext-store)
  void storeCredentials(email, password);

  logger.info(`[auth] login success: ${name}`);
  return { success: true, user };
}

// ─── Token renewal (every 15 min, called by axios interceptor) ────────────────

export async function renewAccessKey(): Promise<boolean> {
  const { user, updateAccessKey } = useAuthStore.getState();
  if (!user) return false;

  try {
    const body = {
      url:    AUTH_CONFIG.RENEW_ACCESS_KEY_URL,
      method: 'post',
      headers: {
        tac_environment_id: AUTH_CONFIG.TAC_ENVIRONMENT_ID,
        application_id:     AUTH_CONFIG.GA_APPLICATION_ID,
      },
      payload:        { access_key: user.access_key },
      is_auth:        false,
      environment_id: AUTH_CONFIG.GA_ENVIRONMENT_ID,
      application_id: AUTH_CONFIG.GA_APPLICATION_ID,
    };
    const { data } = await gw.post(AUTH_CONFIG.UNAUTH_URL, body, {
      headers: { 'Content-Type': 'application/json' },
    });
    const newKey = data?.data?.renew_access_key as string | undefined;
    if (newKey && newKey !== user.access_key) {
      updateAccessKey(newKey);
    }
    return true;
  } catch (err) {
    logger.warn('[auth] token renewal failed', err);
    return false;
  }
}

// ─── Credential storage ────────────────────────────────────────────────────────

async function storeCredentials(email: string, password: string): Promise<void> {
  const ciphertext = await encryptCredentials({
    email:    appendSuffix(email),
    password: appendSuffix(password),
  });
  if (ciphertext) localStorage.setItem('user_cred', ciphertext);
}

export async function getStoredCredentials(): Promise<{ email: string; password: string } | null> {
  const encrypted = localStorage.getItem('user_cred');
  if (!encrypted) return null;
  const parsed = await decryptCredentials<{ email: string; password: string }>(encrypted);
  if (!parsed) return null;
  return { email: removeSuffix(parsed.email), password: removeSuffix(parsed.password) };
}

export function clearStoredCredentials(): void {
  localStorage.removeItem('user_cred');
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export function logout(): void {
  useAuthStore.getState().logout();
}

// ─── Error parser (mirrors ext-store getParsedErrorMessage) ───────────────────

function parseError(err: unknown): string {
  if (!err || typeof err !== 'object') return 'An unexpected error occurred';
  const axErr = err as { response?: { data?: { errors?: Array<{ message?: string }> }; status?: number } };
  const firstMsg = axErr.response?.data?.errors?.[0]?.message;
  if (firstMsg) return firstMsg.replace(/[<>{}[\]]/g, '').trim();
  if (axErr.response?.status === 401) return 'Session expired. Please sign in again.';
  if (axErr.response?.status === 500) return 'Server error. Please try again later.';
  return (err as { message?: string }).message ?? 'An unexpected error occurred';
}
