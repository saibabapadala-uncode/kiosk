// src/types/altPayment.ts
// Shared types for alternative payment methods (Phone Pay / QR Pay).
// Ported from kiosk_straunt_storefront payment.page.ts + api.service.ts.

// ─── Payment method discriminator ────────────────────────────────────────────

/** All supported kiosk payment methods. */
export type PaymentMethod = 'card' | 'phone' | 'qr';

// ─── Cart detail items (used in phone/QR order payloads) ─────────────────────

/** Single line-item shape required by the kiosk-order and ai-cart APIs. */
export interface AltPayCartDetailItem {
  variant_id:          string;
  quantity:            number;
  product_id:          string;
  special_instruction: string;
  product_modifiers:   Array<{ modifier_id: string; quantity: number }>;
}

// ─── Phone Pay API ────────────────────────────────────────────────────────────

/** POST body for BLS 87b136c3a0974e3f936c1ba5d395a121 */
export interface PhoneAccessKeyRequest {
  store_id:    string;
  store_code:  string;
  phonenumber: string;
  industry_id: string;
  uuid:        string;
}

/** Response from the phone-order access-key endpoint. */
export interface PhoneAccessKeyResponse {
  status: 'success' | 'error';
  data:   { id: string; access_key: string };
  message?: string;
}

/** POST body for BLS 3877454457435690 (place kiosk order by phone). */
export interface PlaceKioskOrderPayload {
  cart: {
    store_code:  string;
    phone_number: string;
    customer_id: string;
  };
  cart_details:           AltPayCartDetailItem[];
  uuid:                   string;
  sales_channel_id:       string;
  sales_channel_type_id:  string;
  sales_channel_type_name: string;
  /** '1' = send SMS to customer; '0' = silent (used for QR) */
  send_msg: '0' | '1';
}

export interface PlaceKioskOrderResponse {
  status:   'success' | 'error';
  message?: string;
  data?:    unknown;
}

// ─── QR Pay API ───────────────────────────────────────────────────────────────

/** Response from BLS b39975f4682242cb82388a53485a044c (ai-cart creation). */
export interface AiCreateCartResponse {
  status:   'success' | 'error';
  su_id?:   string;
  message?: string;
}

// ─── Alt payment session state ────────────────────────────────────────────────

/** Union of all possible alt-payment flow steps. */
export type AltPayStep =
  | 'idle'
  | 'method_selected'
  | 'phone_input'
  | 'qr_display'
  | 'processing'
  | 'success'
  | 'error'
  | 'expired';
