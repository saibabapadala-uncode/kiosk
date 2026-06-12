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

  // Use getState() directly so retryPayment has empty deps and never gets
  // recreated on store updates (previously depended on `store` which changed
  // on every state update, causing downstream effect loops).
  const retryPayment = useCallback(async () => {
    usePaymentStore.getState().reset();
    await runPaymentFlow();
  }, []);

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
