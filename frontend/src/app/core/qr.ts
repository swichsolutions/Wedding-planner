/**
 * QR codes for the invitation's links (B6): drawn from the module grid so they stay sharp at any
 * size. The encoder (qrcode-generator, MIT) is loaded only when a code is first drawn, so it
 * never weighs on other pages.
 */

/** The QR modules as one SVG path, `size` modules square (no quiet zone). */
export interface QrShape {
  size: number;
  path: string;
}

async function make(text: string): Promise<{ n: number; dark: (r: number, c: number) => boolean }> {
  const { default: qrcode } = await import('qrcode-generator');
  // Level M: survives a scuffed printed card; the links are short ASCII.
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return { n: qr.getModuleCount(), dark: (r, c) => qr.isDark(r, c) };
}

export async function qrShape(text: string): Promise<QrShape> {
  const { n, dark } = await make(text);
  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (dark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    }
  }
  return { size: n, path };
}

/**
 * A printable PNG: the code on white with its quiet zone, and an optional caption under it
 * (the family's name), for paper invitations.
 */
export async function qrPng(text: string, caption: string | null): Promise<Blob | null> {
  const { n, dark } = await make(text);
  const cell = 16;
  const quiet = 4; // modules of white around the code, per the QR spec
  const side = (n + quiet * 2) * cell;
  const captionH = caption ? 96 : 0;

  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side + captionH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#302b2d';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (dark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    }
  }
  if (caption) {
    ctx.font = `500 36px 'Noto Sans Georgian', 'Noto Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let text2 = caption;
    while (ctx.measureText(text2).width > side - 2 * quiet * cell && text2.length > 4) {
      text2 = text2.slice(0, -2);
    }
    if (text2 !== caption) text2 = text2.trimEnd() + '…';
    ctx.fillText(text2, side / 2, side + captionH / 2 - quiet * cell * 0.5);
  }
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** Save a blob as a file in the browser. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
