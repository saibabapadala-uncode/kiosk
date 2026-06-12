// src/modules/settings/tabs/PrintersTab.tsx
// Printer management tab — StarMicronics Bluetooth + LAN/Epson printers.
// Mirrors kiosk_straunt_storefront's printer-settings and bluetooth.service patterns.

import { useState } from 'react';
import { useStarPrinter } from '@/hooks/useStarPrinter';
import type { StarPrinterDevice } from '@/hooks/useStarPrinter';
import { useSettingsStore } from '@/store/settingsStore';
import type { SinglePrinterSettings } from '@/store/settingsStore';
import { SettingsInput, SettingsSelect, ToggleSwitch, SettingsSection, SettingsField } from '../shared';
import { themeColors, themeRGBA } from '@/utils/themeColors';

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPrinter({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function IconBluetooth({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
    </svg>
  );
}

function IconWifi({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill={color} stroke="none" />
    </svg>
  );
}

function IconSearch({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconCheck({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconRefresh({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function IconTrash({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function Spinner({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block', width: size, height: size, borderRadius: '50%',
        border: `2px solid ${color}33`, borderTopColor: color,
        animation: 'spin 0.75s linear infinite',
      }}
    />
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionButton({
  children, onClick, disabled, loading,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary:   { background: 'var(--color-brand-primary)', color: '#fff', borderColor: 'var(--color-brand-primary)' },
    secondary: { background: themeColors.surfaceAlt, color: themeColors.text, borderColor: themeColors.border },
    danger:    { background: themeRGBA('error', 0.08), color: themeColors.error, borderColor: themeRGBA('error', 0.28) },
    success:   { background: themeColors.success, color: '#fff', borderColor: themeColors.success },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="h-9 px-3.5 rounded-lg text-xs font-extrabold font-brand inline-flex items-center justify-center gap-1.5 border transition-all active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
      style={styles[variant]}
    >
      {loading && <Spinner color={variant === 'secondary' || variant === 'danger' ? themeColors.text : '#fff'} />}
      {children}
    </button>
  );
}

function PrinterRow({
  device,
  isDefault,
  onSetDefault,
  onTestPrint,
  onUnpair,
  loading,
  disabled,
}: {
  device: StarPrinterDevice;
  isDefault: boolean;
  onSetDefault: () => void;
  onTestPrint: () => void;
  onUnpair: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <div
      className="rounded-xl p-3.5 flex flex-col gap-3 transition-all"
      style={{
        background: isDefault ? themeRGBA('success', 0.06) : themeColors.surfaceAlt,
        border: `1px solid ${isDefault ? themeRGBA('success', 0.3) : themeColors.border}`,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: isDefault ? themeRGBA('success', 0.12) : themeColors.surface }}>
          {isDefault
            ? <IconCheck size={16} color={themeColors.success} />
            : <IconPrinter size={16} color={themeColors.muted} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-extrabold font-brand truncate" style={{ color: themeColors.text }}>
              {device.name || 'Unknown Printer'}
            </p>
            {isDefault && (
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider"
                style={{ background: themeRGBA('success', 0.14), color: themeColors.success }}>
                Default
              </span>
            )}
            {device.connected && (
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider"
                style={{ background: themeRGBA('primary', 0.12), color: 'var(--color-brand-primary)' }}>
                Connected
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono mt-0.5 truncate" style={{ color: themeColors.muted }}>
            {device.address}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold font-brand"
            style={{
              background: device.bonded ? themeRGBA('primary', 0.1) : themeColors.surface,
              color: device.bonded ? 'var(--color-brand-primary)' : themeColors.muted,
            }}
          >
            {device.bonded ? 'Paired' : 'Unpaired'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isDefault && (
          <ActionButton onClick={onSetDefault} disabled={disabled} loading={false} variant="primary">
            Set as Default
          </ActionButton>
        )}
        <ActionButton onClick={onTestPrint} disabled={disabled} loading={loading} variant="secondary">
          <IconPrinter size={13} />
          Test Print
        </ActionButton>
        <ActionButton onClick={onUnpair} disabled={disabled} loading={false} variant="danger">
          <IconTrash size={12} />
          Unpair
        </ActionButton>
      </div>
    </div>
  );
}

function DiscoveredDeviceRow({
  device,
  onPair,
  onSetDefault,
  loading,
  disabled,
}: {
  device: StarPrinterDevice;
  onPair: () => void;
  onSetDefault: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3 transition-all"
      style={{
        background: device.bonded ? themeRGBA('primary', 0.06) : themeColors.surfaceAlt,
        border: `1px solid ${device.bonded ? themeRGBA('primary', 0.2) : themeColors.border}`,
      }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: themeColors.surface }}>
        <IconBluetooth size={14} color={device.bonded ? 'var(--color-brand-primary)' : themeColors.muted} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold font-brand truncate" style={{ color: themeColors.text }}>
          {device.name}
        </p>
        <p className="text-[11px] font-mono mt-0.5 truncate" style={{ color: themeColors.muted }}>
          {device.address}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold font-brand"
          style={{
            background: device.bonded ? themeRGBA('primary', 0.1) : themeColors.surface,
            color: device.bonded ? 'var(--color-brand-primary)' : themeColors.muted,
          }}
        >
          {device.bonded ? 'Paired' : 'Not paired'}
        </span>

        {device.bonded ? (
          <ActionButton onClick={onSetDefault} disabled={disabled} loading={false} variant="primary">
            Use
          </ActionButton>
        ) : (
          <ActionButton onClick={onPair} disabled={disabled} loading={loading} variant="secondary">
            Pair
          </ActionButton>
        )}
      </div>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export default function PrintersTab() {
  const { printer, setPrinter } = useSettingsStore();
  const [activeRole, setActiveRole] = useState<'customer' | 'kitchen'>('customer');

  const {
    status,
    error,
    scannedDevices,
    pairedDevices,
    connectedDevice,
    bluetoothEnabled,
    isScanning,
    scanDevices,
    loadPairedDevices,
    pairDevice,
    unpairDevice,
    setDefaultPrinter,
    testPrint,
    testPrintLan,
    clearError,
  } = useStarPrinter();

  const [printingAddress, setPrintingAddress] = useState('');
  const [pairingAddress, setPairingAddress] = useState('');

  const isBusy = status === 'scanning' || status === 'pairing' || status === 'printing';

  const currentProfile = printer[activeRole] || {
    connectionType: 'none',
    defaultPrinterName: '',
    defaultPrinterAddress: '',
    lanPrinterIp: '',
    lanPrinterModel: 'TSP143',
  };

  function updateProfile(fields: Partial<SinglePrinterSettings>) {
    setPrinter({
      ...(activeRole === 'customer' ? {
        ...(fields.connectionType !== undefined ? { connectionType: fields.connectionType } : {}),
        ...(fields.defaultPrinterName !== undefined ? { defaultPrinterName: fields.defaultPrinterName } : {}),
        ...(fields.defaultPrinterAddress !== undefined ? { defaultPrinterAddress: fields.defaultPrinterAddress } : {}),
        ...(fields.lanPrinterIp !== undefined ? { lanPrinterIp: fields.lanPrinterIp } : {}),
        ...(fields.lanPrinterModel !== undefined ? { lanPrinterModel: fields.lanPrinterModel } : {}),
      } : {}),
      [activeRole]: {
        ...currentProfile,
        ...fields,
      },
    } as any);
  }

  async function handlePair(device: StarPrinterDevice) {
    setPairingAddress(device.address);
    await pairDevice(device.address);
    setPairingAddress('');
  }

  async function handleSetDefault(device: StarPrinterDevice) {
    setDefaultPrinter(device, activeRole);
  }

  async function handleTestPrint(device: StarPrinterDevice) {
    setPrintingAddress(device.address);
    await testPrint(device);
    setPrintingAddress('');
  }

  async function handleTestPrintLan() {
    await testPrintLan(currentProfile.lanPrinterIp, currentProfile.lanPrinterModel);
  }

  function handleClearLan() {
    updateProfile({
      lanPrinterIp: '',
      lanPrinterModel: 'TSP143',
    });
  }

  async function handleUnpair(device: StarPrinterDevice) {
    if (!window.confirm(`Remove pairing for ${device.name}?`)) return;
    await unpairDevice(device.address);
  }

  const defaultDevice = connectedDevice ?? (pairedDevices.find((d) => d.address === currentProfile.defaultPrinterAddress) ?? null);

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-6">

      {/* Error banner */}
      {error && (
        <div className="rounded-lg px-4 py-3 flex items-start gap-3 shadow-sm"
          style={{ background: themeRGBA('error', 0.08), border: `1px solid ${themeRGBA('error', 0.28)}` }}>
          <div className="flex-1">
            <p className="text-sm font-extrabold font-brand" style={{ color: themeColors.error }}>Printer error</p>
            <p className="text-xs font-brand mt-1" style={{ color: themeColors.muted }}>{error}</p>
          </div>
          <button type="button" onClick={clearError} className="text-lg leading-none cursor-pointer" style={{ color: themeColors.muted }}>×</button>
        </div>
      )}

      {/* Section 1 — Print Behavior Card */}
      <SettingsSection title="Print Behavior">
        <SettingsField
          label="Auto Print After Payment"
          description="Automatically print receipts 1 second after a successful payment completes."
        >
          <ToggleSwitch
            checked={printer.autoPrintAfterPayment !== false}
            onChange={(v) => setPrinter({ autoPrintAfterPayment: v })}
            label="Auto Print After Payment"
          />
        </SettingsField>
        <SettingsField
          label="Print Customer Receipt"
          description="Generate and print receipt copy for the customer."
        >
          <ToggleSwitch
            checked={printer.printCustomerReceipt !== false}
            onChange={(v) => setPrinter({ printCustomerReceipt: v })}
            label="Print Customer Receipt"
          />
        </SettingsField>
        <SettingsField
          label="Print Kitchen Ticket (KOT)"
          description="Generate and print ticket for the kitchen staff."
        >
          <ToggleSwitch
            checked={printer.printKitchenReceipt !== false}
            onChange={(v) => setPrinter({ printKitchenReceipt: v })}
            label="Print Kitchen Ticket"
          />
        </SettingsField>
      </SettingsSection>

      {/* Single Printer Mode info card */}
      {(!printer.kitchen || printer.kitchen.connectionType === 'none') && printer.printKitchenReceipt !== false && (
        <div className="rounded-2xl p-4 border flex items-start gap-3 text-xs font-brand transition-all animate-fade-in shadow-sm"
          style={{
            background: themeRGBA('primary', 0.04),
            borderColor: themeRGBA('primary', 0.24),
            color: themeColors.text
          }}>
          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: themeRGBA('primary', 0.12), color: 'var(--color-brand-primary)' }}>
            ℹ
          </div>
          <div className="space-y-1">
            <p className="font-extrabold" style={{ color: themeColors.text }}>Single Printer Fallback Active</p>
            <p style={{ color: themeColors.muted }}>
              Since Kitchen KOT Printer is disabled, kitchen tickets will print on the Customer Receipt Printer.
            </p>
          </div>
        </div>
      )}

      {/* Role selector / Tabs header */}
      <div className="flex justify-center pt-2">
        <div className="inline-flex rounded-xl p-1" style={{ background: themeColors.surfaceAlt, border: `1px solid ${themeColors.border}` }}>
          <button
            type="button"
            onClick={() => setActiveRole('customer')}
            className="px-6 py-2.5 rounded-lg text-xs font-extrabold font-brand transition-all cursor-pointer select-none flex items-center gap-2 border-0"
            style={{
              background: activeRole === 'customer' ? 'var(--color-brand-primary)' : 'transparent',
              color: activeRole === 'customer' ? '#fff' : themeColors.muted,
              boxShadow: activeRole === 'customer' ? '0 4px 12px rgba(var(--color-brand-primary-rgb), 0.25)' : 'none',
            }}
          >
            Customer Receipt Printer
            <span className="w-1.5 h-1.5 rounded-full"
              style={{
                background: (printer.customer?.connectionType !== 'none') ? '#22c55e' : '#94a3b8'
              }}
            />
          </button>
          <button
            type="button"
            onClick={() => setActiveRole('kitchen')}
            className="px-6 py-2.5 rounded-lg text-xs font-extrabold font-brand transition-all cursor-pointer select-none flex items-center gap-2 border-0"
            style={{
              background: activeRole === 'kitchen' ? 'var(--color-brand-primary)' : 'transparent',
              color: activeRole === 'kitchen' ? '#fff' : themeColors.muted,
              boxShadow: activeRole === 'kitchen' ? '0 4px 12px rgba(var(--color-brand-primary-rgb), 0.25)' : 'none',
            }}
          >
            Kitchen KOT Printer
            <span className="w-1.5 h-1.5 rounded-full"
              style={{
                background: (printer.kitchen?.connectionType !== 'none') ? '#22c55e' : '#94a3b8'
              }}
            />
          </button>
        </div>
      </div>

      {/* Profile status & connection config card */}
      <div className="rounded-2xl p-5 border flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all shadow-sm"
        style={{ background: themeColors.surface, borderColor: themeColors.border }}>
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-extrabold font-brand" style={{ color: themeColors.text }}>
              {activeRole === 'customer' ? 'Customer Receipt Profile' : 'Kitchen Ticket Profile'}
            </h4>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full"
              style={{
                background: currentProfile.connectionType !== 'none' ? themeRGBA('success', 0.12) : themeColors.surfaceAlt,
                color: currentProfile.connectionType !== 'none' ? themeColors.success : themeColors.muted
              }}>
              {currentProfile.connectionType !== 'none' ? 'Active' : 'Not Configured'}
            </span>
            {currentProfile.connectionType !== 'none' && (
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full"
                style={{ background: themeRGBA('primary', 0.1), color: 'var(--color-brand-primary)' }}>
                {currentProfile.connectionType === 'bluetooth' ? 'Bluetooth' : 'LAN / Wi-Fi'}
              </span>
            )}
          </div>
          <p className="text-xs font-brand leading-relaxed" style={{ color: themeColors.muted }}>
            {currentProfile.connectionType === 'none'
              ? 'No printer is assigned to this role. Receipts will not print for this role.'
              : currentProfile.connectionType === 'bluetooth'
                ? currentProfile.defaultPrinterName
                  ? `Assigned: ${currentProfile.defaultPrinterName} (${currentProfile.defaultPrinterAddress})`
                  : 'Selected Bluetooth device: None. Please pair or select a printer below.'
                : `Assigned: ${currentProfile.lanPrinterModel || 'Star'} printer at IP: ${currentProfile.lanPrinterIp || 'N/A'}`}
          </p>
          {printer.lastConnectedAt && currentProfile.connectionType !== 'none' && (
            <p className="text-[10px] font-mono" style={{ color: themeColors.muted }}>
              Last configured: {new Date(printer.lastConnectedAt).toLocaleString()}
            </p>
          )}
        </div>

        <div className="w-full md:w-56 flex-shrink-0">
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: themeColors.muted }}>
            Connection Mode
          </label>
          <SettingsSelect
            value={currentProfile.connectionType || 'none'}
            onChange={(e) => updateProfile({ connectionType: (e.target as HTMLSelectElement).value as any })}
          >
            <option value="none">Disabled</option>
            <option value="bluetooth">Bluetooth (Star BT)</option>
            <option value="lan">LAN / Wi-Fi (Epson/Star)</option>
          </SettingsSelect>
        </div>
      </div>

      {currentProfile.connectionType === 'none' && (
        <div className="rounded-2xl p-8 border text-center space-y-2.5 animate-fade-in"
          style={{ background: themeColors.surface, borderColor: themeColors.border }}>
          <IconPrinter size={36} color={themeColors.muted} />
          <p className="text-sm font-bold font-brand" style={{ color: themeColors.text }}>
            Printer Config Disabled
          </p>
          <p className="text-xs font-brand max-w-sm mx-auto" style={{ color: themeColors.muted }}>
            Choose Bluetooth or LAN / Wi-Fi Connection Mode above to set up a printer for the {activeRole === 'customer' ? 'Customer Receipt' : 'Kitchen KOT'} profile.
          </p>
        </div>
      )}

      {currentProfile.connectionType === 'bluetooth' && (
        <div className="space-y-6 animate-fade-in">
          {!bluetoothEnabled && (
            <div className="rounded-lg px-4 py-3 text-sm font-brand font-semibold"
              style={{ color: themeColors.error, background: themeRGBA('error', 0.08), border: `1px solid ${themeRGBA('error', 0.25)}` }}>
              Bluetooth is turned off. Enable Bluetooth on this device to discover and connect Star printers.
            </div>
          )}

          {/* Selected printer card with animated pulse if connected */}
          {currentProfile.defaultPrinterAddress ? (
            <div className="rounded-2xl p-5 border relative overflow-hidden transition-all shadow-sm"
              style={{
                background: themeRGBA('success', 0.04),
                borderColor: themeRGBA('success', 0.28)
              }}>
              <div className="absolute top-4 right-4 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" style={{ background: themeColors.success }}></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success" style={{ background: themeColors.success }}></span>
                </span>
                <span className="text-[10px] font-bold font-brand uppercase tracking-wider" style={{ color: themeColors.success }}>
                  Active Default
                </span>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: themeColors.muted }}>
                  Selected Bluetooth Printer
                </p>
                <div>
                  <h4 className="text-base font-extrabold font-brand" style={{ color: themeColors.text }}>
                    {currentProfile.defaultPrinterName || 'Configured Printer'}
                  </h4>
                  <p className="text-xs font-mono mt-0.5" style={{ color: themeColors.muted }}>
                    MAC Address: {currentProfile.defaultPrinterAddress}
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <ActionButton
                    onClick={() => {
                      const matchedDevice = pairedDevices.find(d => d.address === currentProfile.defaultPrinterAddress) || {
                        name: currentProfile.defaultPrinterName,
                        address: currentProfile.defaultPrinterAddress,
                        bonded: true,
                        connected: false,
                        isDefault: true
                      };
                      void handleTestPrint(matchedDevice);
                    }}
                    disabled={isBusy}
                    loading={status === 'printing' && printingAddress === currentProfile.defaultPrinterAddress}
                    variant="secondary"
                  >
                    <IconPrinter size={13} />
                    Test Print
                  </ActionButton>

                  <ActionButton
                    onClick={() => {
                      const matchedDevice = pairedDevices.find(d => d.address === currentProfile.defaultPrinterAddress) || {
                        name: currentProfile.defaultPrinterName,
                        address: currentProfile.defaultPrinterAddress,
                        bonded: true,
                        connected: false,
                        isDefault: true
                      };
                      void handleUnpair(matchedDevice);
                    }}
                    disabled={isBusy}
                    variant="danger"
                  >
                    <IconTrash size={12} />
                    Unpair
                  </ActionButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-6 border text-center space-y-2"
              style={{ background: themeColors.surfaceAlt, borderColor: themeColors.border }}>
              <IconPrinter size={28} color={themeColors.muted} />
              <p className="text-sm font-bold font-brand" style={{ color: themeColors.text }}>
                No Bluetooth Printer Selected
              </p>
              <p className="text-xs font-brand max-w-xs mx-auto" style={{ color: themeColors.muted }}>
                Please choose one of the paired printers below, or scan to discover and pair a new one.
              </p>
            </div>
          )}

          {/* Paired printers */}
          <div className="rounded-2xl p-5 space-y-4 border shadow-sm"
            style={{ background: themeColors.surface, borderColor: themeColors.border }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold font-brand flex items-center gap-2" style={{ color: themeColors.text }}>
                  <IconBluetooth size={16} color="var(--color-brand-primary)" />
                  Paired Devices
                </h3>
                <p className="text-xs font-brand mt-0.5" style={{ color: themeColors.muted }}>
                  Bonded Bluetooth printers ready to assign to this role.
                </p>
              </div>
              <ActionButton onClick={() => void loadPairedDevices()} disabled={isBusy} loading={false} variant="secondary">
                <IconRefresh size={12} />
                Refresh
              </ActionButton>
            </div>

            <div className="space-y-2.5">
              {pairedDevices.length === 0 && (
                <div className="rounded-lg py-8 text-center" style={{ background: themeColors.surfaceAlt, border: `1px dashed ${themeColors.border}` }}>
                  <IconPrinter size={28} color={themeColors.muted} />
                  <p className="text-sm font-bold font-brand mt-2" style={{ color: themeColors.text }}>No paired printers</p>
                  <p className="text-xs font-brand mt-1" style={{ color: themeColors.muted }}>
                    Scan to discover and pair a StarMicronics printer.
                  </p>
                </div>
              )}

              {pairedDevices.map((device) => (
                <PrinterRow
                  key={device.address}
                  device={device}
                  isDefault={device.address === currentProfile.defaultPrinterAddress}
                  onSetDefault={() => void handleSetDefault(device)}
                  onTestPrint={() => void handleTestPrint(device)}
                  onUnpair={() => void handleUnpair(device)}
                  loading={status === 'printing' && printingAddress === device.address}
                  disabled={isBusy}
                />
              ))}
            </div>
          </div>

          {/* Scan for Bluetooth printers */}
          <div className="rounded-2xl p-5 space-y-4 border shadow-sm"
            style={{ background: themeColors.surface, borderColor: themeColors.border }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold font-brand flex items-center gap-2" style={{ color: themeColors.text }}>
                  <IconSearch size={15} color="var(--color-brand-primary)" />
                  Discover Printers
                </h3>
                <p className="text-xs font-brand mt-0.5" style={{ color: themeColors.muted }}>
                  Scan for nearby Bluetooth printers. Keep printer powered on and in range.
                </p>
              </div>
              <ActionButton onClick={() => void scanDevices()} disabled={isBusy || !bluetoothEnabled} loading={isScanning} variant="primary">
                <IconSearch size={12} />
                {isScanning ? 'Scanning…' : 'Scan'}
              </ActionButton>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {isScanning && scannedDevices.length === 0 && (
                <div className="rounded-lg py-8 flex flex-col items-center gap-3"
                  style={{ background: themeColors.surfaceAlt, color: themeColors.muted }}>
                  <Spinner size={20} color="var(--color-brand-primary)" />
                  <span className="text-sm font-brand font-medium">Searching for printers…</span>
                </div>
              )}

              {!isScanning && scannedDevices.length === 0 && (
                <div className="rounded-lg py-6 text-center"
                  style={{ background: themeColors.surfaceAlt, border: `1px dashed ${themeColors.border}` }}>
                  <p className="text-sm font-bold font-brand" style={{ color: themeColors.text }}>No printers found</p>
                  <p className="text-xs font-brand mt-1" style={{ color: themeColors.muted }}>
                    Tap Scan with the printer powered on and in Bluetooth range.
                  </p>
                </div>
              )}

              {scannedDevices.map((device) => (
                <DiscoveredDeviceRow
                  key={device.address}
                  device={device}
                  onPair={() => void handlePair(device)}
                  onSetDefault={() => void handleSetDefault(device)}
                  loading={pairingAddress === device.address}
                  disabled={isBusy}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {currentProfile.connectionType === 'lan' && (
        <div className="space-y-6 animate-fade-in">
          {/* LAN / Epson printer */}
          <div className="rounded-2xl p-5 space-y-4 border shadow-sm"
            style={{ background: themeColors.surface, borderColor: themeColors.border }}>
            <div>
              <h3 className="text-base font-bold font-brand flex items-center gap-2" style={{ color: themeColors.text }}>
                <IconWifi size={15} color="var(--color-brand-primary)" />
                LAN / Wi-Fi Printer ({activeRole === 'customer' ? 'Customer' : 'Kitchen'})
              </h3>
              <p className="text-xs font-brand mt-0.5" style={{ color: themeColors.muted }}>
                Epson TM-series or any ESC/POS printer with a Wi-Fi / Ethernet connection.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: themeColors.muted }}>
                  Printer IP Address
                </label>
                <SettingsInput
                  value={currentProfile.lanPrinterIp || ''}
                  onChange={(e) => updateProfile({ lanPrinterIp: (e.target as HTMLInputElement).value.trim() })}
                  placeholder="192.168.1.100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: themeColors.muted }}>
                  Printer Model
                </label>
                <SettingsSelect
                  value={currentProfile.lanPrinterModel || 'TSP143'}
                  onChange={(e) => updateProfile({ lanPrinterModel: (e.target as HTMLSelectElement).value })}
                >
                  <option value="TSP143">Star TSP143III LAN (Star commands)</option>
                  <option value="Epson">Epson TM-series / ESC/POS (Epson/ESC-POS)</option>
                  <option value="SP700">Star SP700 (Dot Impact)</option>
                </SettingsSelect>
              </div>

              <div className="flex gap-2 flex-wrap pt-1">
                <ActionButton
                  onClick={() => void handleTestPrintLan()}
                  disabled={isBusy || !(currentProfile.lanPrinterIp || '').trim()}
                  loading={status === 'printing' && !printingAddress}
                  variant="secondary"
                >
                  <IconPrinter size={13} />
                  Test LAN Printer
                </ActionButton>

                <ActionButton
                  onClick={handleClearLan}
                  disabled={isBusy}
                  variant="danger"
                >
                  <IconTrash size={12} />
                  Clear Configuration
                </ActionButton>
              </div>
            </div>
          </div>

          {/* Supported models reference */}
          <div className="rounded-2xl p-4 border" style={{ background: themeColors.surface, borderColor: themeColors.border }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: themeColors.muted }}>
              Supported Printer Models
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                ['Bluetooth', 'Star TSP143IIIU'],
                ['Bluetooth', 'Star mPOP / mC-Print'],
                ['Bluetooth', 'Star SP700'],
                ['LAN/Wi-Fi', 'Star TSP143III LAN'],
                ['LAN/Wi-Fi', 'Epson TM-T88'],
                ['LAN/Wi-Fi', 'Epson TM-M30III'],
              ].map(([type, name]) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider flex-shrink-0"
                    style={{ background: themeColors.surfaceAlt, color: themeColors.muted }}>
                    {type}
                  </span>
                  <span className="text-xs font-brand truncate" style={{ color: themeColors.text }}>{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
