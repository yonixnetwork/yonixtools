"use client";
import { CircleCheck, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

/**
 * The same download panel as on the downloader pages, for the browser tools (owner request):
 * when a tool saves a file, a small non-blocking panel confirms it and shows one clearly
 * labelled ad from the isolated ad origin.
 *  - The download has already started when the panel appears: nothing waits for the ad, there is
 *    no countdown, no redirect, no new tab.
 *  - It never covers the page: a corner card (bottom sheet on phones) the visitor can close.
 *  - The ad slot loads once per page view and stays mounted while the panel is closed, so repeated
 *    downloads never reload (refresh) the ad.
 */
export function ToolDownloadPanel({ ad }: { ad: ReactNode }) {
  const [file, setFile] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onDownload = (e: Event) => {
      const name = (e as CustomEvent<{ filename?: string }>).detail?.filename;
      setFile(typeof name === "string" ? name : "");
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("ytx:download", onDownload);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("ytx:download", onDownload);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (file === null) return null; // nothing (and no ad) until the first download
  return (
    <div className="dl-panel" role="dialog" aria-modal="false" aria-labelledby="tool-dl-title" data-testid="tool-download-panel" hidden={!open}>
      <div className="dl-panel-head">
        <strong id="tool-dl-title">Download started</strong>
        <button type="button" className="icon-button" aria-label="Close panel" onClick={() => setOpen(false)}>
          <X aria-hidden />
        </button>
      </div>
      {file && <p className="dl-panel-file">{file}</p>}
      <div className="dl-panel-status" role="status" aria-live="polite">
        <CircleCheck aria-hidden className="ok" />
        <span>Check your browser&apos;s downloads.</span>
      </div>
      {ad}
      <div className="dl-panel-actions">
        <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>
  );
}
