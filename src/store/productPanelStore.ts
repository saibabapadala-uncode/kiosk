// src/store/productPanelStore.ts
// Lightweight signal store: lets CartTriggerButton (rendered in KioskShell)
// know when the landscape product-detail panel is showing, so it can hide
// itself and avoid overlapping the Add-to-Cart / quantity controls.
import { create } from 'zustand';

interface ProductPanelState {
  /** true when the landscape side-panel is open with a product */
  isLandscapeOpen: boolean;
  setLandscapeOpen: (v: boolean) => void;
}

export const useProductPanelStore = create<ProductPanelState>()((set) => ({
  isLandscapeOpen: false,
  setLandscapeOpen: (v) => set({ isLandscapeOpen: v }),
}));
