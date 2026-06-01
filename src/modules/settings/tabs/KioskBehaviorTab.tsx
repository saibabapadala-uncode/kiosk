// src/modules/settings/tabs/KioskBehaviorTab.tsx
import { useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { testPrinter } from '@/services/printer.service';
import { SettingsField, SettingsSection, SettingsInput, ToggleSwitch } from '../shared';

function secondsLabel(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
}

type PrintTestState = 'idle' | 'testing' | 'ok' | 'error';

export default function KioskBehaviorTab() {
  const { kiosk, setKiosk } = useSettingsStore();
  const [printTest, setPrintTest] = useState<PrintTestState>('idle');
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
    <div className="p-5">
      {/* Idle & attract */}
      <SettingsSection title="Idle Behaviour">
        <SettingsField
          label="Idle Timeout"
          htmlFor="idle-timeout"
          description={`Kiosk returns to attract screen after ${secondsLabel(kiosk.idleTimeoutSeconds)} of inactivity.`}
        >
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-3">
              <span className="text-xs font-brand text-brand-muted w-6">30s</span>
              <input
                id="idle-timeout"
                type="range"
                min={30}
                max={300}
                step={10}
                value={kiosk.idleTimeoutSeconds}
                onChange={(e) =>
                  setKiosk({ idleTimeoutSeconds: Number(e.target.value) })
                }
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

      {/* Tax */}
      <SettingsSection title="Pricing">
        <SettingsField
          label="Tax Rate"
          htmlFor="tax-rate"
          description="Applied to all orders at this location. Default: 8.25% (Texas)."
        >
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
                if (!isNaN(pct)) setKiosk({ taxRate: pct / 100 });
              }}
              className="w-28"
            />
            <span className="text-sm font-brand text-brand-muted">%</span>
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
          <div className="flex flex-col gap-2 w-full">
            <SettingsInput
              id="printer-ip"
              type="text"
              value={kiosk.receiptPrinterIp}
              onChange={(e) =>
                setKiosk({ receiptPrinterIp: (e.target as HTMLInputElement).value.trim() })
              }
              placeholder="192.168.1.100"
            />
            {kiosk.receiptPrinterIp.trim() && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTestPrint}
                  disabled={printTest === 'testing'}
                  className={[
                    'px-4 py-2 rounded-brand text-xs font-bold font-brand transition-colors touch-target',
                    printTest === 'testing'
                      ? 'bg-brand-border text-brand-muted cursor-wait'
                      : 'bg-brand-primary text-white hover:opacity-90',
                  ].join(' ')}
                >
                  {printTest === 'testing' ? 'Testing…' : '🖨 Test Print'}
                </button>
                {printTest === 'ok' && printResult && (
                  <span className="text-xs text-brand-success font-brand">
                    ✓ OK ({printResult.latencyMs}ms · {printResult.mode})
                  </span>
                )}
                {printTest === 'error' && (
                  <span className="text-xs text-brand-error font-brand">
                    ✕ Unreachable
                  </span>
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
