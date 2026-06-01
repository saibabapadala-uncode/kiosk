// src/modules/settings/tabs/PaymentTab.tsx
import { useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import {
  initializeAdapter,
  adapterDiscoverReaders,
} from '@/services/stripe/terminal.adapter';
import type { TerminalReader } from '@/services/stripe/types';
import { SettingsField, SettingsSection, SettingsInput, MaskedInput } from '../shared';

// ─── Reader list ───────────────────────────────────────────────────────────────

function ReaderRow({
  reader,
  isCurrent,
  onSelect,
}: {
  reader: TerminalReader;
  isCurrent: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div className="flex items-center gap-3">
        <div
          className={[
            'w-2.5 h-2.5 rounded-full',
            reader.status === 'online' ? 'bg-brand-success' : 'bg-brand-muted',
          ].join(' ')}
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-bold font-brand text-brand-text">{reader.label}</p>
          <p className="text-xs font-brand text-brand-muted font-mono">{reader.serialNumber}</p>
          <p className="text-xs font-brand text-brand-muted capitalize">
            {reader.status} · {reader.deviceType}
          </p>
        </div>
      </div>

      {isCurrent ? (
        <span className="px-3 py-1 rounded-full text-xs font-bold font-brand bg-brand-success/15 text-brand-success border border-brand-success/30">
          Active
        </span>
      ) : (
        <button
          onClick={onSelect}
          aria-label={`Use reader ${reader.label}`}
          className="
            px-3 py-1.5 rounded-brand border border-brand-primary
            text-brand-primary text-xs font-bold font-brand
            hover:bg-brand-primary hover:text-white transition-colors
          "
        >
          Use This
        </button>
      )}
    </div>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

type DiscoverState = 'idle' | 'loading' | 'done' | 'error';

export default function PaymentTab() {
  const { payment, setPayment } = useSettingsStore();
  const locationId = useSettingsStore((s) => s.payment.terminalLocationId);

  const [discoverState, setDiscoverState] = useState<DiscoverState>('idle');
  const [readers, setReaders] = useState<TerminalReader[]>([]);
  const [discoverError, setDiscoverError] = useState('');

  async function handleDiscover() {
    if (!locationId.trim()) {
      setDiscoverError('Enter a Terminal Location ID first.');
      return;
    }
    setDiscoverState('loading');
    setDiscoverError('');
    setReaders([]);

    const ok = await initializeAdapter();
    if (!ok) {
      setDiscoverState('error');
      setDiscoverError(
        'Stripe Terminal is not available. Ensure the app is running on a physical device with the native plugin installed.',
      );
      return;
    }

    try {
      const found = await adapterDiscoverReaders(locationId.trim());
      setReaders(found);
      setDiscoverState('done');
      if (found.length === 0) setDiscoverError('No readers found at this location.');
    } catch (err) {
      setDiscoverState('error');
      setDiscoverError(err instanceof Error ? err.message : 'Discovery failed');
    }
  }

  return (
    <div className="p-5">
      {/* Stripe keys */}
      <SettingsSection title="Stripe Configuration">
        <SettingsField
          label="Publishable Key"
          htmlFor="stripe-pk"
          description="Starts with pk_live_ or pk_test_"
        >
          <MaskedInput
            id="stripe-pk"
            value={payment.stripePublishableKey}
            onChange={(v) => setPayment({ stripePublishableKey: v })}
            placeholder="pk_live_••••••••••••••••"
            aria-label="Stripe publishable key"
          />
        </SettingsField>
      </SettingsSection>

      {/* Terminal */}
      <SettingsSection title="Terminal Reader">
        <SettingsField
          label="Location ID"
          htmlFor="terminal-location"
          description="Found in your Stripe Dashboard → Terminal → Locations"
        >
          <SettingsInput
            id="terminal-location"
            type="text"
            value={payment.terminalLocationId}
            onChange={(e) => setPayment({ terminalLocationId: (e.target as HTMLInputElement).value.trim() })}
            placeholder="tml_xxxxxxxxxxxx"
          />
        </SettingsField>

        <SettingsField
          label="Reader Serial"
          htmlFor="reader-serial"
          description="Pre-configure a specific reader. Leave blank to use the first online reader."
        >
          <SettingsInput
            id="reader-serial"
            type="text"
            value={payment.readerSerialNumber}
            onChange={(e) => setPayment({ readerSerialNumber: (e.target as HTMLInputElement).value.trim() })}
            placeholder="STR-XXX-XXX"
          />
        </SettingsField>

        {/* Discover button */}
        <SettingsField
          label="Nearby Readers"
          description="Scans for online readers at the configured location."
        >
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={handleDiscover}
              disabled={discoverState === 'loading'}
              aria-label="Discover nearby card readers"
              className={[
                'self-start px-5 py-2.5 rounded-brand text-sm font-bold font-brand',
                'transition-all active:scale-95 touch-target',
                discoverState === 'loading'
                  ? 'bg-brand-border text-brand-muted cursor-wait'
                  : 'bg-brand-primary text-white hover:opacity-90',
              ].join(' ')}
            >
              {discoverState === 'loading' ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Scanning…
                </span>
              ) : '🔍 Discover Readers'}
            </button>

            {discoverError && (
              <p role="alert" className="text-sm text-brand-error font-brand">
                {discoverError}
              </p>
            )}

            {readers.length > 0 && (
              <div className="rounded-brand border border-brand-border divide-y divide-brand-border bg-brand-surface">
                {readers.map((r) => (
                  <ReaderRow
                    key={r.serialNumber}
                    reader={r}
                    isCurrent={payment.readerSerialNumber === r.serialNumber}
                    onSelect={() => setPayment({ readerSerialNumber: r.serialNumber })}
                  />
                ))}
              </div>
            )}

            {discoverState === 'done' && readers.length === 0 && !discoverError && (
              <p className="text-sm text-brand-muted font-brand">
                No readers found at this location.
              </p>
            )}
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
