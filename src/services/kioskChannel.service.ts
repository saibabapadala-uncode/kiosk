// src/services/kioskChannel.service.ts
// Fetches the kiosk sales channels available to the authenticated user.
//
// ── Integration status ────────────────────────────────────────────────────────
// The real backend API is PENDING. The service currently returns mock data.
// When the API is ready:
//   1. Set VITE_AUTH_KIOSK_CHANNEL_SERVICE_ID in the .env files.
//   2. Replace the mock block with the real axios call (marked below).
//   3. Map the API response to KioskChannel[] — no other changes needed.
//
// The store (kioskChannelStore.ts) and screens (ChannelSelectScreen.tsx)
// require NO changes when the real API is integrated.

import axios from 'axios';
import { AUTH_CONFIG } from '@/config/auth.config';
import { useAuthStore } from '@/store/authStore';
import type { KioskChannel } from '@/store/kioskChannelStore';
import { logger } from '@/utils/logger';

// ─── Mock data (remove when real API is ready) ────────────────────────────────

// Intentionally contains 2 channels so the selection UI can be tested.
// In single-channel deployments, set only one entry here (or the API returns one)
// and the flow will auto-select and skip the picker screen.
// code = the channel's short identifier used as store_name in POST store/details.
// Replace these placeholder values with the real channel codes from your backend.
const MOCK_KIOSK_CHANNELS: KioskChannel[] = [
  {
    id:                    'ksc_front_001',
    name:                  'Front Counter Kiosk',
    code:                  'spicekitchenqakiosk',   // ← used as store_name in store/details
    store_id:              '3827930443493620',
    store_name:            'Downtown — Main St',
    store_code:            'DTN-001',
    store_address:         '123 Main St, Austin, TX 78701',
    sales_channel_type_id: '3880391793436453',
    is_active:             true,
  },
  {
    id:                    'ksc_patio_001',
    name:                  'Patio Kiosk',
    code:                  'spicekitchenqakiosk',   // ← same store, different kiosk position
    store_id:              '3827930443493620',
    store_name:            'Downtown — Main St',
    store_code:            'DTN-001',
    store_address:         '123 Main St, Austin, TX 78701',
    sales_channel_type_id: '3880391793436453',
    is_active:             true,
  },
];

// ─── Simulated network delay for mock ─────────────────────────────────────────

function mockDelay(ms = 800): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * GetStoreCode API — called immediately after successful login.
 *
 * Returns the list of store codes / kiosk channels available to this user.
 * Callers should:
 *   • Auto-select if exactly one result is returned.
 *   • Show a dropdown picker if multiple results are returned.
 *
 * When the real backend API is ready, update the implementation inside
 * getKioskChannels() (set VITE_AUTH_KIOSK_CHANNEL_SERVICE_ID). This
 * wrapper requires no changes.
 */
export async function getStoreCodes(): Promise<KioskChannel[]> {
  return getKioskChannels();
}

/**
 * Underlying fetcher — maps to the kiosk sales channel service contract.
 * Replace mock block once VITE_AUTH_KIOSK_CHANNEL_SERVICE_ID is set.
 */
export async function getKioskChannels(): Promise<KioskChannel[]> {
  const serviceId = AUTH_CONFIG.KIOSK_CHANNEL_SERVICE_ID;

  // ── REAL API (uncomment + complete when backend is ready) ─────────────────
  if (serviceId) {
    const { user } = useAuthStore.getState();
    if (!user) throw new Error('Not authenticated');

    try {
      const body = {
        url:    `${AUTH_CONFIG.DEV_URL}${serviceId}`,
        method: 'post',
        headers: { application_id: AUTH_CONFIG.GA_APPLICATION_ID },
        payload: {
          // TODO: add kiosk-specific filter params when API spec is confirmed
          sales_channel_type: 'kiosk',
          is_active:          true,
        },
        is_auth:        true,
        environment_id: AUTH_CONFIG.GA_ENVIRONMENT_ID,
        application_id: AUTH_CONFIG.GA_APPLICATION_ID,
        service_id:     serviceId,
      };
      const { data } = await axios.post(AUTH_CONFIG.AUTH_URL, body, {
        headers: {
          'Content-Type': 'application/json',
          access_key:     user.access_key,
          account_id:     user.account_id,
          application_id: user.tac_application_id,
        },
        timeout: 15_000,
      });

      // TODO: map actual response shape when API spec is confirmed
      const channels = (data?.data ?? []) as KioskChannel[];
      logger.info(`[kioskChannel] fetched ${channels.length} channel(s) from API`);
      return channels.filter((c) => c.is_active);
    } catch (err) {
      logger.error('[kioskChannel] API fetch failed, falling back to mock', err);
      // Fall through to mock if API fails during transition
    }
  }
  // ── END REAL API ──────────────────────────────────────────────────────────

  // ── MOCK (active while backend is pending) ────────────────────────────────
  logger.info('[kioskChannel] using mock data (backend API pending)');
  await mockDelay();
  return MOCK_KIOSK_CHANNELS.filter((c) => c.is_active);
}
