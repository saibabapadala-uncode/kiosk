// src/store/kioskChannelStore.ts
// Stores the resolved kiosk sales channel after login.
//
// Session keys persisted (Capacitor Preferences + localStorage mirror):
//   id                    → selected kiosk sales-channel ID
//   store_id              → used as controller_data_id in every API header
//   sales_channel_type_id → kiosk type constant (3880391793436453)
//   store_name / store_code → display / labelling

import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';
import { logger } from '@/utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KioskChannel {
  /** Selected kiosk sales-channel ID — attached to every API call */
  id:                    string;
  /** Display name */
  name:                  string;
  /** Backend store ID — used as controller_data_id in API headers */
  store_id:              string;
  /** Human-readable store name */
  store_name:            string;
  /** Short store code */
  store_code:            string;
  /**
   * Sales-channel type ID.
   * Kiosk type = 3880391793436453.
   * Persisted so it can be re-attached to API calls after device reboot.
   */
  sales_channel_type_id: string;
  /**
   * Channel short-code (e.g. "spicekitchenqakiosk").
   * Used as `store_name` in the storefront catalog API (POST store/details).
   */
  code?:                 string;
  /** Optional address for display purposes */
  store_address?:        string;
  /** Whether this kiosk is currently accepting orders */
  is_active:             boolean;
}

interface KioskChannelState {
  channel:           KioskChannel | null;
  availableChannels: KioskChannel[];
  isLoading:         boolean;
  error:             string | null;

  setChannel:           (channel: KioskChannel)    => void;
  setAvailableChannels: (channels: KioskChannel[]) => void;
  setLoading:           (loading: boolean)          => void;
  setError:             (error: string | null)      => void;
  clear:                ()                          => void;
  bootstrap:            ()                          => Promise<void>;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const PREF_KEY = 'kiosk_selected_channel';

/** Mirror to localStorage so the api.service.ts interceptor can read them synchronously. */
function mirrorToStorage(ch: KioskChannel): void {
  localStorage.setItem('STORE_ID',              ch.store_id);
  localStorage.setItem('STORE_NAME',            ch.store_name);
  localStorage.setItem('STORE_CODE',            ch.store_code);
  localStorage.setItem('SALES_CHANNEL_ID',      ch.id);
  localStorage.setItem('SALES_CHANNEL_TYPE_ID', ch.sales_channel_type_id);
  if (ch.code) localStorage.setItem('CHANNEL_CODE', ch.code);
}

function clearStorage(): void {
  ['STORE_ID', 'STORE_NAME', 'STORE_CODE', 'SALES_CHANNEL_ID', 'SALES_CHANNEL_TYPE_ID', 'CHANNEL_CODE']
    .forEach((k) => localStorage.removeItem(k));
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useKioskChannelStore = create<KioskChannelState>()((set) => ({
  channel:           null,
  availableChannels: [],
  isLoading:         false,
  error:             null,

  setChannel(channel) {
    void Preferences.set({ key: PREF_KEY, value: JSON.stringify(channel) });
    mirrorToStorage(channel);
    set({ channel });
    logger.info(
      `[kioskChannel] selected: "${channel.name}" ` +
      `(store_id: ${channel.store_id}, type: ${channel.sales_channel_type_id})`,
    );
  },

  setAvailableChannels(availableChannels) { set({ availableChannels }); },
  setLoading(isLoading)                   { set({ isLoading }); },
  setError(error)                         { set({ error }); },

  clear() {
    void Preferences.remove({ key: PREF_KEY });
    clearStorage();
    set({ channel: null, availableChannels: [], error: null });
  },

  async bootstrap() {
    try {
      const { value } = await Preferences.get({ key: PREF_KEY });
      if (!value) return;
      const channel = JSON.parse(value) as KioskChannel;
      mirrorToStorage(channel);
      set({ channel });
      logger.info(`[kioskChannel] restored: "${channel.name}"`);
    } catch {
      // No persisted channel — normal on first run
    }
  },
}));
