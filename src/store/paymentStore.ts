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
  /** True while an auto-reconnect is in progress (launch restore or resume reconnect).
   *  Used by PaymentTab and other UI to show a reconnecting indicator. */
  readerReconnecting: boolean;

  setFlowState: (s: PaymentFlowState) => void;
  setError: (e: string | null) => void;
  setPaymentIntentId: (id: string | null) => void;
  setConnectedReader: (r: TerminalReader | null) => void;
  setIsWebFallback: (v: boolean) => void;
  setSelectedMethod: (m: PaymentMethod | null) => void;
  setReaderReconnecting: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  flowState: 'idle' as PaymentFlowState,
  error: null,
  paymentIntentId: null,
  connectedReader: null,
  isWebFallback: false,
  selectedMethod: null as PaymentMethod | null,
  readerReconnecting: false,
};

export const usePaymentStore = create<PaymentState>()((set) => ({
  ...initialState,

  setFlowState:      (flowState)      => set({ flowState }),
  setError:          (error)          => set({ error }),
  setPaymentIntentId:(paymentIntentId)=> set({ paymentIntentId }),
  setConnectedReader: (connectedReader) => set((state) => {
    if (!state.connectedReader && !connectedReader) return {};
    if (!state.connectedReader || !connectedReader) return { connectedReader };
    if (
      state.connectedReader.serialNumber === connectedReader.serialNumber &&
      state.connectedReader.status === connectedReader.status &&
      state.connectedReader.batteryLevel === connectedReader.batteryLevel &&
      state.connectedReader.label === connectedReader.label
    ) {
      return {};
    }
    return { connectedReader };
  }),
  setIsWebFallback:       (isWebFallback)       => set({ isWebFallback }),
  setSelectedMethod:      (selectedMethod)      => set({ selectedMethod }),
  setReaderReconnecting:  (readerReconnecting)  => set({ readerReconnecting }),
  // Preserve connectedReader and selectedMethod across payment resets.
  // - connectedReader: the reader stays connected between payments (same as kiosk_straunt_storefront).
  // - selectedMethod: runPaymentFlow() calls reset() at entry; clearing selectedMethod here would
  //   immediately unmount CardPayView and return to the method selector (visible as "nothing happens").
  reset: () => set((state) => ({
    ...initialState,
    connectedReader: state.connectedReader,
    selectedMethod: state.selectedMethod,
    readerReconnecting: state.readerReconnecting,
  })),
}));
