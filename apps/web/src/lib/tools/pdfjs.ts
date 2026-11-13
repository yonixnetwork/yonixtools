/* Browser-only helpers around Mozilla pdf.js (Apache-2.0), loaded on demand. */
type PdfJs = typeof import("pdfjs-dist");
let loading: Promise<PdfJs> | null = null;

export function getPdfjs(): Promise<PdfJs> {
  return (loading ??= import("pdfjs-dist").then((pdfjs) => {
    if (!pdfjs.GlobalWorkerOptions.workerPort) {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
    }
    return pdfjs;
  }));
}

export interface RenderedPage {
  index: number;
  blob: Blob;
  width: number;
  height: number;
}

/** Render pages to images. `scale` 1 = 72 DPI. Calls onPage as each page finishes. */
export async function renderPdfPages(
  bytes: Uint8Array,
  opts: { scale: number; type: "image/png" | "image/jpeg"; quality?: number; pages?: number[]; onPage?: (p: RenderedPage, total: number) => void; signal?: { cancelled: boolean } },
): Promise<RenderedPage[]> {
  const pdfjs = await getPdfjs();
  const task = pdfjs.getDocument({ data: bytes.slice(), enableXfa: false });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    throw new Error(name === "PasswordException" ? "This PDF is password-protected. Remove the password first." : "This file couldn't be read as a PDF.");
  }
  const indices = opts.pages ?? Array.from({ length: doc.numPages }, (_, i) => i);
  const out: RenderedPage[] = [];
  try {
    for (const i of indices) {
      if (opts.signal?.cancelled) break;
      const page = await doc.getPage(i + 1);
      const viewport = page.getViewport({ scale: opts.scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      if (canvas.width * canvas.height > 40_000_000) throw new Error("A page is too large to render at this resolution. Choose a lower DPI.");
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, canvas, viewport }).promise;
      const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Rendering failed."))), opts.type, opts.quality));
      const r = { index: i, blob, width: canvas.width, height: canvas.height };
      out.push(r);
      opts.onPage?.(r, indices.length);
      page.cleanup();
      canvas.width = canvas.height = 0;
    }
  } finally {
    await task.destroy();
  }
  return out;
}
