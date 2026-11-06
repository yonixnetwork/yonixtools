import { degrees, PDFDocument } from "pdf-lib";

export const MAX_PDF_BYTES = 200 * 1024 * 1024;

export async function loadPdf(bytes: Uint8Array | ArrayBuffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (/encrypt/i.test(msg)) throw new Error("This PDF is password-protected. Remove the password first, then try again.");
    throw new Error("This file couldn't be read as a PDF. It may be damaged or not a PDF.");
  }
}

/**
 * Parse page ranges like "1-3, 5, 8-" (1-based, inclusive) against a page count.
 * Returns groups of 0-based indices, one group per comma-separated part.
 */
export function parseRanges(spec: string, pageCount: number): number[][] {
  const parts = spec.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) throw new Error("Enter at least one page or range, e.g. 1-3, 5.");
  return parts.map((part) => {
    const m = /^(\d+)?\s*(?:(-)\s*(\d+)?)?$/.exec(part);
    if (!m || (!m[1] && !m[3])) throw new Error(`“${part}” isn't a valid page or range.`);
    const start = m[1] ? Number(m[1]) : 1;
    const end = m[2] ? (m[3] ? Number(m[3]) : pageCount) : start;
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) throw new Error(`“${part}” is outside the document (it has ${pageCount} pages).`);
    if (end < start) throw new Error(`“${part}” goes backwards.`);
    return Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
  });
}

export async function mergePdfs(files: Array<Uint8Array | ArrayBuffer>): Promise<Uint8Array> {
  if (files.length < 2) throw new Error("Add at least two PDFs to merge.");
  const out = await PDFDocument.create();
  for (const f of files) {
    const doc = await loadPdf(f);
    const pages = await out.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save({ useObjectStreams: true });
}

export async function extractPages(file: Uint8Array | ArrayBuffer, indices: number[]): Promise<Uint8Array> {
  const src = await loadPdf(file);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return out.save({ useObjectStreams: true });
}

export async function splitPdf(file: Uint8Array | ArrayBuffer, mode: { kind: "every" } | { kind: "ranges"; spec: string }): Promise<Array<{ name: string; bytes: Uint8Array }>> {
  const src = await loadPdf(file);
  const n = src.getPageCount();
  const groups = mode.kind === "every" ? Array.from({ length: n }, (_, i) => [i]) : parseRanges(mode.spec, n);
  const out: Array<{ name: string; bytes: Uint8Array }> = [];
  for (const g of groups) {
    const doc = await PDFDocument.create();
    (await doc.copyPages(src, g)).forEach((p) => doc.addPage(p));
    const label = g.length === 1 ? `page-${g[0] + 1}` : `pages-${g[0] + 1}-${g[g.length - 1] + 1}`;
    out.push({ name: `${label}.pdf`, bytes: await doc.save({ useObjectStreams: true }) });
  }
  return out;
}

export async function rotatePdf(file: Uint8Array | ArrayBuffer, angle: 90 | 180 | 270, pages: "all" | number[]): Promise<Uint8Array> {
  const doc = await loadPdf(file);
  const targets = pages === "all" ? doc.getPageIndices() : pages;
  for (const i of targets) {
    const p = doc.getPage(i);
    p.setRotation(degrees((p.getRotation().angle + angle) % 360));
  }
  return doc.save({ useObjectStreams: true });
}

/** Lossless re-save: object streams, no unused objects. Text stays selectable. */
export async function optimizePdf(file: Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  const src = await loadPdf(file);
  const out = await PDFDocument.create();
  (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
  const title = src.getTitle();
  if (title) out.setTitle(title);
  return out.save({ useObjectStreams: true });
}

export type PageSize = "fit" | "a4" | "letter";
const SIZES: Record<Exclude<PageSize, "fit">, [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] };

export interface PdfImage {
  bytes: Uint8Array;
  type: "jpeg" | "png";
  width: number;
  height: number;
}

/** Build a PDF from JPEG/PNG images, one per page. Width/height in pixels (used for aspect ratio). */
export async function imagesToPdf(images: PdfImage[], opts: { pageSize: PageSize; margin: number; landscape?: boolean }): Promise<Uint8Array> {
  if (!images.length) throw new Error("Add at least one image.");
  const doc = await PDFDocument.create();
  for (const img of images) {
    const embedded = img.type === "png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
    let pw: number, ph: number;
    if (opts.pageSize === "fit") {
      // 72 dpi equivalent keeps the original pixel size as points; cap very large images to A3-ish.
      const scale = Math.min(1, 1190 / Math.max(img.width, img.height));
      pw = img.width * scale + opts.margin * 2;
      ph = img.height * scale + opts.margin * 2;
    } else {
      [pw, ph] = SIZES[opts.pageSize];
      if (opts.landscape ?? img.width > img.height) [pw, ph] = [ph, pw];
    }
    const page = doc.addPage([pw, ph]);
    const maxW = pw - opts.margin * 2;
    const maxH = ph - opts.margin * 2;
    const s = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * s;
    const h = img.height * s;
    page.drawImage(embedded, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  return doc.save({ useObjectStreams: true });
}

export async function pageCount(file: Uint8Array | ArrayBuffer): Promise<number> {
  return (await loadPdf(file)).getPageCount();
}
