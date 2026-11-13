/**
 * Client-side URL recognition for the universal downloader.
 *
 * This gives instant feedback ("Instagram Reel detected") and rejects obvious
 * junk before any request is made. It is NOT a security boundary: the
 * downloader backend repeats validation, enforces its own domain allowlist and
 * checks resolved IP addresses on every redirect (SSRF protection).
 */

export type PlatformId = "instagram" | "tiktok" | "youtube" | "facebook" | "x" | "pinterest" | "reddit" | "vimeo" | "dailymotion" | "twitch" | "soundcloud" | "bluesky" | "streamable" | "9gag" | "kick" | "linkedin" | "medal" | "mixcloud" | "imgur";

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  toolSlug: string;
}

export const PLATFORMS: Record<PlatformId, PlatformInfo> = {
  instagram: { id: "instagram", name: "Instagram", toolSlug: "instagram-downloader" },
  tiktok: { id: "tiktok", name: "TikTok", toolSlug: "tiktok-downloader" },
  youtube: { id: "youtube", name: "YouTube", toolSlug: "youtube-downloader" },
  facebook: { id: "facebook", name: "Facebook", toolSlug: "facebook-downloader" },
  x: { id: "x", name: "X (Twitter)", toolSlug: "x-video-downloader" },
  pinterest: { id: "pinterest", name: "Pinterest", toolSlug: "pinterest-downloader" },
  reddit: { id: "reddit", name: "Reddit", toolSlug: "reddit-downloader" },
  vimeo: { id: "vimeo", name: "Vimeo", toolSlug: "social-media-downloader" },
  dailymotion: { id: "dailymotion", name: "Dailymotion", toolSlug: "social-media-downloader" },
  twitch: { id: "twitch", name: "Twitch", toolSlug: "social-media-downloader" },
  soundcloud: { id: "soundcloud", name: "SoundCloud", toolSlug: "social-media-downloader" },
  bluesky: { id: "bluesky", name: "Bluesky", toolSlug: "social-media-downloader" },
  streamable: { id: "streamable", name: "Streamable", toolSlug: "social-media-downloader" },
  "9gag": { id: "9gag", name: "9GAG", toolSlug: "social-media-downloader" },
  kick: { id: "kick", name: "Kick", toolSlug: "social-media-downloader" },
  linkedin: { id: "linkedin", name: "LinkedIn", toolSlug: "social-media-downloader" },
  medal: { id: "medal", name: "Medal", toolSlug: "social-media-downloader" },
  mixcloud: { id: "mixcloud", name: "Mixcloud", toolSlug: "social-media-downloader" },
  imgur: { id: "imgur", name: "Imgur", toolSlug: "social-media-downloader" },
};

export type Detection =
  | { ok: true; platform: PlatformInfo; contentType: string; url: string }
  | { ok: false; reason: "empty" | "invalid" | "unsafe" | "unsupported-platform" | "unsupported-content"; message: string; platform?: PlatformInfo };

const HOSTS: Array<[PlatformId, (h: string) => boolean]> = [
  ["instagram", (h) => is(h, "instagram.com") || h === "instagr.am"],
  ["tiktok", (h) => is(h, "tiktok.com")],
  ["youtube", (h) => is(h, "youtube.com") || h === "youtu.be" || is(h, "youtube-nocookie.com")],
  ["facebook", (h) => is(h, "facebook.com") || h === "fb.watch" || h === "fb.com"],
  ["x", (h) => is(h, "x.com") || is(h, "twitter.com")],
  ["pinterest", (h) => /(^|\.)pinterest\.(com|co\.uk|ca|com\.au|de|fr|es|it|jp|com\.mx|ph|nz|ie|at|ch|pt|se|dk|cl|ru)$/.test(h) || h === "pin.it"],
  ["reddit", (h) => is(h, "reddit.com") || h === "redd.it" || h === "v.redd.it" || h === "i.redd.it"],
  ["vimeo", (h) => is(h, "vimeo.com")],
  ["dailymotion", (h) => is(h, "dailymotion.com") || h === "dai.ly"],
  ["twitch", (h) => is(h, "twitch.tv")],
  ["soundcloud", (h) => is(h, "soundcloud.com")],
  ["bluesky", (h) => h === "bsky.app" || h === "www.bsky.app"],
  ["streamable", (h) => is(h, "streamable.com")],
  ["9gag", (h) => is(h, "9gag.com")],
  ["kick", (h) => is(h, "kick.com")],
  ["linkedin", (h) => is(h, "linkedin.com")],
  ["medal", (h) => is(h, "medal.tv")],
  ["mixcloud", (h) => is(h, "mixcloud.com")],
  ["imgur", (h) => is(h, "imgur.com") || is(h, "imgur.io")],
];

/** Platforms that can't work from our servers right now: refused before any request (see docs/PLATFORM_DIAGNOSTICS.md). */
const UNAVAILABLE: Partial<Record<PlatformId, string>> = {
  // To re-enable YouTube once it works from the server: remove this line, unhide the
  // youtube-downloader tool and add it back to platform-status.ts (the backend keeps its adapter).
  youtube: "YouTube downloads aren't available: YouTube asks our server to sign in to prove it isn't a bot, and we don't use accounts to get around this.",
  reddit: "Reddit downloads aren't available: Reddit currently refuses requests from our server. We don't use accounts to get around this.",
  vimeo: "Vimeo downloads aren't available: Vimeo now requires an account or serves DRM-protected streams to servers.",
};

function is(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Find the first http(s) URL in pasted text ("Check this out https://…"). */
export function extractUrl(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/https?:\/\/[^\s<>"']+/i);
  if (m) return m[0].replace(/[),.;!?]+$/, "");
  return trimmed;
}

export function detectUrl(input: string): Detection {
  const candidate = extractUrl(input);
  if (!candidate) return { ok: false, reason: "empty", message: "Paste a link to get started." };

  if (/^(javascript|data|file|ftp|blob|about|vbscript|chrome|view-source):/i.test(candidate)) {
    return { ok: false, reason: "unsafe", message: "Only http and https links are supported." };
  }
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
  } catch {
    return { ok: false, reason: "invalid", message: "That doesn't look like a valid link. Copy the full URL from the app's Share menu." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "unsafe", message: "Only http and https links are supported." };
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.username || url.password || (url.port && url.port !== "443" && url.port !== "80") || IPV4.test(host) || host.includes(":") || host === "localhost" || !host.includes(".")) {
    return { ok: false, reason: "unsafe", message: "This link points to an address that can't be used. Paste a public link from a supported platform." };
  }

  const match = HOSTS.find(([, test]) => test(host));
  if (!match) {
    return {
      ok: false,
      reason: "unsupported-platform",
      message: `${host} isn't a supported platform yet. Supported: ${Object.values(PLATFORMS).filter((p) => !UNAVAILABLE[p.id]).map((p) => p.name.replace(" (Twitter)", "")).join(", ")}.`,
    };
  }
  const platform = PLATFORMS[match[0]];
  const unavailable = UNAVAILABLE[platform.id];
  if (unavailable) return { ok: false, reason: "unsupported-content", message: unavailable, platform };
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const content = contentType(platform.id, host, path, url);
  if ("unsupported" in content) {
    return { ok: false, reason: "unsupported-content", message: content.unsupported, platform };
  }
  return { ok: true, platform, contentType: content.type, url: url.toString() };
}

type ContentResult = { type: string } | { unsupported: string };

function contentType(id: PlatformId, host: string, path: string, url: URL): ContentResult {
  const p = path.toLowerCase();
  switch (id) {
    case "instagram":
      if (/^\/(stories|s)\//.test(p)) return { unsupported: "Instagram Stories require logging in, so they can't be downloaded. Use a public post or Reel link instead." };
      if (/^\/([\w.]+\/)?(reel|reels)\/[\w-]+/.test(p)) return { type: "Reel" };
      if (/^\/([\w.]+\/)?tv\/[\w-]+/.test(p)) return { type: "Video" };
      if (/^\/([\w.]+\/)?p\/[\w-]+/.test(p)) return { type: "Post (photo, video or carousel)" };
      if (/^\/[\w.]+$/.test(p) && !["/explore", "/accounts"].includes(p)) return { unsupported: "That's a profile link. Open a specific post or Reel and copy its link." };
      return { unsupported: "Paste the link of a specific Instagram post or Reel." };
    case "tiktok":
      if (/^\/@[\w.-]+\/video\/\d+/.test(p)) return { type: "Video" };
      if (/^\/@[\w.-]+\/photo\/\d+/.test(p)) return { type: "Photo post" };
      if (host.startsWith("vm.") || host.startsWith("vt.") || /^\/t\/[\w-]+/.test(p)) return { type: "Short link" };
      if (/^\/@[\w.-]+$/.test(p)) return { unsupported: "That's a profile link. Open a specific video and copy its link." };
      return { unsupported: "Paste the link of a specific TikTok video or photo post." };
    case "youtube":
      if (host === "youtu.be" && p.length > 1) return { type: "Video" };
      if (/^\/shorts\/[\w-]+/.test(p)) return { type: "Short" };
      if (p === "/watch" && url.searchParams.get("v")) return { type: "Video" };
      if (/^\/(live|embed|v)\/[\w-]+/.test(p)) return { type: "Video" };
      if (p === "/playlist") return { unsupported: "Playlists aren't supported. Paste the link of an individual video." };
      return { unsupported: "Paste the link of a specific YouTube video or Short." };
    case "facebook":
      if (host === "fb.watch") return { type: "Video" };
      if (/\/reel\/\d+/.test(p) || /^\/share\/r\//.test(p)) return { type: "Reel" };
      if (/\/videos\//.test(p) || p === "/watch" || /^\/share\/v\//.test(p)) return { type: "Video" };
      return { unsupported: "Paste the link of a specific public Facebook video or Reel." };
    case "x":
      if (/^\/[\w]+\/status\/\d+/.test(p) || /^\/i\/status\/\d+/.test(p)) return { type: "Post video or GIF" };
      return { unsupported: "Paste the link of a specific post that contains a video or GIF." };
    case "pinterest":
      if (host === "pin.it") return { type: "Pin (short link)" };
      if (/^\/pin\/[\w-]+/.test(p)) return { type: "Pin" };
      return { unsupported: "Paste the link of a specific pin." };
    case "reddit":
      if (host === "v.redd.it" || host === "redd.it" || host === "i.redd.it") return { type: "Media" };
      if (/\/comments\/\w+/.test(p) || /^\/r\/\w+\/s\/\w+/.test(p)) return { type: "Post" };
      return { unsupported: "Paste the link of a specific Reddit post." };
    case "vimeo":
      if (/^\/(\d+|channels\/[\w-]+\/\d+|video\/\d+)/.test(p)) return { type: "Video" };
      return { unsupported: "Paste the link of a specific Vimeo video." };
    case "dailymotion":
      if ((host === "dai.ly" && /^\/[a-z0-9]{5,}$/.test(p)) || /^\/video\/[a-z0-9]{5,}/.test(p)) return { type: "Video" };
      return { unsupported: "Paste the link of a specific Dailymotion video." };
    case "twitch":
      if ((host === "clips.twitch.tv" && /^\/[\w-]{6,}$/.test(path)) || /^\/\w+\/clip\/[\w-]{6,}$/.test(path)) return { type: "Clip" };
      return { unsupported: "Only Twitch clips are supported (not live streams or full broadcasts). Paste a clip link." };
    case "soundcloud":
      if (host === "on.soundcloud.com") return { type: "Short link" };
      if (/^\/[\w-]+\/sets\//.test(p)) return { unsupported: "Playlists aren't supported. Paste the link of a single track." };
      if (/^\/[\w-]+\/[\w-]+$/.test(p) && !/^\/[\w-]+\/(tracks|albums|reposts|likes|followers|following|popular-tracks|comments|spotlight)$/.test(p)) return { type: "Track" };
      return { unsupported: "Paste the link of a specific SoundCloud track." };
    case "bluesky":
      if (/^\/profile\/[\w.:-]+\/post\/\w+$/.test(path)) return { type: "Post" };
      return { unsupported: "Paste the link of a specific Bluesky post with a video." };
    case "streamable":
      if (/^\/(e\/|o\/|s\/)?[a-z0-9]{3,}$/.test(p)) return { type: "Video" };
      return { unsupported: "Paste the link of a specific Streamable video." };
    case "9gag":
      if (/^\/gag\/[a-z0-9]{5,}$/i.test(path)) return { type: "Post" };
      return { unsupported: "Paste the link of a specific 9GAG post." };
    case "kick":
      if (/^\/[\w-]+\/clips\/clip_[a-z0-9]{10,}$/i.test(path) || /^clip_[a-z0-9]{10,}$/i.test(url.searchParams.get("clip") || "")) return { type: "Clip" };
      return { unsupported: "Only Kick clips are supported (not live streams or VODs). Paste a clip link." };
    case "linkedin":
      if (/^\/posts\/[\w%.-]+$/.test(path) || /^\/feed\/update\/urn:li:(activity|ugcPost):\d+$/.test(path)) return { type: "Post video" };
      return { unsupported: "Paste the link of a public LinkedIn post that contains a video." };
    case "medal":
      if (/^\/(games\/[\w-]+\/clips|clips?)\/[\w-]{6,}/.test(path)) return { type: "Clip" };
      return { unsupported: "Paste the link of a specific Medal clip." };
    case "mixcloud":
      if (/^\/[\w.-]+\/[\w.%-]+$/.test(path) && !/^\/[\w.-]+\/(uploads|favorites|listens|playlists|followers|following|stream|reposts)$/.test(path) && !/^\/(discover|live|select)\//.test(path))
        return { type: "Show (audio)" };
      return { unsupported: "Paste the link of a specific Mixcloud show." };
    case "imgur":
      if (host === "i.imgur.com" && /^\/[a-z0-9]{5,8}\.(gifv|mp4|jpe?g|png|gif|webp)$/i.test(path)) return { type: "Media" };
      if (/^\/(a|gallery)\/[\w-]{5,}$/.test(path)) return { type: "Album" };
      if (/^\/(?:[\w-]+-)?[a-z0-9]{5,8}$/i.test(path)) return { type: "Post" };
      return { unsupported: "Paste the link of a specific Imgur post or album." };
  }
}

/** Why a platform is refused up front (undefined when it is available). */
export const unavailableMessage = (id?: string): string | undefined => (id ? UNAVAILABLE[id as PlatformId] : undefined);
