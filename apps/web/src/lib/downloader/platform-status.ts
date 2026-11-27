import type { Translator } from "@/i18n/translator";
import type { PlatformId } from "./detect";

/**
 * What each platform really does today, from real downloads in the live
 * platform matrix (.github/workflows/live-platforms.yml) run from a cloud
 * server, as the production server is. Update only from new evidence; see
 * docs/PLATFORM_DIAGNOSTICS.md.
 */
export type PlatformState = "working" | "limited" | "blocked";

export interface PlatformStatus {
  id: PlatformId;
  state: PlatformState;
  /** What can be downloaded. (Not listed: Reddit and Vimeo refuse our server; Imgur answers the production server with HTTP 429.) */
  content: string;
  /** Honest, short note for users. English; translated text: platformStatusText / platformStatusKeys ("downloader" namespace). */
  note: string;
}

export const VERIFIED_ON = "7 November 2026";
/** VERIFIED_ON as an ISO date, for f.date / formatDate in the visitor's language. */
export const VERIFIED_ON_DATE = "2026-11-07";

export const PLATFORM_STATUS: PlatformStatus[] = [
  { id: "tiktok", state: "working", content: "Videos, photo posts", note: "Clean (no-watermark) file when TikTok provides one. A few posts are region-locked." },
  { id: "instagram", state: "working", content: "Reels, videos, single photos, carousels and mixed posts", note: "Every photo and video of a post, each with its own download, or several as a ZIP. Stories need a login, so they're not supported." },
  { id: "facebook", state: "working", content: "Public videos and Reels", note: "Some videos are only served to logged-in users and can't be downloaded." },
  { id: "x", state: "working", content: "Videos and GIFs in posts", note: "Posts marked sensitive or from protected accounts need a login." },
  { id: "pinterest", state: "working", content: "Video pins and image pins", note: "Original image size when available." },
  { id: "dailymotion", state: "working", content: "Videos", note: "Public videos." },
  { id: "twitch", state: "working", content: "Clips", note: "Clips only; live streams and full broadcasts aren't supported." },
  { id: "soundcloud", state: "working", content: "Tracks (audio)", note: "Tracks the artist makes publicly streamable." },
  { id: "bluesky", state: "working", content: "Videos in posts", note: "Public posts." },
  { id: "streamable", state: "working", content: "Videos", note: "Public videos." },
  { id: "linkedin", state: "working", content: "Videos in public posts", note: "Posts visible without signing in." },
  { id: "kick", state: "working", content: "Clips", note: "Clips only; live streams and VODs aren't supported." },
  { id: "medal", state: "working", content: "Game clips", note: "Public clips." },
  { id: "mixcloud", state: "working", content: "Shows (audio)", note: "Public shows, as original audio or MP3." },
  { id: "9gag", state: "working", content: "Videos and GIFs", note: "Public posts." },
];

export const STATE_LABEL: Record<PlatformState, string> = { working: "Working", limited: "Limited", blocked: "Blocked by platform" };

/** "downloader" namespace keys for STATE_LABEL. */
export const STATE_LABEL_KEY: Record<PlatformState, string> = { working: "status.state.working", limited: "status.state.limited", blocked: "status.state.blocked" };

/** "downloader" namespace keys of a platform's `content` and `note`. */
export const platformStatusKeys = (p: Pick<PlatformStatus, "id">) => ({ content: `status.${p.id}.content`, note: `status.${p.id}.note` });

/** A platform's state label, content and note in the visitor's language (translator for the "downloader" namespace). */
export function platformStatusText(t: Translator, p: Pick<PlatformStatus, "id" | "state">) {
  const k = platformStatusKeys(p);
  return { state: t(STATE_LABEL_KEY[p.state]), content: t(k.content), note: t(k.note) };
}
