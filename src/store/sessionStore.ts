// src/store/sessionStore.ts
import { create } from 'zustand';

// ─── State machine ─────────────────────────────────────────────────────────────
//
//   idle ──startOrder()──► ordering ──proceedToPayment()──► payment
//     ▲                                                         │
//     └──────────────────resetSession()────────── confirmed ◄──┘
//                                                     (confirmOrder)

export type OrderState = 'idle' | 'ordering' | 'payment' | 'confirmed';

function generateOrderId(): string {
  const d = new Date();
  const ymd =
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KSK-${ymd}-${rand}`;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export interface SessionState {
  orderId: string | null;
  orderState: OrderState;
  channel: 'kiosk';
  brandId: string;
  locationId: string;
  partySize: number;
  /**
   * Whether the customer has confirmed their age in the current session.
   * Used by Holiq age-gate: once true, the gate is not shown again until
   * resetSession() clears it. Never persisted.
   */
  ageVerified: boolean;

  startOrder: () => void;
  proceedToPayment: () => void;
  confirmOrder: (confirmedOrderId: string) => void;
  resetSession: () => void;
  setPartySize: (size: number) => void;
  setBrandId: (id: string) => void;
  setLocationId: (id: string) => void;
  setAgeVerified: (verified: boolean) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  orderId: null,
  orderState: 'idle',
  channel: 'kiosk',
  brandId: import.meta.env.VITE_BRAND || 'straunt',
  locationId: '',
  partySize: 1,
  ageVerified: false,

  startOrder() {
    set({ orderState: 'ordering', orderId: generateOrderId() });
  },

  proceedToPayment() {
    set((state) => {
      if (state.orderState !== 'ordering') return state;
      return { orderState: 'payment' };
    });
  },

  confirmOrder(confirmedOrderId) {
    set((state) => {
      if (state.orderState !== 'payment') return state;
      return { orderState: 'confirmed', orderId: confirmedOrderId };
    });
  },

  resetSession() {
    set({ orderId: null, orderState: 'idle', partySize: 1, ageVerified: false });
  },

  setAgeVerified(verified) {
    set({ ageVerified: verified });
  },

  setPartySize(size) {
    set({ partySize: Math.max(1, size) });
  },

  setBrandId(id) {
    set({ brandId: id });
  },

  setLocationId(id) {
    set({ locationId: id });
  },
}));
