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
  /** What can be downloaded. */
  content: string;
  /** Honest, short note for users. */
  note: string;
}

export const VERIFIED_ON = "7 November 2026";

export const PLATFORM_STATUS: PlatformStatus[] = [
  { id: "tiktok", state: "working", content: "Videos, photo posts", note: "Clean (no-watermark) file when TikTok provides one. A few posts are region-locked." },
  { id: "instagram", state: "working", content: "Reels, videos, photo and carousel posts", note: "Public posts only. Stories need a login, so they're not supported." },
  { id: "facebook", state: "working", content: "Public videos and Reels", note: "Some videos are only served to logged-in users and can't be downloaded." },
  { id: "x", state: "working", content: "Videos and GIFs in posts", note: "Posts marked sensitive or from protected accounts need a login." },
  { id: "pinterest", state: "working", content: "Video pins and image pins", note: "Original image size when available." },
  { id: "dailymotion", state: "working", content: "Videos", note: "Public videos." },
  { id: "twitch", state: "working", content: "Clips", note: "Clips only; live streams and full broadcasts aren't supported." },
  { id: "soundcloud", state: "working", content: "Tracks (audio)", note: "Tracks the artist makes publicly streamable." },
  { id: "bluesky", state: "working", content: "Videos in posts", note: "Public posts." },
  { id: "streamable", state: "working", content: "Videos", note: "Public videos." },
  { id: "vimeo", state: "blocked", content: "Videos", note: "Vimeo now requires an account, and its embed player sends servers DRM-protected streams, so Vimeo downloads don't work." },
  { id: "youtube", state: "blocked", content: "Videos and Shorts", note: "YouTube asks cloud servers to sign in to prove they aren't bots. We don't use accounts, so YouTube may not work from our server." },
  { id: "reddit", state: "blocked", content: "Videos in posts", note: "Reddit currently refuses anonymous requests from cloud servers (HTTP 403), so Reddit downloads don't work." },
];

export const STATE_LABEL: Record<PlatformState, string> = { working: "Working", limited: "Limited", blocked: "Blocked by platform" };
