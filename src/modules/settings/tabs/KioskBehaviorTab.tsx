import { useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { SettingsInput, ToggleSwitch } from '../shared';
import { themeColors, themeRGBA } from '@/utils/themeColors';

type PrintTestState = 'idle' | 'testing' | 'ok' | 'error';

function secondsLabel(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return s % 60 === 0 ? `${m}m` : `${m}m ${s % 60}s`;
}

function FieldCard({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4.5 space-y-3" style={{ background: themeColors.surface, border: `1.5px solid ${themeColors.border}` }}>
      <div>
        <p className="text-sm font-bold font-brand" style={{ color: themeColors.text }}>{title}</p>
        <p className="text-xs font-brand mt-0.5 leading-relaxed" style={{ color: themeColors.muted }}>{hint}</p>
      </div>
      {children}
    </div>
  );
}

function StaffAccessCard() {
  const { kiosk, setKiosk } = useSettingsStore();
  const [draft, setDraft] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saved, setSaved] = useState(false);
  const [pinErr, setPinErr] = useState('');

  function handleToggle(enabled: boolean) {
    setKiosk({ staffPinEnabled: enabled });
    if (!enabled) {
      setDraft('');
      setConfirm('');
      setSaved(false);
      setPinErr('');
    }
  }

  function handleSavePin() {
    if (!/^\d{4}$/.test(draft)) {
      setPinErr('PIN must be exactly 4 digits.');
      return;
    }
    if (draft !== confirm) {
      setPinErr('PINs do not match.');
      return;
    }
    setKiosk({ staffPin: draft });
    setDraft('');
    setConfirm('');
    setPinErr('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <FieldCard
      title="Settings access lock"
      hint="Require a 4-digit staff PIN before opening Settings."
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold font-brand" style={{ color: themeColors.text }}>{kiosk.staffPinEnabled ? 'PIN lock is ON' : 'PIN lock is OFF'}</p>
          <p className="text-xs font-brand mt-0.5" style={{ color: themeColors.muted }}>
            {kiosk.staffPinEnabled ? 'Customers cannot open Settings without the PIN.' : 'Anyone can open Settings from the kiosk.'}
          </p>
        </div>
        <ToggleSwitch checked={kiosk.staffPinEnabled} onChange={handleToggle} label="Enable staff PIN" />
      </div>

      {kiosk.staffPinEnabled && (
        <div className="space-y-2.5">
          {kiosk.staffPin === '1234' && (
            <div className="rounded-xl px-3.5 py-3" style={{ background: themeRGBA('warning', 0.12), border: `1px solid ${themeRGBA('warning', 0.24)}` }}>
              <p className="text-sm font-bold font-brand" style={{ color: 'var(--color-brand-primary)' }}>Default PIN is still active</p>
              <p className="text-xs font-brand mt-0.5" style={{ color: themeColors.text }}>Change it now to secure this kiosk.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <SettingsInput
              id="staff-pin-new"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={draft}
              placeholder="New 4-digit PIN"
              onChange={(e) => {
                setDraft((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4));
                setPinErr('');
                setSaved(false);
              }}
            />
            <SettingsInput
              id="staff-pin-confirm"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirm}
              placeholder="Confirm PIN"
              onChange={(e) => {
                setConfirm((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4));
                setPinErr('');
                setSaved(false);
              }}
            />
          </div>

          {pinErr && <p className="text-xs font-brand" style={{ color: themeColors.error }}>{pinErr}</p>}
          {saved && <p className="text-xs font-brand" style={{ color: themeColors.success }}>PIN updated successfully.</p>}

          <button
            type="button"
            onClick={handleSavePin}
            disabled={draft.length !== 4 || confirm.length !== 4}
            className="px-4 py-2.5 rounded-xl text-xs font-bold font-brand text-white active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed transition-all"
            style={{ background: 'var(--gradient-cta)' }}
          >
            Save PIN
          </button>
        </div>
      )}
    </FieldCard>
  );
}

export default function KioskBehaviorTab() {
  const { kiosk, setKiosk } = useSettingsStore();
  const [_printTest, _setPrintTest] = useState<PrintTestState>('idle');

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5">


      <FieldCard title="Idle timeout" hint="Return to attract screen after inactivity.">
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <span className="text-xs font-brand" style={{ color: themeColors.muted }}>30s</span>
            <input
              id="idle-timeout"
              type="range"
              min={30}
              max={300}
              step={10}
              value={kiosk.idleTimeoutSeconds}
              onChange={(e) => setKiosk({ idleTimeoutSeconds: Number((e.target as HTMLInputElement).value) })}
              className="flex-1 accent-[var(--color-brand-primary)]"
            />
            <span className="text-xs font-brand" style={{ color: themeColors.muted }}>5m</span>
          </div>
          <p className="text-sm font-bold font-brand" style={{ color: 'var(--color-brand-primary)' }}>
            Current timeout: {secondsLabel(kiosk.idleTimeoutSeconds)}
          </p>
        </div>
      </FieldCard>

      <FieldCard title="Attract mode" hint="Show idle animation loop when unattended.">
        <ToggleSwitch checked={kiosk.attractLoopEnabled} onChange={(v) => setKiosk({ attractLoopEnabled: v })} label="Enable attract mode" />
      </FieldCard>

      <FieldCard title="Tax rate" hint="Applied to kiosk orders at this location.">
        <div className="flex items-center gap-2">
          <SettingsInput
            id="tax-rate"
            type="number"
            min="0"
            max="50"
            step="0.01"
            value={(kiosk.taxRate * 100).toFixed(2)}
            onChange={(e) => {
              const pct = parseFloat((e.target as HTMLInputElement).value);
              if (!Number.isNaN(pct)) setKiosk({ taxRate: pct / 100 });
            }}
            className="w-28"
          />
          <span className="text-sm font-bold font-brand" style={{ color: themeColors.muted }}>%</span>
        </div>
      </FieldCard>

      <FieldCard title="Barcode scanner" hint="Enable scanner input support for kiosk flows.">
        <ToggleSwitch checked={kiosk.barcodeScannerEnabled} onChange={(v) => setKiosk({ barcodeScannerEnabled: v })} label="Enable barcode scanner" />
      </FieldCard>

      <StaffAccessCard />

      <FieldCard title="High contrast mode" hint="Improve visibility for accessibility needs.">
        <ToggleSwitch checked={kiosk.highContrastMode} onChange={(v) => setKiosk({ highContrastMode: v })} label="Enable high contrast" />
      </FieldCard>
    </div>
  );
}
