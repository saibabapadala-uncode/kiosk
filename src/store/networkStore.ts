// src/store/networkStore.ts
import { create } from 'zustand';

export type ConnectionType = 'wifi' | 'cellular' | 'none' | 'unknown';

export interface NetworkState {
  isOnline: boolean;
  connectionType: ConnectionType;
  setOnline: (v: boolean) => void;
  setConnectionType: (t: ConnectionType) => void;
}

export const useNetworkStore = create<NetworkState>()((set) => ({
  // Optimistic: assume online until the plugin says otherwise
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  connectionType: 'unknown',
  setOnline: (isOnline) => set({ isOnline }),
  setConnectionType: (connectionType) => set({ connectionType }),
}));
