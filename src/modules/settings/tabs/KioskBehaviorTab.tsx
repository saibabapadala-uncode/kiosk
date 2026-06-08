// src/modules/settings/tabs/KioskBehaviorTab.tsx
import { useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { testPrinter } from '@/services/printer.service';
import { SettingsField, SettingsSection, SettingsInput, ToggleSwitch } from '../shared';
import { themeColors, themeRGBA } from '@/utils/themeColors';

// ─── Staff PIN section ────────────────────────────────────────────────────────
// Renders the full PIN-protection configuration block:
//   • Toggle to enable / disable PIN gate (off by default — staff opts in)
//   • PIN change fields (visible only when protection is enabled)
//   • Clear status messaging so staff understand the current state

function StaffAccessSection() {
  const { kiosk, setKiosk } = useSettingsStore();
  const [draft,   setDraft]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [saved,   setSaved]   = useState(false);
  const [pinErr,  setPinErr]  = useState('');

  const borderCol = themeColors.border;

  function handleToggle(enabled: boolean) {
    setKiosk({ staffPinEnabled: enabled });
    // Clear pending PIN fields when disabling
    if (!enabled) { setDraft(''); setConfirm(''); setPinErr(''); setSaved(false); }
  }

  function handleSavePin() {
    if (!/^\d{4}$/.test(draft))  { setPinErr('PIN must be exactly 4 digits.'); return; }
    if (draft !== confirm)        { setPinErr('PINs do not match.'); return; }
    setKiosk({ staffPin: draft });
    setDraft(''); setConfirm(''); setPinErr('');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <SettingsSection title="Staff Access">

      {/* ── Enable / disable toggle ── */}
      <SettingsField
        label="Require PIN for Settings"
        description={
          kiosk.staffPinEnabled
            ? 'Settings are protected — customers cannot access this screen without the PIN.'
            : 'Settings are open — no PIN required. Enable this once the device is configured.'
        }
      >
        <div className="flex flex-col gap-3">
          <ToggleSwitch
            checked={kiosk.staffPinEnabled}
            onChange={handleToggle}
            label="Enable staff PIN protection"
          />

          {/* Status badge */}
          <div
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold font-brand border w-fit"
            style={kiosk.staffPinEnabled ? {
              background: themeRGBA('success', 0.12),
              borderColor: themeRGBA('success', 0.25),
              color: themeColors.success,
            } : {
              background: themeRGBA('warning', 0.12),
              borderColor: themeRGBA('warning', 0.25),
              color: 'var(--color-brand-primary)',
            }}
          >
            <span className="text-sm">{kiosk.staffPinEnabled ? '🔒' : '🔓'}</span>
            {kiosk.staffPinEnabled
              ? 'Settings are locked — PIN required to access'
              : 'Settings are unlocked — anyone can open them from the kiosk'}
          </div>
        </div>
      </SettingsField>

      {/* ── PIN change (only visible when PIN protection is on) ── */}
      {kiosk.staffPinEnabled && kiosk.staffPin === '1234' && (
        <SettingsField label="" description="">
          <div
            className="flex items-start gap-3 px-4 py-3.5 rounded-2xl w-full border"
            style={{
              background: themeRGBA('warning', 0.12),
              borderColor: themeRGBA('warning', 0.25),
            }}
          >
            <span className="text-xl flex-shrink-0 mt-0.5">⚠️</span>
            <div>
              <p className="font-bold font-brand text-sm" style={{ color: 'var(--color-brand-primary)' }}>
                Default PIN in use — change it before leaving the kiosk unattended
              </p>
              <p className="font-brand text-xs mt-1.5 leading-relaxed" style={{ color: themeColors.text }}>
                Anyone who knows the default PIN (1234) can access these settings.
                Set a custom PIN below to secure this device.
              </p>
            </div>
          </div>
        </SettingsField>
      )}

      {kiosk.staffPinEnabled && (
        <SettingsField
          label="Staff PIN"
          htmlFor="staff-pin-new"
          description="Change the 4-digit PIN staff use to unlock Settings from the kiosk screen."
        >
          <div className="flex flex-col gap-3.5 w-full max-w-xs">

            {/* Current PIN indicator */}
            <div
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border"
              style={{
                background: themeColors.surfaceAlt,
                borderColor: themeColors.border,
              }}
            >
              <span className="text-xs font-brand font-medium" style={{ color: themeColors.muted }}>Current PIN:</span>
              <span className="text-sm font-extrabold font-brand tracking-[0.3em]" style={{ color: themeColors.text }}>
                {'●'.repeat(kiosk.staffPin.length)}
              </span>
            </div>

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
              placeholder="Confirm new PIN"
              onChange={(e) => {
                setConfirm((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4));
                setPinErr('');
                setSaved(false);
              }}
            />

            {pinErr && (
              <p className="text-xs font-bold font-brand animate-fade-in" style={{ color: themeColors.error }}>{pinErr}</p>
            )}
            {saved && (
              <p className="text-xs font-bold font-brand animate-fade-in" style={{ color: themeColors.success }}>
                ✓ PIN updated successfully
              </p>
            )}

            <button
              type="button"
              onClick={handleSavePin}
              disabled={draft.length !== 4 || confirm.length !== 4}
              className="ui-btn-primary py-2.5 text-xs font-bold font-brand transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              style={{ borderRadius: 'var(--radius-xl)' }}
            >
              Update PIN
            </button>
          </div>
        </SettingsField>
      )}
    </SettingsSection>
  );
}

// ─── Seconds label ────────────────────────────────────────────────────────────

function secondsLabel(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return s % 60 === 0 ? `${m}m` : `${m}m ${s % 60}s`;
}

type PrintTestState = 'idle' | 'testing' | 'ok' | 'error';

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function KioskBehaviorTab() {
  const { kiosk, setKiosk } = useSettingsStore();
  const [printTest,   setPrintTest]   = useState<PrintTestState>('idle');
  const [printResult, setPrintResult] = useState<{ latencyMs: number; mode?: string } | null>(null);

  async function handleTestPrint() {
    if (!kiosk.receiptPrinterIp.trim()) return;
    setPrintTest('testing');
    setPrintResult(null);
    const res = await testPrinter();
    setPrintResult({ latencyMs: res.latencyMs, mode: res.mode });
    setPrintTest(res.ok ? 'ok' : 'error');
  }

  return (
    <div className="p-5 max-w-7xl mx-auto">

      {/* Idle & attract */}
      <SettingsSection title="Idle Behaviour">
        <SettingsField
          label="Idle Timeout"
          htmlFor="idle-timeout"
          description={`Kiosk returns to attract screen after ${secondsLabel(kiosk.idleTimeoutSeconds)} of inactivity.`}
        >
          <div className="flex flex-col gap-2.5 w-full">
            <div className="flex items-center gap-3">
              <span className="text-xs font-brand text-brand-muted w-6">30s</span>
              <input
                id="idle-timeout"
                type="range" min={30} max={300} step={10}
                value={kiosk.idleTimeoutSeconds}
                onChange={(e) => setKiosk({ idleTimeoutSeconds: Number(e.target.value) })}
                aria-label={`Idle timeout: ${secondsLabel(kiosk.idleTimeoutSeconds)}`}
                className="flex-1 accent-[var(--color-brand-primary)]"
              />
              <span className="text-xs font-brand text-brand-muted w-6">5m</span>
            </div>
            <p className="text-sm font-bold font-brand text-brand-primary text-center">
              {secondsLabel(kiosk.idleTimeoutSeconds)}
            </p>
          </div>
        </SettingsField>

        <SettingsField
          label="Attract Loop"
          description="Show attract/idle animations when the kiosk is unattended."
        >
          <ToggleSwitch
            checked={kiosk.attractLoopEnabled}
            onChange={(v) => setKiosk({ attractLoopEnabled: v })}
            label="Enable attract loop"
          />
        </SettingsField>
      </SettingsSection>

      {/* Pricing */}
      <SettingsSection title="Pricing">
        <SettingsField
          label="Tax Rate"
          htmlFor="tax-rate"
          description="Applied to all orders at this location. Default: 8.25% (Texas)."
        >
          <div className="flex items-center gap-2">
            <SettingsInput
              id="tax-rate"
              type="number" min="0" max="50" step="0.01"
              value={(kiosk.taxRate * 100).toFixed(2)}
              onChange={(e) => {
                const pct = parseFloat((e.target as HTMLInputElement).value);
                if (!isNaN(pct)) setKiosk({ taxRate: pct / 100 });
              }}
              className="w-28"
            />
            <span className="text-sm font-bold font-brand text-brand-muted">%</span>
          </div>
        </SettingsField>
      </SettingsSection>

      {/* Hardware */}
      <SettingsSection title="Hardware">
        <SettingsField
          label="Receipt Printer IP"
          htmlFor="printer-ip"
          description="IP address of the ESC/POS receipt printer on the local network."
        >
          <div className="flex flex-col gap-3 w-full">
            <SettingsInput
              id="printer-ip"
              type="text"
              value={kiosk.receiptPrinterIp}
              onChange={(e) => setKiosk({ receiptPrinterIp: (e.target as HTMLInputElement).value.trim() })}
              placeholder="192.168.1.100"
            />
            {kiosk.receiptPrinterIp.trim() && (
              <div className="flex items-center gap-3 animate-fade-in">
                <button
                  onClick={handleTestPrint}
                  disabled={printTest === 'testing'}
                  className={[
                    'px-4 py-2.5 rounded-xl text-xs font-bold font-brand transition-all active:scale-95 touch-target',
                    printTest === 'testing'
                      ? 'bg-brand-border text-brand-muted cursor-wait'
                      : 'bg-brand-primary text-white hover:opacity-90',
                  ].join(' ')}
                >
                  {printTest === 'testing' ? 'Testing…' : '🖨 Test Print'}
                </button>
                {printTest === 'ok' && printResult && (
                  <span className="text-xs text-brand-success font-bold font-brand">
                    ✓ OK ({printResult.latencyMs}ms · {printResult.mode})
                  </span>
                )}
                {printTest === 'error' && (
                  <span className="text-xs text-brand-error font-bold font-brand">✕ Unreachable</span>
                )}
              </div>
            )}
          </div>
        </SettingsField>

        <SettingsField
          label="Barcode Scanner"
          description="Enable USB/Bluetooth barcode scanner for loyalty code input."
        >
          <ToggleSwitch
            checked={kiosk.barcodeScannerEnabled}
            onChange={(v) => setKiosk({ barcodeScannerEnabled: v })}
            label="Enable barcode scanner"
          />
        </SettingsField>
      </SettingsSection>

      {/* Staff Access PIN */}
      <StaffAccessSection />

      {/* Accessibility */}
      <SettingsSection title="Accessibility">
        <SettingsField
          label="High Contrast Mode"
          description="Increases contrast for users with visual impairments (WCAG AA+)."
        >
          <ToggleSwitch
            checked={kiosk.highContrastMode}
            onChange={(v) => setKiosk({ highContrastMode: v })}
            label="Enable high contrast mode"
          />
        </SettingsField>
      </SettingsSection>

    </div>
  );
}
