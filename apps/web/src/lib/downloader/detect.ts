/**
 * Client-side URL recognition for the universal downloader.
 *
 * This gives instant feedback ("Instagram Reel detected") and rejects obvious
 * junk before any request is made. It is NOT a security boundary: the
 * downloader backend repeats validation, enforces its own domain allowlist and
 * checks resolved IP addresses on every redirect (SSRF protection).
 */

export type PlatformId = "instagram" | "tiktok" | "youtube" | "facebook" | "x" | "pinterest" | "reddit" | "vimeo";

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
];

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
      message: `${host} isn't a supported platform yet. Supported: Instagram, TikTok, YouTube, Facebook, X, Pinterest, Reddit and Vimeo.`,
    };
  }
  const platform = PLATFORMS[match[0]];
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
  }
}
