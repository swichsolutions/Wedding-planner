/**
 * Gets a venue's floor plan ready for upload (BUILD-PLAN B5). Venues send whatever they have:
 * a PDF, a photo, or a screenshot of the tables. The API only stores JPG/PNG/WebP, so a PDF's
 * first page is drawn to a PNG here, in the browser (pdf.js, loaded only when a PDF is picked),
 * and a photo over the size limit is shrunk. Used by the seating chart (the couple's upload)
 * and the vendor editor (the venue's own plan).
 */

/** What the file pickers accept. */
export const FLOOR_PLAN_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf,.pdf';

/** The API's limit for the stored image. */
export const FLOOR_PLAN_MAX_BYTES = 8 * 1024 * 1024;

/** A PDF this big is not a floor plan. */
const PDF_MAX_BYTES = 40 * 1024 * 1024;

/** Longest side of the rendered page or the shrunk photo: sharp on the 1000px canvas, small to upload. */
const MAX_SIDE = 2400;

export type FloorPlanErrorCode = 'type' | 'tooBig' | 'pdf';

export class FloorPlanError extends Error {
  constructor(readonly code: FloorPlanErrorCode) {
    super(`floor plan: ${code}`);
  }
}

/** The file to upload: the same image, a shrunk one, or a PNG of the PDF's first page. */
export async function prepareFloorPlan(file: File): Promise<File> {
  if (isPdf(file)) {
    if (file.size > PDF_MAX_BYTES) throw new FloorPlanError('tooBig');
    return renderPdfPage(file);
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new FloorPlanError('type');
  if (file.size <= FLOOR_PLAN_MAX_BYTES) return file;
  return shrinkImage(file);
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

async function renderPdfPage(file: File): Promise<File> {
  let canvas: HTMLCanvasElement;
  try {
    // The legacy build: the modern one throws on browsers a few years old (missing language features).
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // The worker (the legacy one too) is copied to /pdfjs by angular.json (assets); it never goes
    // through the bundle.
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    try {
      const doc = await task.promise;
      const page = await doc.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(4, MAX_SIDE / Math.max(base.width, base.height)) });
      canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = '#fff'; // a PDF page has no background of its own
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, viewport }).promise;
    } finally {
      await task.destroy(); // frees the worker's copy of the document
    }
  } catch {
    throw new FloorPlanError('pdf');
  }
  const blob = await encode(canvas, 'image/png');
  const png = blob.size <= FLOOR_PLAN_MAX_BYTES ? blob : await encode(canvas, 'image/jpeg', 0.85);
  if (png.size > FLOOR_PLAN_MAX_BYTES) throw new FloorPlanError('tooBig');
  return new File([png], file.name.replace(/\.pdf$/i, '') + (png.type === 'image/png' ? '.png' : '.jpg'), { type: png.type });
}

/** A photo over the limit, re-encoded smaller (plans are line drawings, so JPEG at 0.85 is plenty). */
async function shrinkImage(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new FloorPlanError('type');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new FloorPlanError('type');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await encode(canvas, 'image/jpeg', 0.85);
  if (blob.size > FLOOR_PLAN_MAX_BYTES) throw new FloorPlanError('tooBig');
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

function encode(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality),
  );
}
