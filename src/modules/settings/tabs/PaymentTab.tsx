import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useReaderConnection } from '@/hooks/useReaderConnection';
import { useReaderStatus } from '@/hooks/useReaderStatus';
import { useSettingsStore } from '@/store/settingsStore';
import { usePaymentStore } from '@/store/paymentStore';
import { StripeTerminalNative } from '@/plugins/stripe-terminal';
import type { BluetoothDevice } from '@/plugins/stripe-terminal';
import type { TerminalErrorCode, TerminalReader } from '@/services/stripe/types';
import { MaskedInput, SettingsInput, ToggleSwitch } from '../shared';
import { themeColors, themeRGBA } from '@/utils/themeColors';
import { BrandContext } from '@/providers/BrandProvider';

function IconBluetooth({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
    </svg>
  );
}

function IconReader({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <circle cx="7" cy="15" r="1" fill={color} stroke="none" />
      <circle cx="11" cy="15" r="1" fill={color} stroke="none" />
    </svg>
  );
}

function IconRefresh({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function IconSearch({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconCheck({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconWarning({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function Spinner({ size = 14, color = 'white' }: { size?: number; color?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${color}33`,
        borderTopColor: color,
        animation: 'spin 0.75s linear infinite',
      }}
    />
  );
}

function batteryLabel(level?: number): string {
  if (level === undefined) return 'Unknown';
  return `${Math.round(level * 100)}%`;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Never';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return 'Off';
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.max(0, seconds) % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function readerTitle(reader: TerminalReader): string {
  return reader.label || `Reader ${reader.serialNumber.slice(-6)}`;
}

function normalizeSerial(value: string): string {
  return value.trim().toUpperCase();
}

function mergeBluetoothDevices(current: BluetoothDevice[], incoming: BluetoothDevice[]): BluetoothDevice[] {
  const byAddress = new Map<string, BluetoothDevice>();
  for (const device of current) byAddress.set(device.address, device);
  for (const device of incoming) byAddress.set(device.address, device);
  return Array.from(byAddress.values()).sort((a, b) => {
    if (a.bonded !== b.bonded) return a.bonded ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function isStripeReader(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('stripe') || n.includes('reader') || n.includes('m2') || n.includes('bbpos') || n.includes('wisepad') || n.includes('chipper') || n.includes('strm');
}

function isPrinter(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('star') || n.includes('tsp') || n.includes('epson') || n.includes('tm-') || n.includes('printer') || n.includes('mprint') || n.includes('woosim') || n.includes('bixolon') || n.includes('sewoo') || n.includes('citizen');
}

function getDeviceTypeLabel(name: string): string {
  if (isStripeReader(name)) return 'Stripe Reader';
  if (isPrinter(name)) return 'Printer';
  return 'Bluetooth Device';
}

function deviceLooksLikeReader(device: BluetoothDevice): boolean {
  return isStripeReader(device.name);
}

const ERROR_TITLES: Partial<Record<TerminalErrorCode, string>> = {
  BLUETOOTH_DISABLED: 'Bluetooth is turned off',
  BLUETOOTH_PERMISSION_DENIED: 'Bluetooth permission is required',
  LOCATION_PERMISSION_DENIED: 'Location permission is required',
  NETWORK_ERROR: 'Network connection failed',
  READER_NOT_FOUND: 'No reader found',
  READER_OFFLINE: 'Reader is offline',
  ALREADY_CONNECTED: 'Reader already connected',
  TIMEOUT: 'Connection timed out',
  TERMINAL_NOT_INITIALIZED: 'Stripe Terminal is not ready',
};

function ActionButton({
  children,
  onClick,
  disabled,
  loading,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--color-brand-primary)', color: '#fff', borderColor: 'var(--color-brand-primary)' },
    secondary: { background: themeColors.surfaceAlt, color: themeColors.text, borderColor: themeColors.border },
    danger: { background: themeRGBA('error', 0.08), color: themeColors.error, borderColor: themeRGBA('error', 0.28) },
    success: { background: themeColors.success, color: '#fff', borderColor: themeColors.success },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="h-10 px-4 rounded-lg text-sm font-brand inline-flex items-center justify-center gap-2 border transition-all active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer font-extrabold"
      style={styles[variant]}
    >
      {loading && <Spinner color={variant === 'secondary' || variant === 'danger' ? themeColors.text : '#fff'} />}
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: 'online' | 'offline' | 'unknown' }) {
  const color = status === 'online' ? themeColors.success : status === 'offline' ? themeColors.error : themeColors.muted;
  const label = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Unknown';
  return (
    <span
      className="px-2.5 py-1 rounded-full text-xs font-bold font-brand inline-flex items-center gap-1.5"
      style={{ background: status === 'online' ? themeRGBA('success', 0.12) : themeColors.surfaceAlt, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function ReaderDetail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold font-brand uppercase tracking-wider" style={{ color: themeColors.muted }}>{label}</p>
      <p className={`mt-1 text-sm truncate ${mono ? 'font-mono' : 'font-brand font-semibold'}`} style={{ color: themeColors.text }}>
        {value}
      </p>
    </div>
  );
}

function ErrorBanner({
  code,
  message,
  onRetry,
  onDismiss,
}: {
  code: TerminalErrorCode;
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const title = ERROR_TITLES[code] ?? 'Reader connection failed';
  return (
    <div className="rounded-lg p-4 flex items-start gap-3 shadow-sm" style={{ background: themeRGBA('error', 0.08), border: `1px solid ${themeRGBA('error', 0.28)}` }}>
      <IconWarning size={18} color={themeColors.error} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold font-brand" style={{ color: themeColors.error }}>{title}</p>
        <p className="text-xs font-brand mt-1 leading-relaxed" style={{ color: themeColors.muted }}>{message}</p>
      </div>
      <button type="button" onClick={onRetry} className="text-xs font-bold font-brand hover:underline cursor-pointer" style={{ color: themeColors.error }}>
        Retry
      </button>
      <button type="button" onClick={onDismiss} className="text-lg leading-none cursor-pointer" style={{ color: themeColors.muted }} aria-label="Dismiss">
        x
      </button>
    </div>
  );
}

function ReaderRow({
  reader,
  connected,
  selected,
  disabled,
  connecting,
  onConnect,
}: {
  reader: TerminalReader;
  connected: boolean;
  selected: boolean;
  disabled: boolean;
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <div
      className="rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center gap-3 transition-all"
      style={{
        background: connected ? themeRGBA('success', 0.08) : selected ? themeRGBA('primary', 0.07) : themeColors.surfaceAlt,
        border: `1px solid ${connected ? themeRGBA('success', 0.28) : selected ? 'var(--color-brand-primary)' : themeColors.border}`,
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: themeColors.surface }}>
          {connected ? <IconCheck color={themeColors.success} size={16} /> : <IconReader color={themeColors.muted} size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold font-brand truncate" style={{ color: themeColors.text }}>{readerTitle(reader)}</p>
          <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: themeColors.muted }}>{reader.serialNumber}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:w-72">
        <ReaderDetail label="Status" value={connected ? 'Connected' : reader.status} />
        <ReaderDetail label="Battery" value={batteryLabel(reader.batteryLevel)} />
        <div className="flex justify-end items-center">
          {connected ? (
            <StatusPill status="online" />
          ) : (
            <ActionButton onClick={onConnect} disabled={disabled} loading={connecting} variant="primary">
              Connect
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

function BluetoothDeviceRow({
  device,
  selected,
  loading,
  disabled,
  onUse,
  connectedReader,
}: {
  device: BluetoothDevice;
  selected: boolean;
  loading: boolean;
  disabled: boolean;
  onUse: () => void;
  connectedReader: TerminalReader | null;
}) {
  const isReader = isStripeReader(device.name);
  const isPrint = isPrinter(device.name);
  const typeLabel = getDeviceTypeLabel(device.name);

  // Check if this specific device is the currently connected reader
  const isConnected = !!(selected && connectedReader && (
    connectedReader.serialNumber === device.name ||
    connectedReader.serialNumber === device.address ||
    device.name.includes(connectedReader.serialNumber) ||
    connectedReader.serialNumber.includes(device.name)
  ));

  return (
    <div
      className="rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-all"
      style={{
        background: isConnected ? themeRGBA('success', 0.08) : selected ? themeRGBA('primary', 0.07) : themeColors.surfaceAlt,
        border: `1px solid ${isConnected ? themeRGBA('success', 0.28) : selected ? 'var(--color-brand-primary)' : themeColors.border}`,
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: themeColors.surface }}>
          {isConnected ? (
            <IconCheck color={themeColors.success} size={16} />
          ) : isReader ? (
            <IconReader color="var(--color-brand-primary)" size={16} />
          ) : isPrint ? (
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={themeColors.muted} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
          ) : (
            <IconBluetooth color={themeColors.muted} size={16} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-extrabold font-brand truncate" style={{ color: themeColors.text }}>
              {device.name || 'Unknown device'}
            </p>
            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider" style={{ background: themeColors.surface, color: themeColors.muted }}>
              {typeLabel}
            </span>
          </div>
          <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: themeColors.muted }}>
            {device.address} {isConnected && connectedReader?.batteryLevel !== undefined && `• Battery: ${batteryLabel(connectedReader.batteryLevel)}`}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-3">
        <span
          className="px-2.5 py-0.5 rounded-full text-xs font-bold font-brand"
          style={{
            background: isConnected ? themeRGBA('success', 0.12) : device.bonded ? themeRGBA('primary', 0.1) : themeColors.surface,
            color: isConnected ? themeColors.success : device.bonded ? 'var(--color-brand-primary)' : themeColors.muted,
          }}
        >
          {isConnected ? 'Connected' : device.bonded ? 'Paired' : 'Not paired'}
        </span>
        {!isConnected && (
          <ActionButton onClick={onUse} disabled={disabled} loading={loading} variant={device.bonded ? 'primary' : 'secondary'}>
            {device.bonded ? 'Connect' : 'Pair & Connect'}
          </ActionButton>
        )}
      </div>
    </div>
  );
}

export default function PaymentTab() {
  const { payment, setPayment } = useSettingsStore();
  const {
    status,
    connectedReader,
    discoveredReaders,
    connectionError,
    reconnectAttempts,
    sessionSecondsLeft,
    isRefreshing,
    initialize,
    discover,
    connect,
    disconnect,
    reconnect,
    refresh,
    resetSessionTimer,
    clearError,
  } = useReaderConnection();
  const { health } = useReaderStatus();
  const isAutoReconnecting = usePaymentStore((s) => s.readerReconnecting);

  const brandEnv = useContext(BrandContext)?.environment;
  const terminalLocations = brandEnv?.stripeTerminalLocations ?? [];

  const [manualSerial, setManualSerial] = useState(payment.readerSerialNumber);
  const [selectedSerial, setSelectedSerial] = useState('');
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDevice[]>([]);
  const [selectedBluetoothAddress, setSelectedBluetoothAddress] = useState('');
  const [isScanningBluetooth, setIsScanningBluetooth] = useState(false);
  const [isPairingBluetooth, setIsPairingBluetooth] = useState(false);
  const [localError, setLocalError] = useState('');
  // 'custom' when user wants to type a location ID not in the preset list
  const [useCustomLocation, setUseCustomLocation] = useState(
    () => !terminalLocations.some((loc) => loc.id === payment.terminalLocationId),
  );

  const isInitializing = status === 'initializing';
  const isDiscovering = status === 'discovering';
  const isConnecting = status === 'connecting' || status === 'reconnecting' || isAutoReconnecting;
  const isDisconnecting = status === 'disconnecting';
  const isBusy = isInitializing || isDiscovering || isConnecting || isDisconnecting;

  const readers = useMemo(() => {
    const list = [...discoveredReaders];
    if (connectedReader && !list.some((reader) => reader.serialNumber === connectedReader.serialNumber)) {
      list.unshift(connectedReader);
    }
    return list;
  }, [connectedReader, discoveredReaders]);

  // Remove mock/simulator readers from list
  const filteredReaders = useMemo(() => {
    return readers.filter(r => !r.simulated && !r.serialNumber.includes('SIM') && !r.label.toLowerCase().includes('simulator'));
  }, [readers]);

  // Filter nearby Bluetooth devices to only Stripe Readers & Printers, prioritize paired and previously connected
  const filteredBluetoothDevices = useMemo(() => {
    const isSupportedDevice = (device: BluetoothDevice): boolean => {
      const name = device.name || '';
      if (!name) return false;
      // Exclude mock/simulator devices
      if (name.toLowerCase().includes('simulator') || name.toLowerCase().includes('simulated') || device.address === '00:11:22:33:44:55') {
        return false;
      }
      return isStripeReader(name) || isPrinter(name);
    };

    return bluetoothDevices
      .filter(isSupportedDevice)
      .sort((a, b) => {
        // 1. Prioritize previously connected device
        const aPrev = a.name === payment.readerSerialNumber || a.address === payment.readerSerialNumber;
        const bPrev = b.name === payment.readerSerialNumber || b.address === payment.readerSerialNumber;
        if (aPrev && !bPrev) return -1;
        if (!aPrev && bPrev) return 1;

        // 2. Prioritize paired (bonded) devices
        if (a.bonded && !b.bonded) return -1;
        if (!a.bonded && b.bonded) return 1;

        // 3. Alphabetical by name
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [bluetoothDevices, payment.readerSerialNumber]);

  useEffect(() => {
    let devicesListener: { remove(): Promise<void> } | null = null;
    let pairingListener: { remove(): Promise<void> } | null = null;

    async function setupBluetoothDeviceListeners() {
      try {
        devicesListener = await StripeTerminalNative.addListener('bluetoothDevicesUpdated', ({ devices }) => {
          setBluetoothDevices((existing) => mergeBluetoothDevices(existing, devices));
          setIsScanningBluetooth(false);
        });
        pairingListener = await StripeTerminalNative.addListener('bluetoothPairingStatus', ({ status, device }) => {
          setBluetoothDevices((existing) => mergeBluetoothDevices(existing, [device]));
          if (status !== 'pairing') setIsPairingBluetooth(false);
        });
        const { devices } = await StripeTerminalNative.listBluetoothDevices();
        setBluetoothDevices(devices);
      } catch {
        // The web fallback and older native builds may not expose generic Bluetooth listing.
      }
    }

    void setupBluetoothDeviceListeners();
    return () => {
      void devicesListener?.remove();
      void pairingListener?.remove();
    };
  }, []);

  const connectionLabel = useMemo(() => {
    if (isAutoReconnecting) return 'Reconnecting...';
    if (!connectedReader) return 'Not connected';
    if (status === 'reconnecting' || health === 'reconnecting') return `Reconnecting (${reconnectAttempts}/3)`;
    if (health === 'disconnected') return 'Disconnected';
    return 'Connected';
  }, [connectedReader, health, isAutoReconnecting, reconnectAttempts, status]);

  const requireLocation = useCallback(() => {
    if (!payment.terminalLocationId.trim()) {
      setLocalError('Enter the Stripe Terminal location ID before connecting a Bluetooth reader.');
      return false;
    }
    return true;
  }, [payment.terminalLocationId]);

  const handleSearch = useCallback(async () => {
    setLocalError('');
    setSelectedSerial('');
    clearError();
    setPayment({ connectionMethod: 'bluetooth' });
    setIsScanningBluetooth(true);
    void StripeTerminalNative.scanBluetoothDevices()
      .then(({ devices }) => setBluetoothDevices((existing) => mergeBluetoothDevices(existing, devices)))
      .catch(() => undefined)
      .finally(() => setIsScanningBluetooth(false));
    await initialize();
    await discover();
  }, [clearError, discover, initialize, setPayment]);

  const handleConnect = useCallback(async (serialNumber: string) => {
    if (!requireLocation()) return;
    const serial = normalizeSerial(serialNumber);
    setLocalError('');
    setSelectedSerial(serial);
    clearError();
    setPayment({ readerSerialNumber: serial, connectionMethod: 'bluetooth' });
    await connect(serial);
  }, [clearError, connect, requireLocation, setPayment]);

  const handleManualConnect = useCallback(async () => {
    if (!requireLocation()) return;
    const serial = normalizeSerial(manualSerial);
    if (!serial) {
      setLocalError('Enter the reader serial number or search for nearby readers.');
      return;
    }
    setLocalError('');
    setSelectedSerial(serial);
    clearError();
    setPayment({ readerSerialNumber: serial, connectionMethod: 'bluetooth' });
    await initialize();
    await connect(serial);
  }, [clearError, connect, initialize, manualSerial, requireLocation, setPayment]);

  const handleScanBluetooth = useCallback(async () => {
    setLocalError('');
    setIsScanningBluetooth(true);
    try {
      const { devices } = await StripeTerminalNative.scanBluetoothDevices();
      setBluetoothDevices((existing) => mergeBluetoothDevices(existing, devices));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not scan Bluetooth devices.';
      setLocalError(message);
    } finally {
      setIsScanningBluetooth(false);
    }
  }, []);

  const handleUseBluetoothDevice = useCallback(async (device: BluetoothDevice) => {
    const isPrint = isPrinter(device.name);
    if (isPrint) {
      const ok = window.confirm(
        `${device.bonded ? 'Use' : 'Pair'} ${device.name || device.address} as receipt printer?`
      );
      if (!ok) return;

      setLocalError('');
      setSelectedBluetoothAddress(device.address);
      setIsPairingBluetooth(true);

      try {
        if (!device.bonded) {
          await StripeTerminalNative.pairBluetoothDevice({ address: device.address });
        }
        // Save to localStorage under 'printer' (key used by Capacitor/POS system)
        localStorage.setItem('printer', JSON.stringify({ name: device.name, address: device.address }));
        alert(`Successfully paired and set printer: ${device.name}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not pair or use this printer.';
        setLocalError(message);
      } finally {
        setIsPairingBluetooth(false);
      }
      return;
    }

    const ok = window.confirm(
      `${device.bonded ? 'Use' : 'Pair'} ${device.name || device.address} for Stripe reader setup?\n\nAndroid may show a Bluetooth pairing confirmation. After pairing, the app will search for the Stripe reader and connect when it appears.`,
    );
    if (!ok) return;

    setLocalError('');
    setSelectedBluetoothAddress(device.address);
    setIsPairingBluetooth(true);
    clearError();

    try {
      if (!device.bonded) {
        await StripeTerminalNative.pairBluetoothDevice({ address: device.address });
      }

      setPayment({ connectionMethod: 'bluetooth' });
      await initialize();
      const foundReaders = await discover();

      const matchingReader = foundReaders.find((reader) => {
        const name = device.name.toLowerCase();
        return reader.serialNumber === normalizeSerial(device.name) ||
          reader.label.toLowerCase() === name ||
          reader.label.toLowerCase().includes(name) ||
          name.includes(reader.serialNumber.toLowerCase());
      });

      if (matchingReader) {
        await handleConnect(matchingReader.serialNumber);
      } else if (isStripeReader(device.name)) {
        setLocalError('Device paired. Stripe discovery is running; select the matching reader below when it appears, or enter the reader serial manually.');
      } else {
        setLocalError('This Bluetooth device is paired, but it was not identified as a Stripe reader. Select a Stripe reader from the reader list or enter its serial number.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not pair or use this Bluetooth device.';
      setLocalError(message);
    } finally {
      setIsPairingBluetooth(false);
    }
  }, [clearError, discover, handleConnect, initialize, setPayment]);

  const handleDisconnect = useCallback(async () => {
    setLocalError('');
    clearError();
    await disconnect();
  }, [clearError, disconnect]);

  // Manual reconnect bypasses the auto-reconnect retry counter (which caps at 3 for event-driven
  // reconnects). Call initialize() + connect() directly so the user can always trigger a reconnect.
  const handleReconnect = useCallback(async () => {
    if (!requireLocation()) return;
    setLocalError('');
    clearError();
    await initialize();
    await connect(payment.readerSerialNumber || undefined);
  }, [clearError, connect, initialize, payment.readerSerialNumber, requireLocation]);

  const handleRefresh = useCallback(async () => {
    setLocalError('');
    clearError();
    resetSessionTimer();
    await refresh();
  }, [clearError, refresh, resetSessionTimer]);

  return (
    <div className="p-5 max-w-6xl mx-auto space-y-6">
      {connectedReader && (
        <div className="flex justify-end">
          <StatusPill status="online" />
        </div>
      )}

      {connectionError && (
        <ErrorBanner
          code={connectionError.code}
          message={connectionError.message}
          onRetry={() => void handleSearch()}
          onDismiss={clearError}
        />
      )}

      {localError && (
        <div className="rounded-lg px-4 py-3 text-sm font-brand font-semibold shadow-sm" style={{ color: themeColors.error, background: themeRGBA('error', 0.08), border: `1px solid ${themeRGBA('error', 0.25)}` }}>
          {localError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Status & Configuration Cards */}
        <div className="space-y-6">
          {/* Card 1: Reader Connection & Actions */}
          <div className="rounded-xl p-5 space-y-5 shadow-sm border transition-all" style={{ background: themeColors.surface, borderColor: themeColors.border }}>
            <h3 className="text-lg font-bold font-brand tracking-tight flex items-center gap-2" style={{ color: themeColors.text }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: connectedReader ? themeColors.success : themeColors.muted }} />
              Connection Status
            </h3>

            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: themeColors.surfaceAlt }}>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: connectedReader ? themeRGBA('success', 0.12) : themeColors.surface }}>
                {connectedReader ? <IconCheck size={22} color={themeColors.success} /> : <IconBluetooth size={22} color={themeColors.muted} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: themeColors.muted }}>Connected Device</p>
                <p className="text-base font-extrabold truncate mt-0.5" style={{ color: themeColors.text }}>
                  {connectedReader ? readerTitle(connectedReader) : 'No reader connected'}
                </p>
                <p className="text-xs font-semibold mt-0.5" style={{ color: themeColors.muted }}>
                  Status: {connectionLabel}
                </p>
              </div>
            </div>

            {connectedReader && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: themeColors.border }}>
                <ReaderDetail label="Name" value={readerTitle(connectedReader)} />
                <ReaderDetail label="Serial" value={connectedReader.serialNumber} mono />
                <ReaderDetail label="Battery" value={batteryLabel(connectedReader.batteryLevel)} />
                <ReaderDetail label="Last Connected" value={formatRelativeTime(payment.lastConnectedAt)} />
              </div>
            )}

            {sessionSecondsLeft !== null && connectedReader && (
              <p className="text-xs font-brand font-medium" style={{ color: themeColors.muted }}>
                Idle Timeout: {formatSeconds(sessionSecondsLeft)} remaining
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <ActionButton onClick={() => void handleRefresh()} disabled={!connectedReader || isConnecting} loading={isRefreshing} variant="secondary">
                <IconRefresh size={14} />
                Refresh
              </ActionButton>
              <ActionButton onClick={() => void handleReconnect()} disabled={!payment.readerSerialNumber || isBusy} loading={status === 'reconnecting'} variant="primary">
                Reconnect
              </ActionButton>
              <ActionButton onClick={() => void handleDisconnect()} disabled={!connectedReader || isDisconnecting} loading={isDisconnecting} variant="danger">
                Disconnect
              </ActionButton>
            </div>
          </div>

          {/* Card 2: Configuration & Credentials */}
          <div className="rounded-xl p-5 space-y-5 shadow-sm border" style={{ background: themeColors.surface, borderColor: themeColors.border }}>
            <h3 className="text-lg font-bold font-brand tracking-tight" style={{ color: themeColors.text }}>
              Credentials & Behavior
            </h3>

            {/* Account Key */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: themeColors.muted }}>
                Stripe Account Key
              </label>
              <MaskedInput
                value={payment.stripePublishableKey}
                onChange={(value) => setPayment({ stripePublishableKey: value })}
                placeholder="pk_live_..."
              />
            </div>

            {/* Location ID */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: themeColors.muted }}>
                  Location ID
                </label>
                {terminalLocations.length > 0 && (
                  <button
                    type="button"
                    className="text-xs font-extrabold font-brand hover:underline cursor-pointer"
                    style={{ color: 'var(--color-brand-primary)' }}
                    onClick={() => {
                      setUseCustomLocation((prev) => !prev);
                      if (useCustomLocation) {
                        const match = terminalLocations.find((loc) => loc.id === payment.terminalLocationId);
                        if (!match) setPayment({ terminalLocationId: terminalLocations[0]?.id ?? '' });
                      }
                    }}
                  >
                    {useCustomLocation ? 'Use preset' : 'Enter custom ID'}
                  </button>
                )}
              </div>

              {terminalLocations.length > 0 && !useCustomLocation ? (
                <div className="grid gap-2">
                  {terminalLocations.map((loc) => {
                    const active = payment.terminalLocationId === loc.id;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => { setLocalError(''); setPayment({ terminalLocationId: loc.id }); }}
                        className="w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-all border font-brand cursor-pointer"
                        style={{
                          background: active ? 'var(--color-brand-primary)' : themeColors.surfaceAlt,
                          borderColor: active ? 'var(--color-brand-primary)' : themeColors.border,
                          color: active ? '#fff' : themeColors.text,
                        }}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-2 flex-shrink-0 flex items-center justify-center"
                          style={{ borderColor: active ? '#fff' : themeColors.muted, background: active ? '#fff' : 'transparent' }}
                        >
                          {active && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-brand-primary)' }} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-extrabold">{loc.label}</span>
                          <span className="block text-xs font-mono mt-0.5 opacity-75">{loc.id}</span>
                        </span>
                        {active && <IconCheck size={16} color="#fff" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <SettingsInput
                  value={payment.terminalLocationId}
                  onChange={(event) => {
                    setLocalError('');
                    setPayment({ terminalLocationId: (event.target as HTMLInputElement).value.trim() });
                  }}
                  placeholder="tml_xxxxxxxxxxxx"
                />
              )}
            </div>

            {/* Uncode Payment Credentials — used in connection-token payload */}
            <div className="pt-2 pb-1 border-t" style={{ borderColor: themeColors.border }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: themeColors.muted }}>
                Uncode Payment Credentials
              </p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: themeColors.muted }}>
                    Pay Key
                  </label>
                  <MaskedInput
                    value={payment.stripePayKey}
                    onChange={(value) => setPayment({ stripePayKey: value })}
                    placeholder="pay-stripe_connect-platform-..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: themeColors.muted }}>
                      Merchant ID
                    </label>
                    <SettingsInput
                      value={payment.merchantId}
                      onChange={(e) => setPayment({ merchantId: (e.target as HTMLInputElement).value.trim() })}
                      placeholder="1730696885097107"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: themeColors.muted }}>
                      Store ID
                    </label>
                    <SettingsInput
                      value={payment.storeId}
                      onChange={(e) => setPayment({ storeId: (e.target as HTMLInputElement).value.trim() })}
                      placeholder="3866643410719961"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: themeColors.muted }}>
                    Environment
                  </label>
                  <div className="flex gap-2">
                    {(['qa', 'prod'] as const).map((env) => (
                      <button
                        key={env}
                        type="button"
                        onClick={() => setPayment({ envType: env })}
                        className="flex-1 rounded-lg px-4 py-2 text-sm font-bold font-brand border transition-all cursor-pointer"
                        style={{
                          background: payment.envType === env ? 'var(--color-brand-primary)' : themeColors.surfaceAlt,
                          borderColor: payment.envType === env ? 'var(--color-brand-primary)' : themeColors.border,
                          color: payment.envType === env ? '#fff' : themeColors.text,
                        }}
                      >
                        {env === 'qa' ? 'QA / Test' : 'Production'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Auto Reconnect */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <div>
                <p className="text-sm font-bold font-brand" style={{ color: themeColors.text }}>Reconnect automatically</p>
                <p className="text-xs font-brand mt-0.5" style={{ color: themeColors.muted }}>Restore connection if reader drops.</p>
              </div>
              <ToggleSwitch checked={payment.autoReconnect} onChange={(value) => setPayment({ autoReconnect: value })} label="Reconnect automatically" />
            </div>

            {/* Timeout Slider */}
            <div className="pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: themeColors.muted }}>
                Idle disconnect timer: {payment.sessionTimeoutMinutes === 0 ? 'Off' : `${payment.sessionTimeoutMinutes} minutes`}
              </label>
              <input
                type="range"
                min={0}
                max={120}
                step={5}
                value={payment.sessionTimeoutMinutes}
                onChange={(event) => setPayment({ sessionTimeoutMinutes: Number((event.target as HTMLInputElement).value) })}
                className="w-full accent-[var(--color-brand-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Bluetooth Scan & Readers Card */}
        <div className="space-y-6">
          {/* Card 3: Bluetooth Scan & Readers */}
          <div className="rounded-xl p-5 space-y-5 shadow-sm border flex flex-col h-full" style={{ background: themeColors.surface, borderColor: themeColors.border }}>
            <div className="flex items-center justify-between gap-3 pb-2 border-b" style={{ borderColor: themeColors.border }}>
              <div>
                <h3 className="text-lg font-bold font-brand tracking-tight" style={{ color: themeColors.text }}>
                  Bluetooth & Nearby Devices
                </h3>
                <p className="text-xs font-brand mt-0.5" style={{ color: themeColors.muted }}>
                  Pair or connect M2 readers and print devices.
                </p>
              </div>
              <ActionButton onClick={() => void handleScanBluetooth()} disabled={isBusy || isScanningBluetooth} loading={isScanningBluetooth} variant="secondary">
                <IconSearch size={14} />
                {isScanningBluetooth ? 'Scanning...' : 'Scan'}
              </ActionButton>
            </div>

            {/* Discovered / Bonded Bluetooth Devices List */}
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[420px] pr-1">
              {isScanningBluetooth && filteredBluetoothDevices.length === 0 && (
                <div className="rounded-lg py-8 flex flex-col items-center justify-center gap-3" style={{ background: themeColors.surfaceAlt, color: themeColors.muted }}>
                  <Spinner size={20} color="var(--color-brand-primary)" />
                  <span className="text-sm font-medium font-brand">Searching for hardware...</span>
                </div>
              )}

              {!isScanningBluetooth && filteredBluetoothDevices.length === 0 && (
                <div className="rounded-lg py-8 text-center" style={{ background: themeColors.surfaceAlt, border: `1px dashed ${themeColors.border}` }}>
                  <p className="text-sm font-bold font-brand" style={{ color: themeColors.text }}>No supported hardware found</p>
                  <p className="text-xs font-brand mt-1" style={{ color: themeColors.muted }}>
                    Ensure your Stripe Reader M2 or printer is on and in pairing mode.
                  </p>
                </div>
              )}

              {filteredBluetoothDevices.map((device) => {
                const isConnected = !!(connectedReader && (
                  connectedReader.serialNumber === device.name || 
                  connectedReader.serialNumber === device.address || 
                  device.name.includes(connectedReader.serialNumber) ||
                  connectedReader.serialNumber.includes(device.name)
                ));
                return (
                  <BluetoothDeviceRow
                    key={device.address}
                    device={device}
                    selected={selectedBluetoothAddress === device.address || isConnected}
                    loading={(isPairingBluetooth || isDiscovering || isConnecting) && selectedBluetoothAddress === device.address}
                    disabled={isBusy || isPairingBluetooth}
                    onUse={() => void handleUseBluetoothDevice(device)}
                    connectedReader={connectedReader}
                  />
                );
              })}
            </div>

            {/* Stripe SDK Reader Discovery List (connected/discovered via Stripe Terminal SDK) */}
            <div className="space-y-3 pt-4 border-t" style={{ borderColor: themeColors.border }}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-extrabold uppercase tracking-wider" style={{ color: themeColors.muted }}>
                  Stripe Terminal SDK Readers
                </p>
                <button
                  type="button"
                  onClick={() => void handleSearch()}
                  disabled={isBusy}
                  className="text-xs font-bold font-brand inline-flex items-center gap-1 hover:underline cursor-pointer"
                  style={{ color: 'var(--color-brand-primary)' }}
                >
                  <IconRefresh size={12} />
                  Discover
                </button>
              </div>

              {isDiscovering && filteredReaders.length === 0 && (
                <div className="rounded-lg py-6 flex items-center justify-center gap-3" style={{ background: themeColors.surfaceAlt, color: themeColors.muted }}>
                  <Spinner size={16} color="var(--color-brand-primary)" />
                  <span className="text-xs font-brand">Stripe SDK locating readers...</span>
                </div>
              )}

              {!isDiscovering && filteredReaders.length === 0 && (
                <div className="rounded-lg py-6 text-center" style={{ background: themeColors.surfaceAlt, border: `1px dashed ${themeColors.border}` }}>
                  <p className="text-xs font-bold font-brand" style={{ color: themeColors.text }}>No SDK readers registered</p>
                </div>
              )}

              {filteredReaders.map((reader) => (
                <ReaderRow
                  key={reader.serialNumber}
                  reader={reader}
                  connected={connectedReader?.serialNumber === reader.serialNumber}
                  selected={selectedSerial === reader.serialNumber}
                  disabled={isBusy || connectedReader?.serialNumber === reader.serialNumber}
                  connecting={isConnecting && selectedSerial === reader.serialNumber}
                  onConnect={() => void handleConnect(reader.serialNumber)}
                />
              ))}
            </div>

            {/* Manual Serial Connection field */}
            <div className="pt-4 border-t" style={{ borderColor: themeColors.border }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: themeColors.muted }}>Manual Serial Connection</p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
                <SettingsInput
                  value={manualSerial}
                  onChange={(event) => setManualSerial(normalizeSerial((event.target as HTMLInputElement).value))}
                  placeholder="STRM26XXXXXXXXX"
                />
                <ActionButton onClick={() => void handleManualConnect()} disabled={isBusy} loading={isConnecting && selectedSerial === normalizeSerial(manualSerial)} variant="success">
                  Connect
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
