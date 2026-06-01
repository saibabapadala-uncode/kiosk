// src/store/authStore.ts
// Single source of truth for authentication state.
// Persisted to Capacitor Preferences AND mirrored to localStorage keys
// (access_key, USER_INFO, application_id) for compatibility with ext-store patterns.

import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';
import { logger } from '@/utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  /** Short-lived auth token — refreshed every 15 min */
  access_key: string;
  /** Platform account ID */
  account_id: string;
  /** Service-user ID (su_id in ext-store) */
  su_id: string;
  /** Display name */
  name: string;
  /** Login identifier */
  email: string;
  /** tac_application_id returned by subscription check */
  tac_application_id: string;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;   // true while reading stored session on first load
  lastTokenRenewal: number;   // epoch ms — used to schedule renewal

  setUser:        (user: AuthUser)   => void;
  updateAccessKey:(key: string)      => void;
  setBootstrapping:(v: boolean)       => void;
  logout:         ()                 => void;
  /** Call once on app start to hydrate from persisted storage. */
  bootstrap:      ()                 => Promise<void>;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const PREF_KEY = 'kiosk_auth_user';

async function persistUser(user: AuthUser): Promise<void> {
  try {
    await Preferences.set({ key: PREF_KEY, value: JSON.stringify(user) });
    // Mirror to localStorage so existing ext-store patterns keep working
    localStorage.setItem('access_key',    user.access_key);
    localStorage.setItem('application_id', user.tac_application_id);
    localStorage.setItem('USER_INFO',     JSON.stringify(user));
    localStorage.setItem('loginStatus',   'true');
  } catch (err) {
    logger.warn('[authStore] persist failed', err);
  }
}

async function clearPersistedUser(): Promise<void> {
  try {
    await Preferences.remove({ key: PREF_KEY });
    const keys = [
      'access_key', 'application_id', 'USER_INFO', 'loginStatus',
      'STORE_ID', 'STORE_NAME', 'STORE_CODE', 'store_list',
    ];
    keys.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    logger.warn('[authStore] clear failed', err);
  }
}

async function loadPersistedUser(): Promise<AuthUser | null> {
  try {
    const { value } = await Preferences.get({ key: PREF_KEY });
    if (!value) return null;
    const user = JSON.parse(value) as AuthUser;
    // Re-sync to localStorage on every bootstrap
    localStorage.setItem('access_key',    user.access_key);
    localStorage.setItem('application_id', user.tac_application_id);
    localStorage.setItem('USER_INFO',     JSON.stringify(user));
    return user;
  } catch {
    return null;
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()((set, get) => ({
  user:             null,
  isAuthenticated:  false,
  isBootstrapping:  true,
  lastTokenRenewal: 0,

  setUser(user) {
    void persistUser(user);
    set({ user, isAuthenticated: true, lastTokenRenewal: Date.now() });
    logger.info(`[auth] signed in: ${user.name}`);
  },

  updateAccessKey(key) {
    const user = get().user;
    if (!user) return;
    const updated = { ...user, access_key: key };
    void persistUser(updated);
    localStorage.setItem('access_key', key);
    set({ user: updated, lastTokenRenewal: Date.now() });
    logger.info('[auth] access key renewed');
  },

  setBootstrapping(v) {
    set({ isBootstrapping: v });
  },

  logout() {
    void clearPersistedUser();
    set({ user: null, isAuthenticated: false, lastTokenRenewal: 0 });
    logger.info('[auth] signed out');
  },

  async bootstrap() {
    set({ isBootstrapping: true });
    const user = await loadPersistedUser();
    if (user) {
      set({ user, isAuthenticated: true, lastTokenRenewal: Date.now() });
      logger.info(`[auth] session restored: ${user.name}`);
    }
    set({ isBootstrapping: false });
  },
}));
