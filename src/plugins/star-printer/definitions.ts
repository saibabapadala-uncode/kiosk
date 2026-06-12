// src/plugins/star-printer/definitions.ts
// TypeScript interface for the StarPrinterReceiptPlugin Capacitor native plugin.
// Native implementation: starprinterplugin/android/src/main/java/com/ajr/starprinter/

export interface StarBluetoothDevice {
  name: string;
  address: string;
  bonded?: boolean;
}

export type PrinterMake = 'star' | 'epson' | 'generic';

export interface StarPrintOptions {
  /** Bluetooth device name */
  printerName: string;
  /** Bluetooth MAC address */
  printerAddress: string;
  /** JSON-serialized StarXpandCommand receipt object */
  constructedObj: string;
}

export interface StarLanPrintOptions {
  /** Printer IP address */
  ip: string;
  port?: number;
  /** ESC/POS hex-encoded or text data */
  textdata: string;
  data: string;
  /** Model hint: 'TSP143' | 'SP700' | 'Epson' | etc. */
  model: string;
  count: number;
}

export interface StarPrinterPlugin {
  // ── Printing ───────────────────────────────────────────────────────────────

  /** Print a StarMicronics receipt via Bluetooth. */
  echo(options: StarPrintOptions): Promise<StarPrintOptions>;

  /** Open cash drawer connected to the printer. */
  openCashDrawer(options: { printerName: string; printerAddress: string }): Promise<{
    printerName: string;
    printerAddress: string;
  }>;

  /** Print text to a LAN (TCP/IP) printer — supports Star TSP/SP, Epson TM models. */
  printText(options: StarLanPrintOptions): Promise<{ status: string; message: string }>;

  // ── Bluetooth device management ────────────────────────────────────────────

  /** Begin Bluetooth device discovery — results arrive via 'bluetoothDeviceFound' event. */
  startScan(): Promise<void>;

  /** Request BLUETOOTH_SCAN / BLUETOOTH_CONNECT permissions (Android 12+). */
  requestBluetoothPermissions(): Promise<void>;

  /** Pair (bond) a Bluetooth device by address. */
  pairDevice(options: { address: string }): Promise<{ status: string }>;

  /** Unpair (remove bond) a Bluetooth device by address. */
  unpairDevice(options: { address: string }): Promise<{ status: string }>;

  /** Get all devices currently bonded in Android Bluetooth settings. */
  fetchPairedDevices(): Promise<{ devices: StarBluetoothDevice[] }>;

  /** Get all devices currently connected via Bluetooth. */
  fetchConnectedDevices(): Promise<{ devices: StarBluetoothDevice[] }>;

  /** Search for a specific device by name, address, or make. */
  searchDevice(options: {
    deviceName: string;
    deviceAddress: string;
    deviceMake: string;
  }): Promise<{ deviceName: string; deviceAddress: string; deviceMake: string }>;

  // ── Permissions / status ───────────────────────────────────────────────────

  /** Check current Bluetooth and Location permission status. */
  allowPermissions(): Promise<{ bluetooth: boolean; location: boolean }>;

  /** Get MAC address of the Android device. */
  getMacAddress(): Promise<void>;

  // ── Events ─────────────────────────────────────────────────────────────────

  addListener(
    event: 'bluetoothDeviceFound',
    handler: (data: { devices: StarBluetoothDevice[] }) => void,
  ): Promise<{ remove(): Promise<void> }>;

  addListener(
    event: 'bluetoothPairingStatus',
    handler: (data: { name: string; address: string; status: string }) => void,
  ): Promise<{ remove(): Promise<void> }>;

  addListener(
    event: 'bluetoothStateChange',
    handler: (data: { isEnabled: boolean }) => void,
  ): Promise<{ remove(): Promise<void> }>;

  removeAllListeners(): Promise<void>;

  // ── Stripe Terminal / Payments ─────────────────────────────────────────────
  getConnectionToken(options: { Token: string }): Promise<{ Token: string }>;
  getReaderDetails(options: { Reader: string; ReaderName: string }): Promise<{ Reader: string; ReaderName: string }>;
  createAndProcessPayment(options: { deviceName: string; deviceAddress: string; constructedObj: {} }): Promise<{
    deviceName: string;
    deviceAddress: string;
    constructedObj: {};
  }>;
  getM2ReaderInfo(): Promise<any>;
}

export interface DeviceStatusPlugin {
  allowPermissions(): Promise<{ bluetooth: boolean; location: boolean }>;
  getPrinterDetails(options: { printerName: string; printerAddress: string }): Promise<unknown>;

  addListener(
    event: 'bluetoothStatusChanged',
    handler: (data: { isEnabled: boolean }) => void,
  ): Promise<{ remove(): Promise<void> }>;

  addListener(
    event: 'locationStatusChanged',
    handler: (data: { isEnabled: boolean }) => void,
  ): Promise<{ remove(): Promise<void> }>;
}
