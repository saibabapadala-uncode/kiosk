// src/services/altPayment.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Alternative payment methods: Phone Pay (Apple/Google Pay via SMS link)
// and QR Pay.  Business logic ported from kiosk_straunt_storefront:
//   payment.page.ts  placeOrderWithPhoneNumber(), placeOrderWithUPI()
//   api.service.ts   getPhoneOrderAccesskey(), placeKioskOrder(), aiCreateCartDetails()
//
// These APIs use a different base URL (api.uncodeapi.com) and a different
// header pattern from the main brand API (handled by api.service.ts).
// We use a dedicated axios instance so the brand interceptor is not applied.
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';
import { AUTH_CONFIG }            from '@/config/auth.config';
import { getActiveBrandAuthConfig } from '@/config/brand-auth';
import { useAuthStore }           from '@/store/authStore';
import { useCartStore }           from '@/store/cartStore';
import { useKioskChannelStore }   from '@/store/kioskChannelStore';
import { useSettingsStore }       from '@/store/settingsStore';
import { getBrandEnvironment, isValidBrand } from '@/brands';
import { submitOrder }            from './order.service';
import { logger }                 from '@/utils/logger';
import type {
  AltPayCartDetailItem,
  PhoneAccessKeyRequest,
  PhoneAccessKeyResponse,
  PlaceKioskOrderPayload,
  PlaceKioskOrderResponse,
  AiCreateCartResponse,
} from '@/types/altPayment';

// ─── BLS service contract IDs (from kiosk_straunt_storefront constants.ts) ───
const BLS_PHONE_ACCESS_KEY  = '87b136c3a0974e3f936c1ba5d395a121';
const BLS_PLACE_KIOSK_ORDER = '3877454457435690';
const BLS_AI_CREATE_CART    = 'b39975f4682242cb82388a53485a044c';

// ─── Axios instance for alt-payment gateway (no brand interceptor) ────────────
const altApi = axios.create({ timeout: 20_000 });

// ─── Header builders ─────────────────────────────────────────────────────────

/** Headers for unauthenticated gateway calls (phone access key + ai-cart). */
function unauthHeaders() {
  const auth      = useAuthStore.getState();
  const brandAuth = getActiveBrandAuthConfig();
  return {
    'subscribed_tac_account_id':     AUTH_CONFIG.ACCOUNT_ID,
    'subscribed_tac_application_id': auth.user?.tac_application_id ?? '',
    'subscribed_tac_environment_id': AUTH_CONFIG.SHARED_ENVIRONMENT_ID,
    'x-api-key':                     AUTH_CONFIG.ALT_PAYMENT_API_KEY,
    'ext_user_id':                   auth.user?.su_id ?? '',
    'prd_id':                        brandAuth.prdId,
    'Content-Type':                  'application/json',
  };
}

// ─── Cart detail builder ──────────────────────────────────────────────────────

/** Maps cartStore items → the `cart_details` array expected by the gateway. */
function buildCartDetails(): AltPayCartDetailItem[] {
  return useCartStore.getState().items.map((item) => ({
    variant_id:          item.variant?.id ?? item.productId,
    quantity:            item.quantity,
    product_id:          item.productId,
    special_instruction: item.specialInstructions,
    product_modifiers:   item.modifiers.map((m) => ({ modifier_id: m.id, quantity: 1 })),
  }));
}

// ─── Alt-payment brand config accessor ───────────────────────────────────────

/** Returns the altPayment config block for the currently active brand. */
export function getAltPaymentConfig() {
  const brandId = useSettingsStore.getState().brandId;
  if (brandId && isValidBrand(brandId)) {
    return getBrandEnvironment(brandId).altPayment ?? null;
  }
  return null;
}

/** True when the active brand has alt-payment configured. */
export function altPaymentAvailable(): boolean {
  return getAltPaymentConfig() !== null;
}

// ─── Phone Pay ────────────────────────────────────────────────────────────────

/**
 * Step 1: Exchange a customer phone number for a temporary access key.
 * Mirrors api.service.ts getPhoneOrderAccesskey() in the old project.
 */
export async function fetchPhoneAccessKey(
  phonenumber: string,
): Promise<PhoneAccessKeyResponse> {
  const channel = useKioskChannelStore.getState().channel;
  const config  = getAltPaymentConfig();
  if (!channel) throw new Error('No kiosk channel selected');
  if (!config)  throw new Error('Alt-payment not configured for this brand');

  const payload: PhoneAccessKeyRequest = {
    store_id:    channel.store_id,
    store_code:  channel.store_code,
    phonenumber: phonenumber.replace(/\D/g, ''),
    industry_id: config.industryId,
    uuid:        crypto.randomUUID(),
  };

  const url = `${AUTH_CONFIG.ALT_PAYMENT_BASE_URL}/${AUTH_CONFIG.ALT_PAYMENT_APP_ID}/${BLS_PHONE_ACCESS_KEY}`;
  logger.info('[altPay/phone] fetching access key', { url, store_code: channel.store_code });

  const resp = await altApi.post<PhoneAccessKeyResponse>(url, payload, {
    headers: unauthHeaders(),
  });
  return resp.data;
}

/**
 * Step 2: Place the kiosk order using the customer's access key.
 * Mirrors api.service.ts placeKioskOrder() in the old project.
 * send_msg = '1' → customer receives an SMS payment link.
 */
export async function placePhoneOrder(
  customerId:         string,
  phoneNumber:        string,
  customerAccessKey:  string,
): Promise<PlaceKioskOrderResponse> {
  const channel = useKioskChannelStore.getState().channel;
  if (!channel) throw new Error('No kiosk channel selected');

  const payload: PlaceKioskOrderPayload = {
    cart: {
      store_code:   channel.store_code,
      phone_number: phoneNumber.replace(/\D/g, ''),
      customer_id:  customerId,
    },
    cart_details:            buildCartDetails(),
    uuid:                    crypto.randomUUID(),
    sales_channel_id:        channel.id,
    sales_channel_type_id:   channel.sales_channel_type_id,
    sales_channel_type_name: 'Kiosk',
    send_msg: '1',
  };

  const url = `${AUTH_CONFIG.ALT_PAYMENT_GATEWAY_URL}/service_contract/${BLS_PLACE_KIOSK_ORDER}`;
  logger.info('[altPay/phone] placing kiosk order', { url });

  const resp = await altApi.post<PlaceKioskOrderResponse>(url, payload, {
    headers: { access_key: customerAccessKey, 'Content-Type': 'application/json' },
  });
  return resp.data;
}

/**
 * Full phone-pay flow:
 * 1. Validate phone number
 * 2. Fetch customer access key
 * 3. Place kiosk order (triggers SMS to customer)
 * 4. Record the order locally via submitOrder()
 *
 * Returns the order UUID on success; throws on any failure.
 */
export async function runPhonePayFlow(
  rawPhone: string,
): Promise<{ customerId: string; orderId: string }> {
  const digits = rawPhone.replace(/\D/g, '');
  if (!/^\d{10}$/.test(digits)) throw new Error('Please enter a valid 10-digit US phone number.');

  logger.info('[altPay/phone] starting flow');

  // Step 1 — access key
  const keyResp = await fetchPhoneAccessKey(digits);
  if (keyResp.status !== 'success') {
    throw new Error(keyResp.message ?? 'Could not verify phone number. Please try again.');
  }

  const { id: customerId, access_key: customerAccessKey } = keyResp.data;

  // Step 2 — place order (sends SMS)
  const orderResp = await placePhoneOrder(customerId, digits, customerAccessKey);
  if (orderResp.status !== 'success') {
    throw new Error(orderResp.message ?? 'Order could not be placed. Please try again.');
  }

  // Step 3 — record locally (offline queue)
  await submitOrder({ paymentMethod: 'phone' });

  const orderId = `PHONE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  logger.info('[altPay/phone] success', { customerId, orderId });
  return { customerId, orderId };
}

// ─── QR Pay ───────────────────────────────────────────────────────────────────

/**
 * Create an anonymous/AI cart on the server.
 * Mirrors api.service.ts aiCreateCartDetails() in the old project.
 * send_msg = '0' → silent (no SMS; customer scans QR instead).
 */
export async function createAiCart(): Promise<AiCreateCartResponse> {
  const channel = useKioskChannelStore.getState().channel;
  const config  = getAltPaymentConfig();
  if (!channel) throw new Error('No kiosk channel selected');
  if (!config)  throw new Error('Alt-payment not configured for this brand');

  const payload: PlaceKioskOrderPayload = {
    cart: {
      store_code:   channel.store_code,
      phone_number: config.defaultCustomerPhone,
      customer_id:  config.defaultCustomerId,
    },
    cart_details:            buildCartDetails(),
    uuid:                    crypto.randomUUID(),
    sales_channel_id:        channel.id,
    sales_channel_type_id:   channel.sales_channel_type_id,
    sales_channel_type_name: 'Kiosk',
    send_msg: '0',
  };

  const url = `${AUTH_CONFIG.ALT_PAYMENT_BASE_URL}/${AUTH_CONFIG.ALT_PAYMENT_APP_ID}/${BLS_AI_CREATE_CART}`;
  logger.info('[altPay/qr] creating AI cart', { url });

  const resp = await altApi.post<AiCreateCartResponse>(url, payload, {
    headers: unauthHeaders(),
  });
  return resp.data;
}

/**
 * Build the QR code destination URL from the AI cart response.
 * Format: {anonymousProjectUrl}/aicart/{storeCode}/{customerId}/{suId}
 */
export function buildQrPayUrl(suId: string): string {
  const config  = getAltPaymentConfig();
  const channel = useKioskChannelStore.getState().channel;
  if (!config || !channel) return '';
  return `${config.anonymousProjectUrl}/aicart/${channel.store_code}/${config.defaultCustomerId}/${suId}`;
}

/**
 * Full QR-pay flow:
 * 1. Create the AI cart on the server
 * 2. Build the QR URL
 * 3. Record the order locally
 *
 * Returns the QR URL on success; throws on failure.
 */
export async function runQrPayFlow(): Promise<{ qrUrl: string; orderId: string }> {
  logger.info('[altPay/qr] starting flow');

  const cartResp = await createAiCart();
  if (cartResp.status !== 'success' || !cartResp.su_id) {
    throw new Error(cartResp.message ?? 'Could not generate QR code. Please try again.');
  }

  const qrUrl  = buildQrPayUrl(cartResp.su_id);
  const orderId = `QR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  // Record locally — payment completes on customer device, but we still want
  // the order in the local queue for analytics/receipts.
  await submitOrder({ paymentMethod: 'qr' });

  logger.info('[altPay/qr] QR created', { qrUrl, orderId });
  return { qrUrl, orderId };
}
