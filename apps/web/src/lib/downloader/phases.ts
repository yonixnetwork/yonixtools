import type { Job } from "./client";

/** What one clicked quality is doing, as shown next to it. */
export type Phase = "queued" | "downloading" | "processing" | "starting" | "started" | "requested" | "failed";
export const ACTIVE_PHASES: readonly Phase[] = ["queued", "downloading", "processing", "starting"];

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
    default:
      return "Failed";
  }
}

/** Map a backend job to a display phase (older backends send no `phase`). */
export function jobPhase(j: Pick<Job, "status" | "phase">): Phase {
  if (j.phase === "processing") return "processing";
  if (j.phase === "downloading") return "downloading";
  if (j.phase === "queued") return "queued";
  return j.status === "running" ? "downloading" : "queued";
}
