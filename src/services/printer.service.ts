// src/services/printer.service.ts
// Two-mode receipt printing:
//   1. Direct ESC/POS — POST raw commands to an Epson Wi-Fi printer's HTTP API.
//   2. Backend proxy   — POST to /orders/{id}/receipt/print (backend owns the socket).
// Mode is selected by whether the printer responds to the direct ping.
// Falls back to backend proxy on any error.

import { api } from './api.service';
import { useSettingsStore } from '@/store/settingsStore';
import { logger } from '@/utils/logger';
import { USE_STATIC_PAYMENT_FLOW, delay, getFlowDelay } from './stripe/static.mock';

// ─── ESC/POS command helpers ───────────────────────────────────────────────────

const ESC = '\x1B';
const GS  = '\x1D';
const LF  = '\x0A';
const NUL = '\x00';

const CMD = {
  init:          `${ESC}@`,
  cutFull:       `${GS}V${NUL}`,
  centerAlign:   `${ESC}a\x01`,
  leftAlign:     `${ESC}a\x00`,
  bold:          `${ESC}E\x01`,
  boldOff:       `${ESC}E\x00`,
  doubleHeight:  `${ESC}!\x10`,
  normal:        `${ESC}!\x00`,
} as const;

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
}

function priceLine(label: string, price: string, width = 42): string {
  const gap = width - label.length - price.length;
  return label + ' '.repeat(Math.max(1, gap)) + price + LF;
}

export interface PrintableOrder {
  orderId: string;
  brandName: string;
  items: Array<{ name: string; quantity: number; lineTotal: number }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  tipAmount: number;
  total: number;
  currency: string;
}

function buildEscPos(order: PrintableOrder): Uint8Array {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const lines: string[] = [
    CMD.init,
    CMD.centerAlign,
    CMD.bold,
    CMD.doubleHeight,
    order.brandName + LF,
    CMD.normal,
    CMD.boldOff,
    `Order #${order.orderId}` + LF,
    new Date().toLocaleString('en-US') + LF,
    CMD.leftAlign,
    '─'.repeat(42) + LF,
    ...order.items.map(
      (i) => `${i.quantity}x ${pad(i.name, 30)}  ${fmt(i.lineTotal)}` + LF,
    ),
    '─'.repeat(42) + LF,
    priceLine('Subtotal', fmt(order.subtotal)),
    priceLine(`Tax (${(order.taxRate * 100).toFixed(2)}%)`, fmt(order.taxAmount)),
    ...(order.tipAmount > 0 ? [priceLine('Tip', fmt(order.tipAmount))] : []),
    CMD.bold,
    priceLine('TOTAL', fmt(order.total)),
    CMD.boldOff,
    LF,
    CMD.centerAlign,
    'Thank you!' + LF,
    LF,
    LF,
    CMD.cutFull,
  ];

  const raw = lines.join('');
  return new TextEncoder().encode(raw);
}

// ─── Direct Epson HTTP printing ────────────────────────────────────────────────
// Epson TM printers expose a REST API at /cgi-bin/epos/service.cgi

async function printDirect(printerIp: string, order: PrintableOrder): Promise<void> {
  const body = buildEscPos(order);
  const b64 = btoa(String.fromCharCode(...body));

  const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
  <text>${b64}</text>
</epos-print>`;

  const res = await fetch(`http://${printerIp}/cgi-bin/epos/service.cgi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: '"http://www.epson-pos.com/schemas/2011/03/epos-print/Print"',
    },
    body: xmlPayload,
    signal: AbortSignal.timeout(5_000),
  });

  if (!res.ok) throw new Error(`Printer HTTP ${res.status}`);
}

// ─── Backend proxy printing ────────────────────────────────────────────────────

async function printViaBackend(orderId: string, printerIp: string): Promise<void> {
  await api.post(`/orders/${orderId}/receipt/print`, { printerIp });
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function printReceipt(
  order: PrintableOrder,
  orderId: string,
): Promise<'direct' | 'backend'> {
  if (USE_STATIC_PAYMENT_FLOW) {
    await delay(getFlowDelay('receiptPrintMs', 700));
    logger.info(`[printer/static] printed order ${orderId}`);
    return 'backend';
  }

  const printerIp = useSettingsStore.getState().kiosk.receiptPrinterIp.trim();
  if (!printerIp) throw new Error('No receipt printer IP configured in Settings → Kiosk Behavior.');

  // Try direct ESC/POS first
  try {
    await printDirect(printerIp, order);
    logger.info(`[printer] direct print OK — order ${orderId}`);
    return 'direct';
  } catch (err) {
    logger.warn(`[printer] direct print failed, falling back to backend`, err);
  }

  // Fallback: backend proxy
  await printViaBackend(orderId, printerIp);
  logger.info(`[printer] backend print OK — order ${orderId}`);
  return 'backend';
}

export async function testPrinter(): Promise<{ ok: boolean; latencyMs: number; mode: 'direct' | 'backend' | 'error' }> {
  if (USE_STATIC_PAYMENT_FLOW) {
    const start = Date.now();
    await delay(getFlowDelay('printerHealthMs', 250));
    return { ok: true, latencyMs: Date.now() - start, mode: 'backend' };
  }

  const printerIp = useSettingsStore.getState().kiosk.receiptPrinterIp.trim();
  if (!printerIp) return { ok: false, latencyMs: 0, mode: 'error' };

  const start = Date.now();
  try {
    await printDirect(printerIp, {
      orderId: 'TEST',
      brandName: 'Printer Test',
      items: [{ name: 'Test item', quantity: 1, lineTotal: 0 }],
      subtotal: 0, taxRate: 0, taxAmount: 0, tipAmount: 0, total: 0, currency: 'USD',
    });
    return { ok: true, latencyMs: Date.now() - start, mode: 'direct' };
  } catch {
    try {
      await api.get('/health', { timeout: 3_000 } as never);
      return { ok: true, latencyMs: Date.now() - start, mode: 'backend' };
    } catch {
      return { ok: false, latencyMs: Date.now() - start, mode: 'error' };
    }
  }
}
