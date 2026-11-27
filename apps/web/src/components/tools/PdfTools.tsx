"use client";
import { Archive, Download, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormat, useT } from "@/i18n/client";
import { isUserError, UserError } from "@/i18n/errors";
import type { Translator } from "@/i18n/translator";
import { baseName, downloadZip, FileDrop, FileOrderList, toBlob, uid, useFileSize } from "./files";
import { announceDownload, downloadBlob, Field, Notice, Segmented } from "./ui";
import { imagesToPdf, MAX_PDF_BYTES, mergePdfs, optimizePdf, pageCount, parseRanges, rotatePdf, splitPdf, type PageSize, type PdfImage } from "@/lib/tools/pdf";

type Picked = { id: string; name: string; size: number; file: File; note?: string };

const readBytes = async (f: File) => new Uint8Array(await f.arrayBuffer());

/** Text for a caught error: translated UserError, or a generic message. */
const errText = (t: Translator, e: unknown) => (isUserError(e) ? t(e.key, e.vars) : t("errors.generic"));

function useTooBig() {
  const t = useT("tools-pdf");
  const f = useFormat();
  return (files: File[]): string | null => {
    const big = files.find((x) => x.size > MAX_PDF_BYTES);
    return big ? t("errors.tooBig", { name: big.name, size: f.number(MAX_PDF_BYTES / 1_000_000, { maximumFractionDigits: 4 }) }) : null;
  };
}

function useSinglePdf() {
  const t = useT("tools-pdf");
  const tooBig = useTooBig();
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [error, setError] = useState("");
  const pick = async (files: File[]) => {
    const f = files[0];
    setError("");
    setPages(null);
    if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) return setError(t("errors.notPdf"));
    const big = tooBig([f]);
    if (big) return setError(big);
    try {
      setPages(await pageCount(await readBytes(f)));
      setFile(f);
    } catch (e) {
      setFile(null);
      setError(errText(t, e));
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
  const t = useT("tools-pdf");
  const size = useFileSize();
  const tooBig = useTooBig();
  const [items, setItems] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ size: number; pages: number } | null>(null);
  const add = async (files: File[]) => {
    setError("");
    setDone(null);
    const pdfs = files.filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
    if (pdfs.length < files.length) setError(t("merger.skipped"));
    const big = tooBig(pdfs);
    if (big) return setError(big);
    const withPages = await Promise.all(pdfs.map(async (f): Promise<Picked | null> => {
      try {
        return { id: uid(), name: f.name, size: f.size, file: f, note: t("merger.pageNote", { count: await pageCount(await readBytes(f)) }) };
      } catch (e) {
        setError(t("merger.fileError", { name: f.name, message: errText(t, e) }));
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
      <FileDrop accept="application/pdf,.pdf" multiple onFiles={add} label={t("merger.dropLabel")} hint={t("merger.dropHint")} testId="pdf-input" />
      {items.length > 0 && <FileOrderList items={items} onChange={(x) => (setItems(x), setDone(null))} />}
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={items.length < 2 || busy} onClick={merge}>
          {busy ? <LoaderCircle className="spin" aria-hidden /> : <Download aria-hidden />} {items.length > 1 ? t("merger.mergeCount", { count: items.length }) : t("merger.merge")}
        </button>
        {items.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => (setItems([]), setDone(null))}>{t("common.clear")}</button>}
      </div>
      {done && <Notice kind="success">{t("merger.done", { count: done.pages, size: size(done.size) })}</Notice>}
    </div>
  );
}

// ── Split ───────────────────────────────────────────────────────────────────

export function PdfSplitter() {
  const t = useT("tools-pdf");
  const size = useFileSize();
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
      specError = errText(t, e);
    }
  }
  const split = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      setParts(await splitPdf(await readBytes(file), mode === "every" ? { kind: "every" } : { kind: "ranges", spec }));
    } catch (e) {
      setError(errText(t, e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept="application/pdf,.pdf" onFiles={(f) => (setParts([]), pick(f))} label={file ? file.name : t("common.dropLabel")} hint={pages ? t("common.pagesChange", { count: pages }) : t("common.processedLocally")} testId="pdf-input" />
      {error && <Notice kind="error">{error}</Notice>}
      {file && pages && (
        <>
          <Segmented label={t("splitter.mode")} value={mode} onChange={(m) => (setMode(m), setParts([]))} options={[{ value: "ranges", label: t("splitter.ranges") }, { value: "every", label: t("splitter.every", { count: pages }) }]} />
          {mode === "ranges" && (
            <Field label={t("splitter.rangesLabel")} htmlFor="split-spec" hint={specError ? <span style={{ color: "var(--danger)" }}>{specError}</span> : t("splitter.rangesHint")}>
              <input id="split-spec" className="input mono" value={spec} onChange={(e) => (setSpec(e.target.value), setParts([]))} />
            </Field>
          )}
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={busy || !!specError} onClick={split}>{busy ? <LoaderCircle className="spin" aria-hidden /> : null} {t("splitter.split")}</button>
          </div>
        </>
      )}
      {parts.length > 0 && file && (
        <div className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong data-testid="split-count">{t("splitter.ready", { count: parts.length })}</strong>
            <button type="button" className="btn btn-sm" onClick={() => downloadZip(parts, `${baseName(file.name)}-split.zip`)}><Archive aria-hidden /> {t("common.downloadZip")}</button>
          </div>
          <ul className="file-list">
            {parts.map((p) => (
              <li key={p.name}>
                <span className="file-name">{p.name}<span className="muted"> · {size(p.bytes.length)}</span></span>
                <button type="button" className="btn btn-sm" onClick={() => downloadBlob(toBlob(p.bytes, "application/pdf"), `${baseName(file.name)}-${p.name}`)}><Download aria-hidden /> {t("common.download")}</button>
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
  const t = useT("tools-pdf");
  const f = useFormat();
  const size = useFileSize();
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
        setBusy(t("compressor.optimising"));
        setResult(await optimizePdf(bytes));
      } else {
        const { renderPdfPages } = await import("@/lib/tools/pdfjs");
        const rendered = await renderPdfPages(bytes, { scale: dpi / 72, type: "image/jpeg", quality: quality / 100, onPage: (_, total) => setBusy(t("common.renderingPage", { page: Math.min(total, _.index + 1), total })) });
        setBusy(t("compressor.building"));
        const images: PdfImage[] = await Promise.all(rendered.map(async (r) => ({ bytes: new Uint8Array(await r.blob.arrayBuffer()), type: "jpeg" as const, width: (r.width * 72) / dpi, height: (r.height * 72) / dpi })));
        setResult(await imagesToPdf(images, { pageSize: "fit", margin: 0 }));
      }
    } catch (e) {
      setError(errText(t, e));
    } finally {
      setBusy("");
    }
  };
  const saving = file && result ? 1 - result.length / file.size : 0;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept="application/pdf,.pdf" onFiles={pick} label={file ? file.name : t("common.dropLabel")} hint={file ? t("common.pagesSizeChange", { count: pages ?? 0, size: size(file.size) }) : t("common.processedLocally")} testId="pdf-input" />
      {error && <Notice kind="error">{error}</Notice>}
      {file && (
        <>
          <Segmented label={t("compressor.mode")} value={mode} onChange={setMode} options={[{ value: "lossless", label: t("compressor.lossless") }, { value: "strong", label: t("compressor.strong") }]} />
          {mode === "strong" && (
            <div className="form-grid cols-2">
              <Field label={t("compressor.quality", { value: quality })} htmlFor="pc-q"><input id="pc-q" type="range" min={20} max={95} value={quality} onChange={(e) => setQuality(+e.target.value)} /></Field>
              <Field label={t("compressor.resolution", { value: dpi })} htmlFor="pc-dpi"><input id="pc-dpi" type="range" min={72} max={200} step={2} value={dpi} onChange={(e) => setDpi(+e.target.value)} /></Field>
            </div>
          )}
          {mode === "strong" && <Notice kind="warn">{t("compressor.strongWarn")}</Notice>}
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={run}>{t("compressor.compress")}</button>
          </div>
          {busy && <Busy text={busy} />}
          {result && (
            <>
              <div className="stat-grid">
                <div className="stat"><div className="v">{size(file.size)}</div><div className="k">{t("compressor.original")}</div></div>
                <div className="stat"><div className="v" data-testid="pdf-result-size">{size(result.length)}</div><div className="k">{t("compressor.compressed")}</div></div>
                <div className="stat"><div className="v" style={{ color: saving > 0 ? "var(--success)" : undefined }}>{`${saving >= 0 ? "−" : "+"}${f.number(Math.abs(saving), { style: "percent", maximumFractionDigits: 0 })}`}</div><div className="k">{t("compressor.change")}</div></div>
              </div>
              {saving <= 0.01 && <Notice kind="info">{t(mode === "lossless" ? "compressor.notSmallerLossless" : "compressor.notSmallerStrong")}</Notice>}
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={() => downloadBlob(toBlob(result, "application/pdf"), `${baseName(file.name)}-compressed.pdf`)}><Download aria-hidden /> {t("compressor.download")}</button>
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
  const t = useT("tools-pdf");
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
      const rendered = await renderPdfPages(await readBytes(file), { scale: Number(dpi) / 72, type, quality: 0.92, onPage: (p, total) => setBusy(t("common.renderingPage", { page: p.index + 1, total })) });
      setOut(rendered.map((r) => ({ name: `${baseName(file.name)}-page-${r.index + 1}.${ext}`, url: URL.createObjectURL(r.blob), blob: r.blob })));
    } catch (e) {
      setError(errText(t, e));
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept="application/pdf,.pdf" onFiles={(f) => (setOut([]), pick(f))} label={file ? file.name : t("common.dropLabel")} hint={pages ? t("common.pagesChange", { count: pages }) : t("toImage.dropHint")} testId="pdf-input" />
      {error && <Notice kind="error">{error}</Notice>}
      {file && (
        <>
          <div className="row">
            <Segmented label={t("toImage.format")} value={type} onChange={setType} options={[{ value: "image/jpeg", label: "JPG" }, { value: "image/png", label: "PNG" }]} />
            <Segmented label={t("toImage.resolution")} value={dpi} onChange={setDpi} options={(["72", "150", "300"] as const).map((v) => ({ value: v, label: t("toImage.dpi", { value: Number(v) }) }))} />
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={run}>{t("toImage.convert", { count: pages ?? 0 })}</button>
          </div>
          {pages && pages > 50 && dpi === "300" && <Notice kind="warn">{t("toImage.memoryWarn")}</Notice>}
        </>
      )}
      {busy && <Busy text={busy} />}
      {out.length > 0 && (
        <div className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong data-testid="image-count">{t("toImage.count", { count: out.length })}</strong>
            <button type="button" className="btn btn-sm" onClick={async () => downloadZip(await Promise.all(out.map(async (o) => ({ name: o.name, bytes: new Uint8Array(await o.blob.arrayBuffer()) }))), `${baseName(file!.name)}-images.zip`)}><Archive aria-hidden /> {t("common.downloadZip")}</button>
          </div>
          <div className="page-grid">
            {out.map((o, i) => (
              <figure key={o.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.url} alt={t("toImage.page", { page: i + 1 })} loading="lazy" />
                <a className="link" href={o.url} download={o.name} onClick={() => announceDownload(o.name)}>{t("toImage.page", { page: i + 1 })}</a>
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
    throw new UserError("errors.imageOpen", { name: file.name }, `${file.name} couldn't be opened as an image.`);
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
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new UserError("errors.encodeFailed", undefined, "Encoding failed."))), "image/png"));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: "png", width, height };
}

export function ImageToPdf() {
  const t = useT("tools-pdf");
  const fileSize = useFileSize();
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
    if (imgs.length < files.length) setError(t("imageToPdf.skipped"));
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
      setError(errText(t, e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept="image/*" multiple onFiles={add} label={t("imageToPdf.dropLabel")} hint={t("imageToPdf.dropHint")} testId="image-input" />
      {items.length > 0 && <FileOrderList items={items} onChange={(x) => (setItems(x), setDone(null))} />}
      <div className="row">
        <Segmented label={t("imageToPdf.pageSize")} value={size} onChange={setSize} options={[{ value: "a4", label: t("imageToPdf.a4") }, { value: "letter", label: t("imageToPdf.letter") }, { value: "fit", label: t("imageToPdf.imageSize") }]} />
        <Segmented label={t("imageToPdf.margin")} value={margin} onChange={setMargin} options={[{ value: "0", label: t("imageToPdf.noMargin") }, { value: "20", label: t("imageToPdf.small") }, { value: "40", label: t("imageToPdf.large") }]} />
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={!items.length || busy} onClick={build}>{busy ? <LoaderCircle className="spin" aria-hidden /> : <Download aria-hidden />} {t("imageToPdf.create")}</button>
      </div>
      {done !== null && <Notice kind="success">{t("imageToPdf.done", { count: items.length, size: fileSize(done) })}</Notice>}
    </div>
  );
}

// ── Rotate ──────────────────────────────────────────────────────────────────

export function RotatePdf() {
  const t = useT("tools-pdf");
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
      specError = errText(t, e);
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
      setError(errText(t, e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <FileDrop accept="application/pdf,.pdf" onFiles={(f) => (setDone(false), pick(f))} label={file ? file.name : t("common.dropLabel")} hint={pages ? t("common.pagesChange", { count: pages }) : t("common.processedLocally")} testId="pdf-input" />
      {error && <Notice kind="error">{error}</Notice>}
      {file && (
        <>
          <div className="row">
            <Segmented label={t("rotate.angle")} value={angle} onChange={setAngle} options={[{ value: "90", label: t("rotate.right") }, { value: "180", label: t("rotate.half") }, { value: "270", label: t("rotate.left") }]} />
            <Segmented label={t("rotate.pages")} value={which} onChange={setWhich} options={[{ value: "all", label: t("rotate.all") }, { value: "some", label: t("rotate.some") }]} />
          </div>
          {which === "some" && (
            <Field label={t("rotate.pagesLabel")} htmlFor="rot-spec" hint={specError ? <span style={{ color: "var(--danger)" }}>{specError}</span> : t("rotate.hint")}>
              <input id="rot-spec" className="input mono" value={spec} onChange={(e) => setSpec(e.target.value)} />
            </Field>
          )}
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={busy || !!specError} onClick={run}><Download aria-hidden /> {t("rotate.run")}</button>
          </div>
          {done && <Notice kind="success">{t("rotate.done")}</Notice>}
        </>
      )}
    </div>
  );
}
