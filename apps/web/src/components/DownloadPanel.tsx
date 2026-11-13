"use client";
import { CircleCheck, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { AdPlacement } from "./AdPlacement";
import type { Transfer } from "./Downloader";
import { ACTIVE_PHASES, phaseText } from "@/lib/downloader/phases";

/**
 * Shown while a chosen file is being prepared on the server (owner request, 12 Nov 2026).
 * Rules it keeps:
 *  - no added waiting: it only reflects the real preparation; the browser download starts
 *    the moment the file is ready, whatever the ad does;
 *  - never forced: it doesn't block the page; "Hide" keeps the download going, "Cancel"
 *    stops it; after the download starts it stays until the visitor closes it;
 *  - one clearly labelled ad from the isolated ad origin, apart from the buttons (placement
 *    "downloader.panel" in lib/ads/placements.ts). If no ad is available the space collapses.
 */
export function DownloadPanel({ transfer: t, onCancel, onClose }: { transfer: Transfer; onCancel: () => void; onClose: () => void }) {
  const active = ACTIVE_PHASES.includes(t.phase);
  const done = t.phase === "started" || t.phase === "requested";
  const pct = t.phase === "downloading" && t.progress ? Math.round(t.progress) : null;
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = active ? "Preparing your download" : done ? "Download started" : t.phase === "cancelled" ? "Download cancelled" : "Download failed";
  return (
    <div className="dl-panel" role="dialog" aria-modal="false" aria-labelledby="dl-panel-title" data-testid="download-panel" data-phase={t.phase}>
      <div className="dl-panel-head">
        <strong id="dl-panel-title">{title}</strong>
        <button type="button" className="icon-button" aria-label={active ? "Hide panel (the download continues)" : "Close panel"} onClick={onClose}>
          <X aria-hidden />
        </button>
      </div>
      <p className="dl-panel-file">
        <span>{t.title}</span> <span className="muted">· {t.label}</span>
      </p>
      <div className="dl-panel-status" role="status" aria-live="polite">
        {active && <LoaderCircle className="spin" aria-hidden />}
        {done && <CircleCheck aria-hidden className="ok" />}
        <span>{t.phase === "failed" ? t.message || "The download failed. Nothing was saved." : done ? "Check your browser's downloads." : phaseText(t)}</span>
      </div>
      {active && (
        <span className="dl-progress" aria-hidden>
          <span className={pct == null ? "indeterminate" : ""} style={pct == null ? undefined : { width: `${pct}%` }} />
        </span>
      )}
      {/* One labelled ad while the file is prepared (owner request); the download never waits for it. */}
      <AdPlacement page="downloader" position="download-panel" className="dl-panel-ad" />
      <div className="dl-panel-actions">
        {active ? (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel download</button>
            <button type="button" ref={primary} className="btn btn-sm" onClick={onClose}>Hide</button>
          </>
        ) : (
          <button type="button" ref={primary} className="btn btn-sm" onClick={onClose}>Close</button>
        )}
      </div>
    </div>
  );
}
