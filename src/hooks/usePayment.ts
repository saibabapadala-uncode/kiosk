// src/hooks/usePayment.ts
import { useCallback } from 'react';
import { usePaymentStore } from '@/store/paymentStore';
import {
  runPaymentFlow,
  runWebPayment,
  cancelPaymentFlow,
} from '@/services/stripe.service';

export function usePayment() {
  const store = usePaymentStore();

  const startPayment = useCallback(async () => {
    await runPaymentFlow();
  }, []);

  const simulateWebPayment = useCallback(async () => {
    await runWebPayment();
  }, []);

  const retryPayment = useCallback(async () => {
    store.reset();
    await runPaymentFlow();
  }, [store]);

  const cancelPayment = useCallback(async () => {
    await cancelPaymentFlow();
  }, []);

  return {
    ...store,
    startPayment,
    simulateWebPayment,
    retryPayment,
    cancelPayment,
  };
}
