// src/modules/kiosk/OfflineBanner.tsx
// Fixed top banner — slides in when network is lost, slides out on recovery.
// z-[9500]: above CartDrawer (9000) but below IdleWarning (9100).
import { useNetworkStore } from '@/store/networkStore';

export default function OfflineBanner() {
  const isOnline = useNetworkStore((s) => s.isOnline);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-hidden={isOnline}
      className={[
        'fixed top-0 left-0 right-0 z-[9500]',
        'flex items-center justify-center gap-2 py-2 px-4',
        'bg-brand-error text-white text-sm font-bold font-brand',
        'transition-transform duration-300 ease-in-out',
        isOnline ? '-translate-y-full' : 'translate-y-0',
      ].join(' ')}
    >
      {/* Offline icon */}
      <svg aria-hidden="true" className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
      </svg>
      No internet connection — payments and menu updates may be unavailable
    </div>
  );
}
