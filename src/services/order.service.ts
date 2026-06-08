// src/services/order.service.ts
// Builds + submits the finalized order payload.
// Failed submissions are queued in Capacitor Preferences and retried on reconnect.
import { Preferences } from '@capacitor/preferences';
import { api } from './api.service';
import { logger } from '@/utils/logger';
import { useCartStore } from '@/store/cartStore';
import { useSessionStore } from '@/store/sessionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { usePaymentStore } from '@/store/paymentStore';
import { USE_STATIC_PAYMENT_FLOW, delay, getFlowDelay } from './stripe/static.mock';
import type { PaymentMethod } from '@/types/altPayment';

// ─── Payload type ──────────────────────────────────────────────────────────────

export interface OrderLineItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  variant?: { id: string; name: string; price: number };
  modifiers: Array<{ id: string; name: string; price: number }>;
  specialInstructions: string;
}

export interface OrderPayload {
  orderId: string;
  channel: 'kiosk';
  brandId: string;
  locationId: string;
  items: OrderLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  tipAmount: number;
  total: number;
  paymentIntentId: string | null;
  /** Which physical tender was used: 'card' (Stripe Terminal), 'phone', or 'qr'. */
  paymentMethod: PaymentMethod;
  currency: 'usd';
  locale: string;
  timezone: string;
  submittedAt: string; // ISO 8601
}

// ─── Offline queue ─────────────────────────────────────────────────────────────

const QUEUE_KEY = 'ajr_kiosk_order_queue';

async function enqueue(payload: OrderPayload): Promise<void> {
  const { value } = await Preferences.get({ key: QUEUE_KEY });
  const queue: OrderPayload[] = value ? (JSON.parse(value) as OrderPayload[]) : [];
  queue.push(payload);
  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(queue) });
  logger.warn(`[order] queued ${payload.orderId} for retry (${queue.length} in queue)`);
}

async function flushQueue(): Promise<void> {
  if (USE_STATIC_PAYMENT_FLOW) return;

  const { value } = await Preferences.get({ key: QUEUE_KEY });
  if (!value) return;

  const queue: OrderPayload[] = JSON.parse(value) as OrderPayload[];
  if (queue.length === 0) return;

  logger.info(`[order] flushing ${queue.length} queued order(s)`);
  const remaining: OrderPayload[] = [];

  for (const order of queue) {
    try {
      await api.post('/orders', order);
      logger.info(`[order] flushed queued order ${order.orderId}`);
    } catch {
      remaining.push(order);
    }
  }

  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(remaining) });
}

// Register reconnect listener once at module load
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushQueue());
}

// ─── Build payload ─────────────────────────────────────────────────────────────

function buildPayload(): OrderPayload {
  const { items, subtotal, taxAmount, tipAmount, total, taxRate } = useCartStore.getState();
  const { orderId, brandId, locationId } = useSessionStore.getState();
  const { paymentIntentId } = usePaymentStore.getState();
  const { localization } = useSettingsStore.getState();

  return {
    orderId: orderId ?? `KSK-FALLBACK-${Date.now()}`,
    channel: 'kiosk',
    brandId,
    locationId,
    items: items.map((i) => ({
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      variant: i.variant
        ? { id: i.variant.id, name: i.variant.name, price: i.variant.price }
        : undefined,
      modifiers: i.modifiers.map((m) => ({ id: m.id, name: m.name, price: m.price })),
      specialInstructions: i.specialInstructions,
    })),
    subtotal,
    taxRate,
    taxAmount,
    tipAmount,
    total,
    paymentIntentId,
    paymentMethod: 'card',
    currency: 'usd',
    locale: localization.locale,
    timezone: localization.timezone,
    submittedAt: new Date().toISOString(),
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Submit the current order to the backend.
 * On network failure the payload is added to an offline queue and
 * automatically retried when connectivity is restored.
 * Never throws — calling code does not need to handle errors here.
 *
 * @param overrides  Optional field overrides — used by alt-payment methods to
 *                   supply the correct paymentMethod ('phone' | 'qr') since
 *                   they don't go through Stripe Terminal.
 */
export async function submitOrder(overrides?: Partial<OrderPayload>): Promise<void> {
  const payload = { ...buildPayload(), ...overrides };

  if (USE_STATIC_PAYMENT_FLOW) {
    await delay(getFlowDelay('submitOrderMs', 300));
    logger.info(`[order/static] accepted ${payload.orderId}`);
    return;
  }

  try {
    await api.post('/orders', payload);
    logger.info(`[order] submitted ${payload.orderId}`);
  } catch (err) {
    const isOffline = !navigator.onLine || (err as { code?: string })?.code === 'ERR_NETWORK';
    if (isOffline) {
      await enqueue(payload);
    } else {
      // Server error — still queue for retry rather than losing the order
      await enqueue(payload);
      logger.error(`[order] server error for ${payload.orderId}, queued for retry`, err);
    }
  }
}

export { flushQueue as flushOfflineOrderQueue };
