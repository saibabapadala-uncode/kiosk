// src/plugins/barcode-scanner/definitions.ts

export type BarcodeFormat =
  | 'QR_CODE'
  | 'CODE_128'
  | 'CODE_39'
  | 'CODE_93'
  | 'EAN_13'
  | 'EAN_8'
  | 'UPC_A'
  | 'UPC_E'
  | 'DATA_MATRIX'
  | 'AZTEC'
  | 'PDF_417'
  | 'ITF'
  | 'CODABAR'
  | 'UNKNOWN';

export interface ScanResult {
  rawValue: string;
  format: BarcodeFormat;
  /** Source of the scan — camera is native camera, hid is keyboard-wedge input */
  source: 'camera' | 'hid';
  /** Unix ms timestamp */
  timestamp: number;
}

export interface CameraScanOptions {
  /** Keep scanning after the first result (default: false — single scan) */
  continuous?: boolean;
  /** Filter to specific formats. Empty = all supported. */
  formats?: BarcodeFormat[];
  /** Show a viewfinder overlay. Default: true */
  showViewfinder?: boolean;
  /** Torch/flashlight on. Default: false */
  torchEnabled?: boolean;
}

export interface BarcodeScannerPlugin {
  hasCameraPermission(): Promise<{ granted: boolean }>;
  requestCameraPermission(): Promise<{ granted: boolean }>;

  /** Start camera-based scanning. Results arrive via 'scan' events. */
  startCameraScan(options?: CameraScanOptions): Promise<void>;
  stopCameraScan(): Promise<void>;

  setTorch(options: { enabled: boolean }): Promise<void>;

  isCameraScanActive(): Promise<{ active: boolean }>;

  addListener(
    event: 'scan',
    handler: (result: ScanResult) => void,
  ): Promise<{ remove(): Promise<void> }>;

  addListener(
    event: 'scanError',
    handler: (data: { message: string }) => void,
  ): Promise<{ remove(): Promise<void> }>;

  removeAllListeners(): Promise<void>;
}
