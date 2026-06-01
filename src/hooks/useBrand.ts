// src/hooks/useBrand.ts
import { useContext } from 'react';
import { BrandContext, type BrandContextValue } from '@/providers/BrandProvider';

export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    throw new Error('useBrand() must be called inside <BrandProvider>.');
  }
  return ctx;
}
