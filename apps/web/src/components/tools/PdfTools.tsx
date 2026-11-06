"use client";
import { Archive, Download, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { baseName, downloadZip, FileDrop, FileOrderList, fmtBytes, toBlob, uid } from "./files";
import { downloadBlob, Field, Notice, Segmented } from "./ui";
import { imagesToPdf, MAX_PDF_BYTES, mergePdfs, optimizePdf, pageCount, parseRanges, rotatePdf, splitPdf, type PageSize, type PdfImage } from "@/lib/tools/pdf";

type Picked = { id: string; name: string; size: number; file: File; note?: string };

const readBytes = async (f: File) => new Uint8Array(await f.arrayBuffer());

function tooBig(files: File[]): string | null {
  const big = files.find((f) => f.size > MAX_PDF_BYTES);
  return big ? `${big.name} is larger than ${MAX_PDF_BYTES / 1_000_000} MB, which is too large to process in a browser.` : null;
}

function useSinglePdf() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [error, setError] = useState("");
  const pick = async (files: File[]) => {
    const f = files[0];
    setError("");
    setPages(null);
    if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) return setError("That file isn't a PDF.");
    const big = tooBig([f]);
    if (big) return setError(big);
    try {
      setPages(await pageCount(await readBytes(f)));
      setFile(f);
    } catch (e) {
      setFile(null);
      setError((e as Error).message);
    }
  };
  return { file, pages, error, setError, pick };
}

function Busy({ text }: { text: string }) {
  return (
    <p className="row muted" role="status">
      <LoaderCircle className="spin" aria-hidden style={{ width: 18, height: 18 }} /> {text}
    </p>
  );
}

// ── Merge ───────────────────────────────────────────────────────────────────

export function PdfMerger() {
  const [items, setItems] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ size: number; pages: number } | null>(null);
  const add = async (files: File[]) => {
    setError("");
    setDone(null);
    const pdfs = files.filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
    if (pdfs.length < files.length) setError("Some files were skipped because they aren't PDFs.");
    const big = tooBig(pdfs);
    if (big) return setError(big);
    const withPages = await Promise.all(pdfs.map(async (f): Promise<Picked | null> => {
      try {
        return { id: uid(), name: f.name, size: f.size, file: f, note: ((n) => `${n} page${n === 1 ? "" : "s"}`)(await pageCount(await readBytes(f))) };
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
        return null;
      }
    }));
    setItems((cur) => [...cur, ...withPages.filter((x): x is Picked => !!x)]);
  };
  const merge = async () => {
    setBusy(true);
    setError("");
    try {
      const out = await mergePdfs(await Promise.all(items.map((i) => readBytes(i.file))));
      setDone({ size: out.length, pages: await pageCount(out) });
      downloadBlob(toBlob(out, "application/pdf"), "merged.pdf");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept="application/pdf,.pdf" multiple onFiles={add} label="Choose PDF files or drop them here" hint="Add two or more. Files never leave your device." testId="pdf-input" />
      {items.length > 0 && <FileOrderList items={items} onChange={(x) => (setItems(x), setDone(null))} />}
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={items.length < 2 || busy} onClick={merge}>
          {busy ? <LoaderCircle className="spin" aria-hidden /> : <Download aria-hidden />} Merge {items.length > 1 ? `${items.length} PDFs` : "PDFs"}
        </button>
        {items.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => (setItems([]), setDone(null))}>Clear</button>}
      </div>
      {done && <Notice kind="success">Merged {done.pages} pages into merged.pdf ({fmtBytes(done.size)}). Your download has started.</Notice>}
    </div>
  );
}

// ── Split ───────────────────────────────────────────────────────────────────

export function PdfSplitter() {
  const { file, pages, error, setError, pick } = useSinglePdf();
  const [mode, setMode] = useState<"ranges" | "every">("ranges");
  const [spec, setSpec] = useState("1-2");
  const [parts, setParts] = useState<Array<{ name: string; bytes: Uint8Array }>>([]);
  const [busy, setBusy] = useState(false);
  let specError = "";
  if (pages && mode === "ranges") {
    try {
      parseRanges(spec, pages);
    } catch (e) {
      specError = (e as Error).message;
    }
  }
  const split = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setParts(await splitPdf(await readBytes(file), mode === "every" ? { kind: "every" } : { kind: "ranges", spec }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept="application/pdf,.pdf" onFiles={(f) => (setParts([]), pick(f))} label={file ? file.name : "Choose a PDF or drop it here"} hint={pages ? `${pages} pages · click to change` : "Processed on your device"} testId="pdf-input" />
      {error && <Notice kind="error">{error}</Notice>}
      {file && pages && (
        <>
          <Segmented label="Split mode" value={mode} onChange={(m) => (setMode(m), setParts([]))} options={[{ value: "ranges", label: "Page ranges" }, { value: "every", label: `Every page (${pages} files)` }]} />
          {mode === "ranges" && (
            <Field label="Ranges (one output file per range)" htmlFor="split-spec" hint={specError ? <span style={{ color: "var(--danger)" }}>{specError}</span> : "Example: 1-3, 5, 8-"}>
              <input id="split-spec" className="input mono" value={spec} onChange={(e) => (setSpec(e.target.value), setParts([]))} />
            </Field>
          )}
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={busy || !!specError} onClick={split}>{busy ? <LoaderCircle className="spin" aria-hidden /> : null} Split PDF</button>
          </div>
        </>
      )}
      {parts.length > 0 && file && (
        <div className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong data-testid="split-count">{parts.length} file{parts.length === 1 ? "" : "s"} ready</strong>
            <button type="button" className="btn btn-sm" onClick={() => downloadZip(parts, `${baseName(file.name)}-split.zip`)}><Archive aria-hidden /> Download all (ZIP)</button>
          </div>
          <ul className="file-list">
            {parts.map((p) => (
              <li key={p.name}>
                <span className="file-name">{p.name}<span className="muted"> · {fmtBytes(p.bytes.length)}</span></span>
                <button type="button" className="btn btn-sm" onClick={() => downloadBlob(toBlob(p.bytes, "application/pdf"), `${baseName(file.name)}-${p.name}`)}><Download aria-hidden /> Download</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Compress ────────────────────────────────────────────────────────────────

export function PdfCompressor() {
  const { file, pages, error, setError, pick } = useSinglePdf();
  const [mode, setMode] = useState<"lossless" | "strong">("lossless");
  const [quality, setQuality] = useState(60);
  const [dpi, setDpi] = useState(110);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<Uint8Array | null>(null);
  useEffect(() => setResult(null), [file, mode, quality, dpi]);

  const run = async () => {
    if (!file) return;
    setError("");
    try {
      const bytes = await readBytes(file);
      if (mode === "lossless") {
        setBusy("Optimising…");
        setResult(await optimizePdf(bytes));
      } else {
        const { renderPdfPages } = await import("@/lib/tools/pdfjs");
        const rendered = await renderPdfPages(bytes, { scale: dpi / 72, type: "image/jpeg", quality: quality / 100, onPage: (_, total) => setBusy(`Rendering page ${Math.min(total, _.index + 1)} of ${total}…`) });
        setBusy("Building PDF…");
        const images: PdfImage[] = await Promise.all(rendered.map(async (r) => ({ bytes: new Uint8Array(await r.blob.arrayBuffer()), type: "jpeg" as const, width: (r.width * 72) / dpi, height: (r.height * 72) / dpi })));
        setResult(await imagesToPdf(images, { pageSize: "fit", margin: 0 }));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const saving = file && result ? 1 - result.length / file.size : 0;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept="application/pdf,.pdf" onFiles={pick} label={file ? file.name : "Choose a PDF or drop it here"} hint={file ? `${pages} pages · ${fmtBytes(file.size)} · click to change` : "Processed on your device"} testId="pdf-input" />
      {error && <Notice kind="error">{error}</Notice>}
      {file && (
        <>
          <Segmented label="Compression" value={mode} onChange={setMode} options={[{ value: "lossless", label: "Lossless (keeps text)" }, { value: "strong", label: "Strong (pages become images)" }]} />
          {mode === "strong" && (
            <div className="form-grid cols-2">
              <Field label={`JPEG quality: ${quality}%`} htmlFor="pc-q"><input id="pc-q" type="range" min={20} max={95} value={quality} onChange={(e) => setQuality(+e.target.value)} /></Field>
              <Field label={`Resolution: ${dpi} DPI`} htmlFor="pc-dpi"><input id="pc-dpi" type="range" min={72} max={200} step={2} value={dpi} onChange={(e) => setDpi(+e.target.value)} /></Field>
            </div>
          )}
          {mode === "strong" && <Notice kind="warn">Strong compression turns each page into an image, so text will no longer be selectable or searchable.</Notice>}
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={run}>Compress</button>
          </div>
          {busy && <Busy text={busy} />}
          {result && (
            <>
              <div className="stat-grid">
                <div className="stat"><div className="v">{fmtBytes(file.size)}</div><div className="k">Original</div></div>
                <div className="stat"><div className="v" data-testid="pdf-result-size">{fmtBytes(result.length)}</div><div className="k">Compressed</div></div>
                <div className="stat"><div className="v" style={{ color: saving > 0 ? "var(--success)" : undefined }}>{`${saving >= 0 ? "−" : "+"}${Math.abs(saving * 100).toFixed(0)}%`}</div><div className="k">Change</div></div>
              </div>
              {saving <= 0.01 && <Notice kind="info">The file couldn&apos;t be made meaningfully smaller with this setting. {mode === "lossless" ? "Try strong compression for scanned or image-heavy PDFs." : "Lower the quality or resolution, or keep the original."}</Notice>}
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={() => downloadBlob(toBlob(result, "application/pdf"), `${baseName(file.name)}-compressed.pdf`)}><Download aria-hidden /> Download compressed PDF</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── PDF → images ────────────────────────────────────────────────────────────

export function PdfToImage() {
  const { file, pages, error, setError, pick } = useSinglePdf();
  const [type, setType] = useState<"image/jpeg" | "image/png">("image/jpeg");
  const [dpi, setDpi] = useState<"72" | "150" | "300">("150");
  const [out, setOut] = useState<Array<{ name: string; url: string; blob: Blob }>>([]);
  const [busy, setBusy] = useState("");
  useEffect(() => () => out.forEach((o) => URL.revokeObjectURL(o.url)), [out]);
  const ext = type === "image/png" ? "png" : "jpg";
  const run = async () => {
    if (!file) return;
    setError("");
    setOut([]);
    try {
      const { renderPdfPages } = await import("@/lib/tools/pdfjs");
      const rendered = await renderPdfPages(await readBytes(file), { scale: Number(dpi) / 72, type, quality: 0.92, onPage: (p, total) => setBusy(`Rendering page ${p.index + 1} of ${total}…`) });
      setOut(rendered.map((r) => ({ name: `${baseName(file.name)}-page-${r.index + 1}.${ext}`, url: URL.createObjectURL(r.blob), blob: r.blob })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept="application/pdf,.pdf" onFiles={(f) => (setOut([]), pick(f))} label={file ? file.name : "Choose a PDF or drop it here"} hint={pages ? `${pages} pages · click to change` : "Rendered on your device with pdf.js"} testId="pdf-input" />
      {error && <Notice kind="error">{error}</Notice>}
      {file && (
        <>
          <div className="row">
            <Segmented label="Format" value={type} onChange={setType} options={[{ value: "image/jpeg", label: "JPG" }, { value: "image/png", label: "PNG" }]} />
            <Segmented label="Resolution" value={dpi} onChange={setDpi} options={[{ value: "72", label: "72 DPI" }, { value: "150", label: "150 DPI" }, { value: "300", label: "300 DPI" }]} />
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={run}>Convert {pages} page{pages === 1 ? "" : "s"}</button>
          </div>
          {pages && pages > 50 && dpi === "300" && <Notice kind="warn">Rendering many pages at 300 DPI uses a lot of memory and can be slow.</Notice>}
        </>
      )}
      {busy && <Busy text={busy} />}
      {out.length > 0 && (
        <div className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong data-testid="image-count">{out.length} image{out.length === 1 ? "" : "s"}</strong>
            <button type="button" className="btn btn-sm" onClick={async () => downloadZip(await Promise.all(out.map(async (o) => ({ name: o.name, bytes: new Uint8Array(await o.blob.arrayBuffer()) }))), `${baseName(file!.name)}-images.zip`)}><Archive aria-hidden /> Download all (ZIP)</button>
          </div>
          <div className="page-grid">
            {out.map((o, i) => (
              <figure key={o.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.url} alt={`Page ${i + 1}`} loading="lazy" />
                <a className="link" href={o.url} download={o.name}>Page {i + 1}</a>
              </figure>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Images → PDF ────────────────────────────────────────────────────────────

async function toPdfImage(file: File): Promise<PdfImage> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`${file.name} couldn't be opened as an image.`);
  });
  const { width, height } = bitmap;
  if (file.type === "image/jpeg" || file.type === "image/png") {
    bitmap.close();
    return { bytes: await readBytes(file), type: file.type === "image/png" ? "png" : "jpeg", width, height };
  }
  // WebP/GIF/BMP/AVIF: re-encode as PNG (PDF only embeds JPEG and PNG).
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Encoding failed."))), "image/png"));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: "png", width, height };
}

export function ImageToPdf() {
  const [items, setItems] = useState<Picked[]>([]);
  const [size, setSize] = useState<PageSize>("a4");
  const [margin, setMargin] = useState<"0" | "20" | "40">("20");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const add = (files: File[]) => {
    setError("");
    setDone(null);
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (imgs.length < files.length) setError("Some files were skipped because they aren't images.");
    setItems((cur) => [...cur, ...imgs.map((f) => ({ id: uid(), name: f.name, size: f.size, file: f }))]);
  };
  const build = async () => {
    setBusy(true);
    setError("");
    try {
      const imgs = [];
      for (const it of items) imgs.push(await toPdfImage(it.file));
      const pdf = await imagesToPdf(imgs, { pageSize: size, margin: Number(margin) });
      setDone(pdf.length);
      downloadBlob(toBlob(pdf, "application/pdf"), items.length === 1 ? `${baseName(items[0].name)}.pdf` : "images.pdf");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept="image/*" multiple onFiles={add} label="Choose images or drop them here" hint="JPG, PNG, WebP. One image per page." testId="image-input" />
      {items.length > 0 && <FileOrderList items={items} onChange={(x) => (setItems(x), setDone(null))} />}
      <div className="row">
        <Segmented label="Page size" value={size} onChange={setSize} options={[{ value: "a4", label: "A4" }, { value: "letter", label: "Letter" }, { value: "fit", label: "Image size" }]} />
        <Segmented label="Margin" value={margin} onChange={setMargin} options={[{ value: "0", label: "No margin" }, { value: "20", label: "Small" }, { value: "40", label: "Large" }]} />
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={!items.length || busy} onClick={build}>{busy ? <LoaderCircle className="spin" aria-hidden /> : <Download aria-hidden />} Create PDF</button>
      </div>
      {done !== null && <Notice kind="success">Created a {items.length}-page PDF ({fmtBytes(done)}). Your download has started.</Notice>}
    </div>
  );
}

// ── Rotate ──────────────────────────────────────────────────────────────────

export function RotatePdf() {
  const { file, pages, error, setError, pick } = useSinglePdf();
  const [angle, setAngle] = useState<"90" | "180" | "270">("90");
  const [which, setWhich] = useState<"all" | "some">("all");
  const [spec, setSpec] = useState("1");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  let specError = "";
  let indices: number[] = [];
  if (pages && which === "some") {
    try {
      indices = [...new Set(parseRanges(spec, pages).flat())];
    } catch (e) {
      specError = (e as Error).message;
    }
  }
  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const out = await rotatePdf(await readBytes(file), Number(angle) as 90 | 180 | 270, which === "all" ? "all" : indices);
      downloadBlob(toBlob(out, "application/pdf"), `${baseName(file.name)}-rotated.pdf`);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept="application/pdf,.pdf" onFiles={(f) => (setDone(false), pick(f))} label={file ? file.name : "Choose a PDF or drop it here"} hint={pages ? `${pages} pages · click to change` : "Processed on your device"} testId="pdf-input" />
      {error && <Notice kind="error">{error}</Notice>}
      {file && (
        <>
          <div className="row">
            <Segmented label="Angle" value={angle} onChange={setAngle} options={[{ value: "90", label: "90° right" }, { value: "180", label: "180°" }, { value: "270", label: "90° left" }]} />
            <Segmented label="Pages" value={which} onChange={setWhich} options={[{ value: "all", label: "All pages" }, { value: "some", label: "Selected pages" }]} />
          </div>
          {which === "some" && (
            <Field label="Pages to rotate" htmlFor="rot-spec" hint={specError ? <span style={{ color: "var(--danger)" }}>{specError}</span> : "Example: 1, 3-4"}>
              <input id="rot-spec" className="input mono" value={spec} onChange={(e) => setSpec(e.target.value)} />
            </Field>
          )}
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={busy || !!specError} onClick={run}><Download aria-hidden /> Rotate &amp; download</button>
          </div>
          {done && <Notice kind="success">Rotated PDF downloaded.</Notice>}
        </>
      )}
    </div>
  );
}
