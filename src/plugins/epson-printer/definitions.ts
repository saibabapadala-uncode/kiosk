// src/plugins/epson-printer/definitions.ts

export type PrinterTransport = 'ethernet' | 'bluetooth' | 'usb';

export interface PrinterConnectOptions {
  transport: PrinterTransport;
  /** IP address (ethernet) or Bluetooth MAC address */
  address: string;
  /** TCP port — defaults to 9100 for ethernet */
  port?: number;
  /** Bluetooth device name (informational) */
  deviceName?: string;
}

export interface PrinterStatus {
  online: boolean;
  paperStatus: 'ok' | 'near_end' | 'empty' | 'unknown';
  coverOpen: boolean;
  drawerOpen: boolean;
  errorCode: number;
}

export interface BluetoothDevice {
  address: string;
  name: string;
}

// ─── Receipt line types ──────────────────────────────────────────────────────

export interface TextLine {
  type: 'text';
  content: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  underline?: boolean;
  size?: 'normal' | 'double_width' | 'double_height' | 'double';
}

export interface SeparatorLine {
  type: 'separator';
  char?: string; // default '─'
  width?: number; // default 42 columns
}

export interface BarcodeLine {
  type: 'barcode';
  data: string;
  symbology?: 'QR' | 'CODE128' | 'EAN13' | 'EAN8' | 'UPC_A' | 'CODE39';
  /** QR error correction: L(7%) M(15%) Q(25%) H(30%) — default M */
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
  /** Cell size 1-16, default 8 for QR */
  size?: number;
  /** Barcode height in dots (1D barcodes), default 80 */
  height?: number;
}

export interface ImageLine {
  type: 'image';
  /** Base-64 encoded PNG or JPEG */
  base64: string;
  /** Target width in dots — printer scales proportionally. Default: full width */
  width?: number;
  align?: 'left' | 'center' | 'right';
}

export interface FeedLine {
  type: 'feed';
  lines?: number; // default 1
}

export type ReceiptLine = TextLine | SeparatorLine | BarcodeLine | ImageLine | FeedLine;

// ─── Print options ────────────────────────────────────────────────────────────

export interface PrintReceiptOptions {
  lines: ReceiptLine[];
  cutPaper?: boolean;          // default true
  openCashDrawer?: boolean;    // default false
  beep?: boolean;              // default false
}

// ─── Plugin interface ─────────────────────────────────────────────────────────

export interface EpsonPrinterPlugin {
  /** List paired Bluetooth printers (Android requires BT permission). */
  listBluetoothDevices(): Promise<{ devices: BluetoothDevice[] }>;

  connect(options: PrinterConnectOptions): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): Promise<{ connected: boolean; transport?: PrinterTransport }>;
  getStatus(): Promise<PrinterStatus>;

  printReceipt(options: PrintReceiptOptions): Promise<void>;

  /** Trigger cash drawer pulse (24V pin 2 / pin 5). */
  openCashDrawer(): Promise<void>;

  addListener(
    event: 'printerStatusChange',
    handler: (status: PrinterStatus) => void,
  ): Promise<{ remove(): Promise<void> }>;

  addListener(
    event: 'printerError',
    handler: (data: { message: string; code: number }) => void,
  ): Promise<{ remove(): Promise<void> }>;

  removeAllListeners(): Promise<void>;
}
