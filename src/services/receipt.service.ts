// src/services/receipt.service.ts
// Prints order receipts after a successful payment.
// Fire-and-forget — failures are logged but never block payment success.
//
// ── Reference implementation ──────────────────────────────────────────────────
//  kiosk_straunt_storefront/src/app/shared/services/global.service.ts
//    jsonPrepare()            → builds outputData + loops receipt types
//    generateImageFromLines() → Canvas -> Base64 PNG (we use receiptCanvas.ts)
//
// ── Print paths ───────────────────────────────────────────────────────────────
//  Bluetooth (Star TSP / mPOP / mC-Print):
//    ReceiptLine[] -> renderReceiptToBase64() -> StarPrinterNative.echo()
//  LAN/Wi-Fi (Star LAN / Epson TM-series):
//    plain text -> StarPrinterNative.printText()
//
// ── Dual-printer logic ────────────────────────────────────────────────────────
//  - Customer printer: prints customer receipt
//  - Kitchen printer:  prints kitchen ticket (KOT)
//  - If kitchen receipt is enabled but kitchen printer is NOT configured,
//    kitchen ticket falls back to the customer printer (single-printer mode)

import { Capacitor } from '@capacitor/core';
import { StarPrinterNative } from '@/plugins/star-printer';
import { renderReceiptToBase64, type ReceiptLine } from '@/utils/receiptCanvas';
import { useCartStore } from '@/store/cartStore';
import { useSessionStore } from '@/store/sessionStore';
import { useSettingsStore } from '@/store/settingsStore';
import { usePaymentStore } from '@/store/paymentStore';
import type { SinglePrinterSettings } from '@/store/settingsStore';
import { logger } from '@/utils/logger';

// Try to import storeConfigStore — it may not exist in all brand configs
let _useStoreConfigStore: (() => { getState: () => any }) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('@/store/storeConfigStore');
  _useStoreConfigStore = m.useStoreConfigStore;
} catch { /* optional store */ }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIV    = '----------------------------------------';
const DIV_SM = '--------------------------------';

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    .replace(/\//g, '-');
}

function fmtTime(d: Date): string {
  return d.toTimeString().split(' ')[0];
}

function resolveStoreName(): string {
  try {
    if (_useStoreConfigStore) {
      const cfg = _useStoreConfigStore().getState();
      if ((cfg.store as any)?.name) return (cfg.store as any).name;
    }
  } catch { /* ignore */ }
  return useSettingsStore.getState().api.brandHeader || 'Kiosk';
}

function resolvePaymentLabel(): string {
  const method = usePaymentStore.getState().selectedMethod;
  if (method === 'phone') return 'Mobile Pay';
  if (method === 'qr')    return 'QR Pay';
  return 'Card';
}

// ─── Customer Receipt Line Builder ────────────────────────────────────────────

function buildCustomerLines(orderId: string, storeName: string): ReceiptLine[] {
  const { items, subtotal, taxAmount, tipAmount, total } = useCartStore.getState();
  const now = new Date();
  const paymentLabel = resolvePaymentLabel();

  const lines: ReceiptLine[] = [];

  lines.push({ text: storeName, align: 'center', size: 32, bold: true });
  lines.push({ text: DIV,       align: 'center', size: 22 });

  lines.push({ text: `Order#: ${orderId}`,   align: 'left', bold: true, size: 28 });
  lines.push({ text: 'Customer: Guest User',  align: 'left', size: 22 });
  lines.push({ text: `Date: ${fmtDate(now)}        Time: ${fmtTime(now)}`, align: 'left', size: 22 });
  lines.push({ text: DIV, align: 'center', size: 22 });
  lines.push({ text: 'Qty    Items                      Total', align: 'left', size: 22 });
  lines.push({ text: DIV, align: 'center', size: 22, spacingBelow: 2 });

  const MAX_NAME_LEN = 22;
  for (const item of items) {
    const qty = item.quantity;
    const rawName = item.name || '';
    const totalPrice = (qty * item.unitPrice).toFixed(2);

    const name    = rawName.length > MAX_NAME_LEN ? rawName.slice(0, MAX_NAME_LEN) : rawName.padEnd(MAX_NAME_LEN - 3, ' ');
    const qtyStr  = `${qty}x`.padEnd(4, ' ');
    const priceStr = `$${totalPrice}`.padStart(8, ' ');
    const lineWidth = 38;
    const spacesNeeded = Math.max(0, lineWidth - (qtyStr.length + name.length + priceStr.length));
    const lineText = `${qtyStr}${name}${' '.repeat(spacesNeeded)}${priceStr}`;

    lines.push({ text: lineText, align: 'left', size: 26, bold: true });

    for (const mod of item.modifiers) {
      lines.push({ text: `  + ${mod.name}  $${mod.price.toFixed(2)}`, size: 22 });
    }

    if (item.specialInstructions?.trim()) {
      const instr = item.specialInstructions.trim();
      const instrWords = instr.split(/\s+/);
      const maxLen = 30;
      const instrLines: string[] = [];
      let cur = '';
      for (const w of instrWords) {
        if ((cur + ' ' + w).trim().length > maxLen) {
          if (cur) instrLines.push(cur.trim());
          cur = w;
        } else {
          cur += ' ' + w;
        }
      }
      if (cur.trim()) instrLines.push(cur.trim());
      instrLines.forEach((il, i) => {
        lines.push({ text: i === 0 ? `Note:- ${il}` : `       ${il}`, align: 'left', size: 22 });
      });
    }
  }

  lines.push({ text: DIV, align: 'center', size: 22, spacingBelow: 2 });

  lines.push({ text: `Items Subtotal: $${subtotal.toFixed(2)}`, align: 'right', size: 24 });
  if (taxAmount > 0) lines.push({ text: `Tax: $${taxAmount.toFixed(2)}`,         align: 'right', size: 24 });
  if (tipAmount > 0) lines.push({ text: `Tip: $${tipAmount.toFixed(2)}`,         align: 'right', size: 24 });
  lines.push({ text: `TOTAL: $${total.toFixed(2)}`,                              align: 'right', size: 30, bold: true });
  lines.push({ text: DIV, align: 'center', size: 22, spacingBelow: 2 });

  lines.push({ text: `Payment: ${paymentLabel} (success)`, align: 'center', size: 22, bold: true });
  lines.push({ text: '*** Thank you for ordering ***',      align: 'center', size: 22 });

  lines.push({ text: '', size: 20 });
  lines.push({ text: '', size: 20 });
  lines.push({ text: '', size: 20 });

  return lines;
}

// ─── Customer Receipt Plain-Text (LAN) ────────────────────────────────────────

function buildCustomerText(orderId: string, storeName: string): string {
  const { items, subtotal, taxAmount, tipAmount, total } = useCartStore.getState();
  const now = new Date();
  const paymentLabel = resolvePaymentLabel();

  let t = `${storeName}\n${DIV_SM}\n`;
  t += `Order#: ${orderId}\n`;
  t += `Customer: Guest User\n`;
  t += `Date: ${fmtDate(now)}   Time: ${fmtTime(now)}\n${DIV_SM}\n`;
  t += `Qty    Items                      Total\n${DIV_SM}\n`;

  for (const item of items) {
    const totalPrice = (item.quantity * item.unitPrice).toFixed(2);
    const label = `${item.quantity}x ${item.name}`;
    t += `${label.padEnd(24)}$${totalPrice}\n`;
    for (const mod of item.modifiers) {
      t += `  + ${mod.name.padEnd(20)}$${mod.price.toFixed(2)}\n`;
    }
    if (item.specialInstructions?.trim()) {
      t += `  Note: ${item.specialInstructions.trim()}\n`;
    }
  }

  t += `${DIV_SM}\n`;
  t += `Items Subtotal:${String('$' + subtotal.toFixed(2)).padStart(17)}\n`;
  if (taxAmount > 0) t += `Tax:${String('$' + taxAmount.toFixed(2)).padStart(27)}\n`;
  if (tipAmount > 0) t += `Tip:${String('$' + tipAmount.toFixed(2)).padStart(27)}\n`;
  t += `TOTAL:${String('$' + total.toFixed(2)).padStart(25)}\n${DIV_SM}\n`;
  t += `Payment: ${paymentLabel} (success)\n`;
  t += `*** Thank you for ordering ***\n\n\n\n`;

  return t;
}

// ─── Kitchen Ticket (KOT) Line Builder ───────────────────────────────────────

function buildKitchenLines(orderId: string, storeName: string): ReceiptLine[] {
  const { items } = useCartStore.getState();
  const now = new Date();

  const lines: ReceiptLine[] = [];

  lines.push({ text: storeName,            align: 'center', size: 32, bold: true });
  lines.push({ text: DIV,                  align: 'center', size: 22 });
  lines.push({ text: `Order#: ${orderId}`, align: 'center', bold: true, size: 35 });
  lines.push({ text: `Date: ${fmtDate(now)}        Time: ${fmtTime(now)}`, align: 'left', size: 22 });
  lines.push({ text: DIV, align: 'center', size: 22 });
  lines.push({ text: 'Qty    Items                      Total', align: 'left', size: 22 });
  lines.push({ text: DIV, align: 'center', size: 22, spacingBelow: 2 });

  const MAX_LINE = 30;
  for (const item of items) {
    const itemTotal = (item.quantity * item.unitPrice).toFixed(2);
    let productName = item.name || '';
    const nameLines: string[] = [];
    while (productName.length > MAX_LINE) {
      nameLines.push(productName.slice(0, MAX_LINE));
      productName = productName.slice(MAX_LINE);
    }
    if (productName) nameLines.push(productName);

    lines.push({ text: `${item.quantity}x ${nameLines[0]}`, align: 'left', size: 26, bold: true });
    nameLines.slice(1).forEach((nl) => lines.push({ text: `   ${nl}`, align: 'left', size: 24 }));
    lines.push({ text: `$${itemTotal}`, align: 'right', size: 22, bold: true });

    if (item.specialInstructions?.trim()) {
      const instr = item.specialInstructions.trim();
      const instrWords = instr.split(/\s+/);
      const instrLines: string[] = [];
      let cur = '';
      for (const w of instrWords) {
        if ((cur + ' ' + w).trim().length > MAX_LINE) {
          if (cur) instrLines.push(cur.trim());
          cur = w;
        } else {
          cur += ' ' + w;
        }
      }
      if (cur.trim()) instrLines.push(cur.trim());
      instrLines.forEach((il, i) => {
        lines.push({ text: i === 0 ? `Note:- ${il}` : `       ${il}`, align: 'left', size: 22 });
      });
    }
  }

  lines.push({ text: DIV, align: 'center', size: 22, spacingBelow: 2 });
  lines.push({ text: '*** Prepare Quickly ***', align: 'center', size: 24, bold: true });

  lines.push({ text: '', size: 20 });
  lines.push({ text: '', size: 20 });
  lines.push({ text: '', size: 20 });

  return lines;
}

// ─── Kitchen Ticket Plain-Text (LAN) ──────────────────────────────────────────

function buildKitchenText(orderId: string, storeName: string): string {
  const { items } = useCartStore.getState();
  const now = new Date();

  let t = `${storeName}\n${DIV_SM}\n`;
  t += `Order#: ${orderId}\n`;
  t += `Date: ${fmtDate(now)}   Time: ${fmtTime(now)}\n${DIV_SM}\n`;
  t += `Qty    Items                      Total\n${DIV_SM}\n`;

  for (const item of items) {
    const itemTotal = (item.quantity * item.unitPrice).toFixed(2);
    t += `${item.quantity}x ${item.name}\n`;
    t += `${' '.repeat(28)}$${itemTotal}\n`;
    for (const mod of item.modifiers) {
      t += `  + ${mod.name}\n`;
    }
    if (item.specialInstructions?.trim()) {
      t += `  Note:- ${item.specialInstructions.trim()}\n`;
    }
  }

  t += `${DIV_SM}\n*** Prepare Quickly ***\n\n\n\n`;
  return t;
}

// ─── Single Printer Print Helper ─────────────────────────────────────────────

async function printToPrinter(
  profile: SinglePrinterSettings,
  linesBuilder: (orderId: string, storeName: string) => ReceiptLine[],
  textBuilder:  (orderId: string, storeName: string) => string,
  orderId: string,
  storeName: string,
  label: string,
): Promise<void> {
  if (profile.connectionType === 'bluetooth') {
    if (!profile.defaultPrinterName || !profile.defaultPrinterAddress) {
      logger.warn(`[receipt] ${label} Bluetooth printer not configured — skipping`);
      return;
    }
    const base64 = renderReceiptToBase64(linesBuilder(orderId, storeName));
    await StarPrinterNative.echo({
      printerName:    profile.defaultPrinterName,
      printerAddress: profile.defaultPrinterAddress,
      constructedObj: base64,
    });
    logger.info(`[receipt] ${label} Bluetooth receipt printed to ${profile.defaultPrinterName}`);

  } else if (profile.connectionType === 'lan') {
    if (!profile.lanPrinterIp) {
      logger.warn(`[receipt] ${label} LAN printer IP not configured — skipping`);
      return;
    }
    await StarPrinterNative.printText({
      ip:       profile.lanPrinterIp,
      textdata: textBuilder(orderId, storeName),
      data:     '',
      model:    profile.lanPrinterModel || 'TSP143',
      count:    1,
    });
    logger.info(`[receipt] ${label} LAN receipt printed to ${profile.lanPrinterIp}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Print order receipts (Customer Receipt + Kitchen Ticket) to configured printers.
 *
 * Logic:
 *  1. Check printCustomerReceipt / printKitchenReceipt toggles from settingsStore
 *  2. Customer receipt -> customer printer
 *  3. Kitchen ticket   -> kitchen printer (if configured), else fallback to customer printer
 *
 * Called from ReceiptScreen auto-print useEffect (with 1 s delay, mirroring
 * kiosk_straunt_storefront's `setTimeout(() => printButton(), 1000)` pattern)
 * and from the manual Print button.
 *
 * Never throws — receipt failure must not affect payment success state.
 */
export async function printOrderReceipt(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    logger.info('[receipt] Not on native platform — skipping print');
    return;
  }

  const { printer } = useSettingsStore.getState();
  const orderId   = useSessionStore.getState().orderId ?? 'N/A';
  const storeName = resolveStoreName();

  logger.info('[receipt] Starting printOrderReceipt', {
    orderId, storeName,
    printCustomer: printer.printCustomerReceipt,
    printKitchen:  printer.printKitchenReceipt,
    custType: printer.customer?.connectionType,
    kitType:  printer.kitchen?.connectionType,
  });

  // 1. Resolve effective customer printer profile
  //    Fall back to legacy flat fields for backward compatibility
  const custProfile: SinglePrinterSettings =
    (printer.customer?.connectionType && printer.customer.connectionType !== 'none')
      ? printer.customer
      : {
          connectionType:        printer.connectionType,
          defaultPrinterName:    printer.defaultPrinterName,
          defaultPrinterAddress: printer.defaultPrinterAddress,
          lanPrinterIp:          printer.lanPrinterIp,
          lanPrinterModel:       printer.lanPrinterModel,
        };

  const kitProfile: SinglePrinterSettings | undefined = printer.kitchen;
  const kitConfigured = kitProfile?.connectionType && kitProfile.connectionType !== 'none';

  // 2. Customer Receipt
  if (printer.printCustomerReceipt !== false) {
    if (custProfile.connectionType !== 'none') {
      try {
        await printToPrinter(custProfile, buildCustomerLines, buildCustomerText, orderId, storeName, 'Customer');
      } catch (err) {
        logger.warn('[receipt] Customer receipt failed (non-fatal):', err);
      }
    } else {
      logger.info('[receipt] Customer receipt: no printer configured');
    }
  }

  // 3. Kitchen Ticket
  if (printer.printKitchenReceipt !== false) {
    // If kitchen printer is not configured, fall back to customer printer
    const targetProfile = (kitConfigured ? kitProfile : custProfile) as SinglePrinterSettings;
    const targetLabel   = kitConfigured ? 'Kitchen' : 'Kitchen->Customer(fallback)';

    if (targetProfile?.connectionType && targetProfile.connectionType !== 'none') {
      try {
        await printToPrinter(targetProfile, buildKitchenLines, buildKitchenText, orderId, storeName, targetLabel);
      } catch (err) {
        logger.warn('[receipt] Kitchen ticket failed (non-fatal):', err);
      }
    } else {
      logger.info('[receipt] Kitchen ticket: no printer configured (no fallback available)');
    }
  }
}
