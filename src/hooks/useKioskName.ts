// src/hooks/useKioskName.ts
// Returns the best available display name for this kiosk, in priority order:
//   1. channel.name   — from the selected kiosk sales channel (API response)
//   2. store.name     — from the loaded store details (API response)
//   3. environment.displayName — from VITE_DISPLAY_NAME env var
//   4. 'Kiosk'        — safe fallback, never exposes any internal brand name
//
// Use this hook everywhere a kiosk/store name is shown to customers.
// Never use environment.displayName directly in UI components.

import { useKioskChannelStore } from '@/store/kioskChannelStore';
import { useStoreConfigStore }  from '@/store/storeConfigStore';
import { useBrand }             from '@/hooks/useBrand';

export function useKioskName(): string {
  const channelName = useKioskChannelStore((s) => s.channel?.name ?? '');
  const storeName   = useStoreConfigStore((s) => s.store?.name ?? '');
  const { environment } = useBrand();

  return (channelName || storeName || environment.displayName || 'Kiosk').trim();
}

/** First character of the kiosk name — used for monogram avatars. */
export function useKioskInitial(): string {
  return useKioskName()[0]?.toUpperCase() ?? 'K';
}
