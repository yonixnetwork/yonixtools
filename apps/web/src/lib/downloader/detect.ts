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
  twitch: { id: "twitch", name: "Twitch", toolSlug: "twitch-clip-downloader" },
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

/**
 * Detected content types. `contentType` is the English label; the UI shows
 * t(contentTypeKey) from the "downloader" namespace ("contentType.<id>").
 */
export const CONTENT_TYPES = {
  reel: "Reel",
  video: "Video",
  postAny: "Post (photo, video or carousel)",
  photoPost: "Photo post",
  shortLink: "Short link",
  short: "Short",
  postVideoOrGif: "Post video or GIF",
  pinShortLink: "Pin (short link)",
  pin: "Pin",
  media: "Media",
  post: "Post",
  clip: "Clip",
  track: "Track",
  postVideo: "Post video",
  showAudio: "Show (audio)",
  album: "Album",
} as const;
export type ContentTypeId = keyof typeof CONTENT_TYPES;

/** Detection messages in English (tests, logs). The UI shows t(key, vars): "detect.<id>" in the "downloader" namespace. */
export const DETECT_MESSAGES = {
  empty: "Paste a link to get started.",
  unsafeScheme: "Only http and https links are supported.",
  invalid: "That doesn't look like a valid link. Copy the full URL from the app's Share menu.",
  unsafeAddress: "This link points to an address that can't be used. Paste a public link from a supported platform.",
  unsupportedPlatform: "{host} isn't a supported platform yet. Supported: {platforms}.",
  instagramStories: "Instagram Stories require logging in, so they can't be downloaded. Use a public post or Reel link instead.",
  instagramProfile: "That's a profile link. Open a specific post or Reel and copy its link.",
  instagramPost: "Paste the link of a specific Instagram post or Reel.",
  tiktokProfile: "That's a profile link. Open a specific video and copy its link.",
  tiktokPost: "Paste the link of a specific TikTok video or photo post.",
  youtubePlaylist: "Playlists aren't supported. Paste the link of an individual video.",
  youtubeVideo: "Paste the link of a specific YouTube video or Short.",
  facebookVideo: "Paste the link of a specific public Facebook video or Reel.",
  xPost: "Paste the link of a specific post that contains a video or GIF.",
  pinterestPin: "Paste the link of a specific pin.",
  redditPost: "Paste the link of a specific Reddit post.",
  vimeoVideo: "Paste the link of a specific Vimeo video.",
  dailymotionVideo: "Paste the link of a specific Dailymotion video.",
  twitchClip: "Only Twitch clips are supported (not live streams or full broadcasts). Paste a clip link.",
  soundcloudPlaylist: "Playlists aren't supported. Paste the link of a single track.",
  soundcloudTrack: "Paste the link of a specific SoundCloud track.",
  blueskyPost: "Paste the link of a specific Bluesky post with a video.",
  streamableVideo: "Paste the link of a specific Streamable video.",
  ninegagPost: "Paste the link of a specific 9GAG post.",
  kickClip: "Only Kick clips are supported (not live streams or VODs). Paste a clip link.",
  linkedinPost: "Paste the link of a public LinkedIn post that contains a video.",
  medalClip: "Paste the link of a specific Medal clip.",
  mixcloudShow: "Paste the link of a specific Mixcloud show.",
  imgurPost: "Paste the link of a specific Imgur post or album.",
} as const;
export type DetectMessageId = keyof typeof DETECT_MESSAGES;

export type Detection =
  | { ok: true; platform: PlatformInfo; contentType: string; contentTypeKey: string; url: string }
  | {
      ok: false;
      reason: "empty" | "invalid" | "unsafe" | "unsupported-platform" | "unsupported-content";
      /** English. Show t(key, vars) from the "downloader" namespace instead. */
      message: string;
      key: string;
      vars?: Record<string, string>;
      platform?: PlatformInfo;
    };

type Failure = Extract<Detection, { ok: false }>;
function fail(reason: Failure["reason"], id: DetectMessageId, vars?: Record<string, string>, platform?: PlatformInfo): Failure {
  const message = (DETECT_MESSAGES[id] as string).replace(/\{(\w+)\}/g, (all, k: string) => vars?.[k] ?? all);
  return { ok: false, reason, message, key: `detect.${id}`, ...(vars ? { vars } : {}), ...(platform ? { platform } : {}) };
}

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

/**
 * Platforms that can't work from our servers right now: refused before any request (see docs/PLATFORM_DIAGNOSTICS.md).
 * English; translated text: "unavailable.<platform>" in the "downloader" namespace (unavailableMessageKey).
 */
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
  if (!candidate) return fail("empty", "empty");

  if (/^(javascript|data|file|ftp|blob|about|vbscript|chrome|view-source):/i.test(candidate)) {
    return fail("unsafe", "unsafeScheme");
  }
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
  } catch {
    return fail("invalid", "invalid");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return fail("unsafe", "unsafeScheme");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.username || url.password || (url.port && url.port !== "443" && url.port !== "80") || IPV4.test(host) || host.includes(":") || host === "localhost" || !host.includes(".")) {
    return fail("unsafe", "unsafeAddress");
  }

  const match = HOSTS.find(([, test]) => test(host));
  if (!match) {
    const platforms = Object.values(PLATFORMS).filter((p) => !UNAVAILABLE[p.id]).map((p) => p.name.replace(" (Twitter)", "")).join(", ");
    return fail("unsupported-platform", "unsupportedPlatform", { host, platforms });
  }
  const platform = PLATFORMS[match[0]];
  const unavailable = UNAVAILABLE[platform.id];
  if (unavailable) return { ok: false, reason: "unsupported-content", message: unavailable, key: unavailableMessageKey(platform.id)!, platform };
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const content = contentType(platform.id, host, path, url);
  if ("unsupported" in content) {
    return fail("unsupported-content", content.unsupported, undefined, platform);
  }
  return { ok: true, platform, contentType: CONTENT_TYPES[content.type], contentTypeKey: `contentType.${content.type}`, url: url.toString() };
}

type ContentResult = { type: ContentTypeId } | { unsupported: DetectMessageId };

function contentType(id: PlatformId, host: string, path: string, url: URL): ContentResult {
  const p = path.toLowerCase();
  switch (id) {
    case "instagram":
      if (/^\/(stories|s)\//.test(p)) return { unsupported: "instagramStories" };
      if (/^\/([\w.]+\/)?(reel|reels)\/[\w-]+/.test(p)) return { type: "reel" };
      if (/^\/([\w.]+\/)?tv\/[\w-]+/.test(p)) return { type: "video" };
      if (/^\/([\w.]+\/)?p\/[\w-]+/.test(p)) return { type: "postAny" };
      if (/^\/[\w.]+$/.test(p) && !["/explore", "/accounts"].includes(p)) return { unsupported: "instagramProfile" };
      return { unsupported: "instagramPost" };
    case "tiktok":
      if (/^\/@[\w.-]+\/video\/\d+/.test(p)) return { type: "video" };
      if (/^\/@[\w.-]+\/photo\/\d+/.test(p)) return { type: "photoPost" };
      if (host.startsWith("vm.") || host.startsWith("vt.") || /^\/t\/[\w-]+/.test(p)) return { type: "shortLink" };
      if (/^\/@[\w.-]+$/.test(p)) return { unsupported: "tiktokProfile" };
      return { unsupported: "tiktokPost" };
    case "youtube":
      if (host === "youtu.be" && p.length > 1) return { type: "video" };
      if (/^\/shorts\/[\w-]+/.test(p)) return { type: "short" };
      if (p === "/watch" && url.searchParams.get("v")) return { type: "video" };
      if (/^\/(live|embed|v)\/[\w-]+/.test(p)) return { type: "video" };
      if (p === "/playlist") return { unsupported: "youtubePlaylist" };
      return { unsupported: "youtubeVideo" };
    case "facebook":
      if (host === "fb.watch") return { type: "video" };
      if (/\/reel\/\d+/.test(p) || /^\/share\/r\//.test(p)) return { type: "reel" };
      if (/\/videos\//.test(p) || p === "/watch" || /^\/share\/v\//.test(p)) return { type: "video" };
      return { unsupported: "facebookVideo" };
    case "x":
      if (/^\/[\w]+\/status\/\d+/.test(p) || /^\/i\/status\/\d+/.test(p)) return { type: "postVideoOrGif" };
      return { unsupported: "xPost" };
    case "pinterest":
      if (host === "pin.it") return { type: "pinShortLink" };
      if (/^\/pin\/[\w-]+/.test(p)) return { type: "pin" };
      return { unsupported: "pinterestPin" };
    case "reddit":
      if (host === "v.redd.it" || host === "redd.it" || host === "i.redd.it") return { type: "media" };
      if (/\/comments\/\w+/.test(p) || /^\/r\/\w+\/s\/\w+/.test(p)) return { type: "post" };
      return { unsupported: "redditPost" };
    case "vimeo":
      if (/^\/(\d+|channels\/[\w-]+\/\d+|video\/\d+)/.test(p)) return { type: "video" };
      return { unsupported: "vimeoVideo" };
    case "dailymotion":
      if ((host === "dai.ly" && /^\/[a-z0-9]{5,}$/.test(p)) || /^\/video\/[a-z0-9]{5,}/.test(p)) return { type: "video" };
      return { unsupported: "dailymotionVideo" };
    case "twitch":
      if ((host === "clips.twitch.tv" && /^\/[\w-]{6,}$/.test(path)) || /^\/\w+\/clip\/[\w-]{6,}$/.test(path)) return { type: "clip" };
      return { unsupported: "twitchClip" };
    case "soundcloud":
      if (host === "on.soundcloud.com") return { type: "shortLink" };
      if (/^\/[\w-]+\/sets\//.test(p)) return { unsupported: "soundcloudPlaylist" };
      if (/^\/[\w-]+\/[\w-]+$/.test(p) && !/^\/[\w-]+\/(tracks|albums|reposts|likes|followers|following|popular-tracks|comments|spotlight)$/.test(p)) return { type: "track" };
      return { unsupported: "soundcloudTrack" };
    case "bluesky":
      if (/^\/profile\/[\w.:-]+\/post\/\w+$/.test(path)) return { type: "post" };
      return { unsupported: "blueskyPost" };
    case "streamable":
      if (/^\/(e\/|o\/|s\/)?[a-z0-9]{3,}$/.test(p)) return { type: "video" };
      return { unsupported: "streamableVideo" };
    case "9gag":
      if (/^\/gag\/[a-z0-9]{5,}$/i.test(path)) return { type: "post" };
      return { unsupported: "ninegagPost" };
    case "kick":
      if (/^\/[\w-]+\/clips\/clip_[a-z0-9]{10,}$/i.test(path) || /^clip_[a-z0-9]{10,}$/i.test(url.searchParams.get("clip") || "")) return { type: "clip" };
      return { unsupported: "kickClip" };
    case "linkedin":
      if (/^\/posts\/[\w%.-]+$/.test(path) || /^\/feed\/update\/urn:li:(activity|ugcPost):\d+$/.test(path)) return { type: "postVideo" };
      return { unsupported: "linkedinPost" };
    case "medal":
      if (/^\/(games\/[\w-]+\/clips|clips?)\/[\w-]{6,}/.test(path)) return { type: "clip" };
      return { unsupported: "medalClip" };
    case "mixcloud":
      if (/^\/[\w.-]+\/[\w.%-]+$/.test(path) && !/^\/[\w.-]+\/(uploads|favorites|listens|playlists|followers|following|stream|reposts)$/.test(path) && !/^\/(discover|live|select)\//.test(path))
        return { type: "showAudio" };
      return { unsupported: "mixcloudShow" };
    case "imgur":
      if (host === "i.imgur.com" && /^\/[a-z0-9]{5,8}\.(gifv|mp4|jpe?g|png|gif|webp)$/i.test(path)) return { type: "media" };
      if (/^\/(a|gallery)\/[\w-]{5,}$/.test(path)) return { type: "album" };
      if (/^\/(?:[\w-]+-)?[a-z0-9]{5,8}$/i.test(path)) return { type: "post" };
      return { unsupported: "imgurPost" };
  }
}

/** Why a platform is refused up front (undefined when it is available). English; see unavailableMessageKey. */
export const unavailableMessage = (id?: string): string | undefined => (id ? UNAVAILABLE[id as PlatformId] : undefined);

/** "downloader" namespace key ("unavailable.<platform>") of unavailableMessage, or null when the platform is available. */
export const unavailableMessageKey = (id?: string): string | null => (id && UNAVAILABLE[id as PlatformId] ? `unavailable.${id}` : null);
