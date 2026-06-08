// src/store/paymentStore.ts
import { create } from 'zustand';
import type { PaymentFlowState, TerminalReader } from '@/services/stripe/types';
import type { PaymentMethod } from '@/types/altPayment';

export interface PaymentState {
  flowState: PaymentFlowState;
  error: string | null;
  paymentIntentId: string | null;
  connectedReader: TerminalReader | null;
  isWebFallback: boolean;
  /** Which payment method the customer selected on the method-picker screen.
   *  null = method not yet chosen (show selector). */
  selectedMethod: PaymentMethod | null;

  setFlowState: (s: PaymentFlowState) => void;
  setError: (e: string | null) => void;
  setPaymentIntentId: (id: string | null) => void;
  setConnectedReader: (r: TerminalReader | null) => void;
  setIsWebFallback: (v: boolean) => void;
  setSelectedMethod: (m: PaymentMethod | null) => void;
  reset: () => void;
}

const initialState = {
  flowState: 'idle' as PaymentFlowState,
  error: null,
  paymentIntentId: null,
  connectedReader: null,
  isWebFallback: false,
  selectedMethod: null as PaymentMethod | null,
};

export const usePaymentStore = create<PaymentState>()((set) => ({
  ...initialState,

  setFlowState:      (flowState)      => set({ flowState }),
  setError:          (error)          => set({ error }),
  setPaymentIntentId:(paymentIntentId)=> set({ paymentIntentId }),
  setConnectedReader:(connectedReader)=> set({ connectedReader }),
  setIsWebFallback:  (isWebFallback)  => set({ isWebFallback }),
  setSelectedMethod: (selectedMethod) => set({ selectedMethod }),
  reset: () => set(initialState),
}));
