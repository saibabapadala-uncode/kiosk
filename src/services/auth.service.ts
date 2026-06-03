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
import { getActiveBrandAuthConfig } from '@/config/brand-auth';
import { useAuthStore, type AuthUser } from '@/store/authStore';
import { encryptCredentials, decryptCredentials, appendSuffix, removeSuffix } from '@/utils/crypto';
import { resolveBrandFromAppId } from '@/brands';
import { logger } from '@/utils/logger';

// ─── Dedicated axios instance (no interceptors — auth calls are self-contained) ─

const gw = axios.create({ timeout: 20_000 });

// ─── Gateway request builders ──────────────────────────────────────────────────

function unauthGatewayBody(
  url: string,
  payload: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
) {
  // app_group_id MUST come from the currently selected brand — not from the
  // build-time AUTH_CONFIG which is baked at compile time for the default brand.
  const { appGroupId } = getActiveBrandAuthConfig();
  return {
    url,
    method: 'post',
    headers: {
      app_group_id:    appGroupId,
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

  // 2b. Subscription check — STRICT brand match (mirrors subscribedApps in ext-store).
  //
  //  The selected brand's prd_id MUST appear in the Subscribed array.
  //  If it doesn't, the account does not have access to this brand's kiosk and
  //  login is rejected — identical to how the Holiq ext-store blocks with a
  //  "noSubscribedApp" screen when prd_id is not found.
  //
  //  There is NO fallback to a different subscription. Using the wrong
  //  tac_application_id would route all subsequent API calls (store listing,
  //  catalog, orders) to the wrong tenant's data.
  let tacApplicationId = '0';
  let detectedBrandId: string | null = null;

  const brandAuth = getActiveBrandAuthConfig();
  logger.info(`[auth] subscription check — brand: ${brandAuth.uniqueCode}, appGroupId: ${brandAuth.appGroupId}, prdId: ${brandAuth.prdId}`);

  try {
    const payload = { user_id: su_id, app_group_id: brandAuth.appGroupId };
    const body = {
      url:            AUTH_CONFIG.SUBSCRIBED_API,
      method:         'post',
      // Note: app_group_id is intentionally NOT in the headers object here —
      // it goes in the payload only. This matches the Holiq ext-store reference
      // where the app_group_id header is commented out in checkSubscribedAppId.
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
    logger.info(`[auth] ${subscribed.length} subscription(s) found, matching prdId: ${brandAuth.prdId}`);
    logger.info(`[auth] available app_ids: ${subscribed.map(s => s.app_id).join(', ')}`);

    // STRICT match — the account MUST be subscribed to THIS brand's product.
    // Using == (not ===) to match the reference app which uses loose equality.
    const exactMatch = subscribed.find((s) => s.app_id == brandAuth.prdId);

    if (exactMatch) {
      tacApplicationId = exactMatch.tac_application_id;
      logger.info(`[auth] ✓ subscription matched — brand: ${brandAuth.uniqueCode}, tac_application_id: ${tacApplicationId}`);

      // Attempt brand detection from the matched app_id (for the brand registry)
      detectedBrandId = resolveBrandFromAppId(exactMatch.app_id);
      if (detectedBrandId) {
        logger.info(`[auth] brand confirmed from subscription: ${detectedBrandId}`);
      }
    } else {
      // HARD BLOCK: no subscription for this brand's prd_id.
      // Same behavior as Holiq ext-store's noSubscribedApp redirect.
      const brandName = brandAuth.uniqueCode.charAt(0).toUpperCase() + brandAuth.uniqueCode.slice(1);
      const available = subscribed.length
        ? `Available subscriptions: ${subscribed.map(s => s.app_id).join(', ')}`
        : 'No subscriptions found on this account.';
      logger.warn(`[auth] ✗ no subscription for ${brandName} (prdId: ${brandAuth.prdId}). ${available}`);
      return {
        success: false,
        error: `This account is not subscribed to ${brandName} Kiosk. Please use a ${brandName} account or select a different brand.`,
      };
    }
  } catch (err: unknown) {
    const msg = parseError(err);
    logger.warn('[auth] subscription check network error', msg);
    return { success: false, error: `Subscription check failed: ${msg}` };
  }

  // 2c. Build user, commit to store + storage
  const user: AuthUser = { access_key, account_id, su_id, name, email, tac_application_id: tacApplicationId, detectedBrandId };
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
