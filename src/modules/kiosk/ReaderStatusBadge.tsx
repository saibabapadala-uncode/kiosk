// src/modules/kiosk/ReaderStatusBadge.tsx
// Small fixed badge — bottom-left — visible to staff, non-intrusive for customers.
// Only rendered when a reader has been configured.
import { useReaderStatus, type ReaderHealth } from '@/hooks/useReaderStatus';
import { usePaymentStore } from '@/store/paymentStore';
import { useSettingsStore } from '@/store/settingsStore';

const HEALTH_CONFIG: Record<
  ReaderHealth,
  { dot: string; label: string; hidden?: boolean }
> = {
  connected:    { dot: 'bg-brand-success', label: 'Reader: Online' },
  disconnected: { dot: 'bg-brand-error animate-pulse', label: 'Reader: Offline' },
  reconnecting: { dot: 'bg-brand-accent animate-pulse', label: 'Reader: Reconnecting…' },
  unknown:      { dot: 'bg-brand-muted', label: 'Reader: Unknown', hidden: true },
};

export default function ReaderStatusBadge() {
  const readerSerial = useSettingsStore((s) => s.payment.readerSerialNumber);
  const isWebFallback = usePaymentStore((s) => s.isWebFallback);
  const { health } = useReaderStatus();

  // Don't show if no reader is configured, or in web-simulator mode
  if (!readerSerial.trim() || isWebFallback) return null;

  const cfg = HEALTH_CONFIG[health];
  if (cfg.hidden) return null;

  return (
    <div
      aria-label={cfg.label}
      title={cfg.label}
      className="
        fixed bottom-3 left-3 z-[100]
        flex items-center gap-1.5
        px-2 py-1 rounded-full
        bg-black/40 backdrop-blur-sm
        pointer-events-none select-none
      "
    >
      <span
        aria-hidden="true"
        className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`}
      />
      <span className="text-white/70 text-[10px] font-brand font-semibold leading-none">
        {health === 'disconnected' ? 'Reader Offline' : 'Reader'}
      </span>
    </div>
  );
}
