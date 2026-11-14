import type { Translator } from "@/i18n/translator";
import type { Job } from "./client";

/** What one clicked quality is doing, as shown next to it. */
export type Phase = "queued" | "downloading" | "processing" | "starting" | "started" | "requested" | "failed" | "cancelled";
export const ACTIVE_PHASES: readonly Phase[] = ["queued", "downloading", "processing", "starting"];

/** English (logs/tests); the UI uses phaseLabel. */
export function phaseText(t: { phase: Phase; progress?: number }): string {
  switch (t.phase) {
    case "queued":
      return "Preparing…";
    case "downloading":
      return t.progress != null && t.progress > 0 ? `Downloading ${Math.round(t.progress)}%` : "Downloading…";
    case "processing":
      return "Processing…";
    case "starting":
      return "Starting download…";
    case "started":
      return "Download started";
    case "requested":
      return "Download requested";
    case "cancelled":
      return "Cancelled";
    default:
      return "Failed";
  }
}

/** phaseText in the visitor's language, with a translator for the "downloader" namespace. */
export function phaseLabel(tr: Translator, t: { phase: Phase; progress?: number }): string {
  switch (t.phase) {
    case "downloading":
      return t.progress != null && t.progress > 0 ? tr("phase.downloadingPercent", { percent: Math.round(t.progress) }) : tr("phase.downloading");
    case "queued":
    case "processing":
    case "starting":
    case "started":
    case "requested":
    case "cancelled":
      return tr(`phase.${t.phase}`);
    default:
      return tr("phase.failed");
  }
}

/** Map a backend job to a display phase (older backends send no `phase`). */
export function jobPhase(j: Pick<Job, "status" | "phase">): Phase {
  if (j.phase === "processing") return "processing";
  if (j.phase === "downloading") return "downloading";
  if (j.phase === "queued") return "queued";
  return j.status === "running" ? "downloading" : "queued";
}
