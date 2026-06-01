// src/store/cartStore.ts
import { create } from 'zustand';

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface CartModifier {
  id: string;
  name: string;
  price: number; // dollars added on top of base/variant price
}

export interface CartVariant {
  id: string;
  name: string;
  price: number; // absolute price — replaces basePrice when present
}

export interface CartItem {
  cartItemId: string;         // random UUID — unique per cart line
  fingerprint: string;        // deterministic: productId + variantId + sorted modifierIds
  productId: string;
  name: string;
  basePrice: number;
  imageUrl: string;
  variant?: CartVariant;
  modifiers: CartModifier[];
  quantity: number;
  specialInstructions: string;
  unitPrice: number;          // (variant?.price ?? basePrice) + Σ modifiers.price
  lineTotal: number;          // unitPrice × quantity
}

export interface AddItemPayload {
  productId: string;
  name: string;
  basePrice: number;
  imageUrl?: string;
  variant?: CartVariant;
  modifiers?: CartModifier[];
  specialInstructions?: string;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeUnitPrice(basePrice: number, variant?: CartVariant, modifiers: CartModifier[] = []): number {
  const base = variant ? variant.price : basePrice;
  const modTotal = modifiers.reduce((sum, m) => sum + m.price, 0);
  return r2(base + modTotal);
}

function buildFingerprint(productId: string, variant?: CartVariant, modifiers: CartModifier[] = []): string {
  const variantPart = variant?.id ?? '';
  const modPart = modifiers.map((m) => m.id).sort().join(',');
  return `${productId}|${variantPart}|${modPart}`;
}

function recalcTotals(
  items: CartItem[],
  taxRate: number,
  tipAmount: number,
): Pick<CartState, 'subtotal' | 'taxAmount' | 'total'> {
  const subtotal = r2(items.reduce((s, i) => s + i.lineTotal, 0));
  const taxAmount = r2(subtotal * taxRate);
  const total = r2(subtotal + taxAmount + tipAmount);
  return { subtotal, taxAmount, total };
}

function newUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export interface CartState {
  items: CartItem[];
  taxRate: number;
  tipAmount: number;
  subtotal: number;
  taxAmount: number;
  total: number;

  addItem: (payload: AddItemPayload) => void;
  removeItem: (cartItemId: string) => void;
  updateQty: (cartItemId: string, qty: number) => void;
  updateSpecialInstructions: (cartItemId: string, text: string) => void;
  setTip: (amount: number) => void;
  setTaxRate: (rate: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  taxRate: 0.0825, // Texas default — synced from settingsStore at runtime
  tipAmount: 0,
  subtotal: 0,
  taxAmount: 0,
  total: 0,

  addItem(payload) {
    const { productId, name, basePrice, imageUrl = '', variant, modifiers = [], specialInstructions = '' } = payload;
    const fp = buildFingerprint(productId, variant, modifiers);

    set((state) => {
      const existing = state.items.find((i) => i.fingerprint === fp);

      let nextItems: CartItem[];
      if (existing) {
        nextItems = state.items.map((i) =>
          i.fingerprint === fp
            ? { ...i, quantity: i.quantity + 1, lineTotal: r2(i.unitPrice * (i.quantity + 1)) }
            : i,
        );
      } else {
        const unitPrice = computeUnitPrice(basePrice, variant, modifiers);
        const newItem: CartItem = {
          cartItemId: newUUID(),
          fingerprint: fp,
          productId,
          name,
          basePrice,
          imageUrl,
          variant,
          modifiers,
          quantity: 1,
          specialInstructions,
          unitPrice,
          lineTotal: unitPrice,
        };
        nextItems = [...state.items, newItem];
      }

      return {
        items: nextItems,
        ...recalcTotals(nextItems, state.taxRate, state.tipAmount),
      };
    });
  },

  removeItem(cartItemId) {
    set((state) => {
      const nextItems = state.items.filter((i) => i.cartItemId !== cartItemId);
      return { items: nextItems, ...recalcTotals(nextItems, state.taxRate, state.tipAmount) };
    });
  },

  updateQty(cartItemId, qty) {
    if (qty < 1) {
      get().removeItem(cartItemId);
      return;
    }
    set((state) => {
      const nextItems = state.items.map((i) =>
        i.cartItemId === cartItemId
          ? { ...i, quantity: qty, lineTotal: r2(i.unitPrice * qty) }
          : i,
      );
      return { items: nextItems, ...recalcTotals(nextItems, state.taxRate, state.tipAmount) };
    });
  },

  updateSpecialInstructions(cartItemId, text) {
    set((state) => ({
      items: state.items.map((i) =>
        i.cartItemId === cartItemId ? { ...i, specialInstructions: text } : i,
      ),
    }));
  },

  setTip(amount) {
    set((state) => ({
      tipAmount: r2(amount),
      ...recalcTotals(state.items, state.taxRate, r2(amount)),
    }));
  },

  setTaxRate(rate) {
    set((state) => ({
      taxRate: rate,
      ...recalcTotals(state.items, rate, state.tipAmount),
    }));
  },

  clearCart() {
    set({ items: [], tipAmount: 0, subtotal: 0, taxAmount: 0, total: 0 });
  },
}));
