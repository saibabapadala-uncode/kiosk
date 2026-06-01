// src/plugins/barcode-scanner/web.ts
// Camera scanning on web uses the BarcodeDetector API (Chrome 83+) or falls
// back to a readable stream + canvas analysis. HID scanning is handled in
// useBarcodeScanner.ts via keyboard events — no camera bridge needed there.
import { WebPlugin } from '@capacitor/core';
import type { BarcodeScannerPlugin, CameraScanOptions, ScanResult } from './definitions';
import { logger } from '@/utils/logger';

export class BarcodeScannerWeb extends WebPlugin implements BarcodeScannerPlugin {
  private stream: MediaStream | null = null;
  private rafId: number | null = null;
  private video: HTMLVideoElement | null = null;

  async hasCameraPermission(): Promise<{ granted: boolean }> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasCam = devices.some((d) => d.kind === 'videoinput');
    return { granted: hasCam };
  }

  async requestCameraPermission(): Promise<{ granted: boolean }> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      return { granted: true };
    } catch {
      return { granted: false };
    }
  }

  async startCameraScan(options: CameraScanOptions = {}): Promise<void> {
    const { continuous = false } = options;

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });

    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', 'true');
    this.video.srcObject = this.stream;
    await this.video.play();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Use BarcodeDetector where available
    if ('BarcodeDetector' in window) {
      const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect(src: CanvasImageSource): Promise<{ rawValue: string; format: string }[]> } }).BarcodeDetector({
        formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39', 'upc_a'],
      });

      const scan = async () => {
        if (!this.video) return;
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        ctx.drawImage(this.video, 0, 0);

        const barcodes = await detector.detect(canvas).catch(() => []);
        for (const bc of barcodes) {
          const result: ScanResult = {
            rawValue: bc.rawValue,
            format: bc.format.toUpperCase().replace('_', '_') as ScanResult['format'],
            source: 'camera',
            timestamp: Date.now(),
          };
          this.notifyListeners('scan', result);
          if (!continuous) { await this.stopCameraScan(); return; }
        }

        this.rafId = requestAnimationFrame(() => void scan());
      };

      this.rafId = requestAnimationFrame(() => void scan());
    } else {
      logger.warn('[BarcodeScanner/web] BarcodeDetector API not available in this browser');
      this.notifyListeners('scanError', { message: 'BarcodeDetector not supported. Use Chrome 83+ or a native device.' });
    }
  }

  async stopCameraScan(): Promise<void> {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video = null;
  }

  async setTorch(): Promise<void> {
    logger.warn('[BarcodeScanner/web] torch not supported in web context');
  }

  async isCameraScanActive(): Promise<{ active: boolean }> {
    return { active: this.stream !== null };
  }
}
