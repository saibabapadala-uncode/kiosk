// src/utils/receiptCanvas.ts
// Renders a structured receipt to a Base64-encoded PNG image.
//
// The Star Printer native plugin's echo() method accepts a Base64 PNG
// (not JSON or text) — it decodes the bytes, converts to Bitmap, and sends
// to the printer via StarXpandCommand ImageParameter.
//
// This matches kiosk_straunt_storefront's generateImageFromLines() pattern:
//   receipt lines → HTML5 Canvas → Base64 PNG → echo()

export interface ReceiptLine {
  /** Primary text drawn from the left */
  text: string;
  /** Optional price or secondary text drawn flush right (same baseline) */
  rightText?: string;
  align?: 'left' | 'center' | 'right';
  /** Font size in px. Default 24. */
  size?: number;
  bold?: boolean;
  /** Extra vertical space below this line (pixels). Default 0. */
  spacingBelow?: number;
}

// 80mm paper at 203 DPI ≈ 576 dots wide; 576px canvas maps 1:1 to printer dots.
const CANVAS_WIDTH = 576;
const PADDING_X = 18;
const DEFAULT_SIZE = 24;
const LINE_HEIGHT_FACTOR = 1.5;

/**
 * Render receipt lines to a Base64 PNG string suitable for passing to
 * StarPrinterNative.echo({ constructedObj }).
 *
 * Returns the raw base64 bytes WITHOUT the "data:image/png;base64," prefix.
 */
export function renderReceiptToBase64(lines: ReceiptLine[]): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Pre-calculate total height so we size the canvas in one pass.
  let totalHeight = PADDING_X;
  for (const line of lines) {
    const size = line.size ?? DEFAULT_SIZE;
    totalHeight += Math.ceil(size * LINE_HEIGHT_FACTOR) + (line.spacingBelow ?? 0);
  }
  totalHeight += PADDING_X;

  canvas.width  = CANVAS_WIDTH;
  canvas.height = Math.ceil(totalHeight);

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#000000';
  let y = PADDING_X;

  for (const line of lines) {
    const size = line.size ?? DEFAULT_SIZE;
    const lh   = Math.ceil(size * LINE_HEIGHT_FACTOR);
    ctx.font = `${line.bold ? 'bold ' : ''}${size}px monospace`;
    ctx.textBaseline = 'top';

    if (line.rightText !== undefined) {
      // Two-column layout: text left, rightText right
      const rw = ctx.measureText(line.rightText).width;
      ctx.fillText(line.text,      PADDING_X, y);
      ctx.fillText(line.rightText, CANVAS_WIDTH - PADDING_X - rw, y);
    } else {
      const align = line.align ?? 'left';
      if (align === 'center') {
        const w = ctx.measureText(line.text).width;
        ctx.fillText(line.text, Math.max(PADDING_X, (CANVAS_WIDTH - w) / 2), y);
      } else if (align === 'right') {
        const w = ctx.measureText(line.text).width;
        ctx.fillText(line.text, CANVAS_WIDTH - PADDING_X - w, y);
      } else {
        ctx.fillText(line.text, PADDING_X, y);
      }
    }

    y += lh + (line.spacingBelow ?? 0);
  }

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.replace(/^data:image\/png;base64,/, '');
}
