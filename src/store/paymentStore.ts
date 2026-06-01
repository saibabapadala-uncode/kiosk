// src/store/paymentStore.ts
import { create } from 'zustand';
import type { PaymentFlowState, TerminalReader } from '@/services/stripe/types';

export interface PaymentState {
  flowState: PaymentFlowState;
  error: string | null;
  paymentIntentId: string | null;
  connectedReader: TerminalReader | null;
  isWebFallback: boolean;

  setFlowState: (s: PaymentFlowState) => void;
  setError: (e: string | null) => void;
  setPaymentIntentId: (id: string | null) => void;
  setConnectedReader: (r: TerminalReader | null) => void;
  setIsWebFallback: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  flowState: 'idle' as PaymentFlowState,
  error: null,
  paymentIntentId: null,
  connectedReader: null,
  isWebFallback: false,
};

export const usePaymentStore = create<PaymentState>()((set) => ({
  ...initialState,

  setFlowState: (flowState) => set({ flowState }),
  setError: (error) => set({ error }),
  setPaymentIntentId: (paymentIntentId) => set({ paymentIntentId }),
  setConnectedReader: (connectedReader) => set({ connectedReader }),
  setIsWebFallback: (isWebFallback) => set({ isWebFallback }),
  reset: () => set(initialState),
}));
