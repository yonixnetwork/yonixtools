import { describe, expect, it, vi } from "vitest";
import { detectUrl, extractUrl } from "@/lib/downloader/detect";
import { createJob, DownloaderError, extractMedia, jobReady } from "@/lib/downloader/client";

const ok = (u: string) => {
  const d = detectUrl(u);
  if (!d.ok) throw new Error(`${u}: ${d.message}`);
  return [d.platform.id, d.contentType];
};

describe("URL detection", () => {
  it.each([
    ["https://www.instagram.com/reel/C9xAbCdEfGh/", "instagram", "Reel"],
    ["https://www.instagram.com/p/C9xAbCdEfGh/?img_index=2", "instagram", "Post (photo, video or carousel)"],
    ["instagram.com/someuser/reel/C9xAbCdEfGh", "instagram", "Reel"],
    ["https://www.tiktok.com/@creator.name/video/7350000000000000000", "tiktok", "Video"],
    ["https://www.tiktok.com/@creator/photo/7350000000000000001", "tiktok", "Photo post"],
    ["https://vm.tiktok.com/ZMabc123/", "tiktok", "Short link"],
    ["https://www.facebook.com/reel/1234567890", "facebook", "Reel"],
    ["https://www.facebook.com/somepage/videos/1234567890/", "facebook", "Video"],
    ["https://fb.watch/abcDEF/", "facebook", "Video"],
    ["https://www.facebook.com/share/r/1AbCdE/", "facebook", "Reel"],
    ["https://x.com/user/status/1790000000000000000", "x", "Post video or GIF"],
    ["https://twitter.com/user/status/1790000000000000000", "x", "Post video or GIF"],
    ["https://www.pinterest.com/pin/123456789/", "pinterest", "Pin"],
    ["https://pin.it/abc123", "pinterest", "Pin (short link)"],
  ])("recognises %s", (url, platform, type) => expect(ok(url)).toEqual([platform, type]));

  it("pulls the URL out of pasted share text", () => {
    expect(extractUrl("Watch this! https://youtu.be/dQw4w9WgXcQ.")).toBe("https://youtu.be/dQw4w9WgXcQ");
  });

  it.each([
    ["https://www.instagram.com/stories/someone/123/", "unsupported-content"],
    ["https://www.instagram.com/someone/", "unsupported-content"],
    ["https://www.youtube.com/playlist?list=PL123", "unsupported-content"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "unsupported-content"],
    ["https://youtu.be/dQw4w9WgXcQ", "unsupported-content"],
    ["https://example.com/video.mp4", "unsupported-platform"],
    ["https://evil-instagram.com/reel/abc", "unsupported-platform"],
    ["https://instagram.com.evil.io/reel/abc", "unsupported-platform"],
    ["http://127.0.0.1/reel/abc", "unsafe"],
    ["http://localhost:8080/", "unsafe"],
    ["http://[::1]/", "unsafe"],
    ["https://user:pass@www.instagram.com/reel/abc", "unsafe"],
    ["https://www.instagram.com:8443/reel/abc", "unsafe"],
    ["ftp://www.instagram.com/reel/abc", "unsafe"],
    ["javascript:alert(1)", "unsafe"],
    ["", "empty"],
  ])("rejects %s (%s)", (url, reason) => {
    const d = detectUrl(url);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe(reason);
  });
});

const res = (status: number, body: unknown) => Promise.resolve(new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

describe("downloader client never reports false success", () => {
  it("refuses to run without a configured backend", async () => {
    await expect(extractMedia({ baseUrl: "" }, "https://youtu.be/x")).rejects.toMatchObject({ code: "not_configured" });
  });

  it("maps backend errors to typed errors with the failing platform", async () => {
    const fetchImpl = vi.fn(() => res(422, { error: { code: "private", message: "This Instagram post is private.", platform: "instagram" } }));
    const err = await extractMedia({ baseUrl: "https://api.test", fetchImpl }, "https://instagram.com/p/x").catch((e) => e);
    expect(err).toBeInstanceOf(DownloaderError);
    expect(err).toMatchObject({ code: "private", platform: "instagram" });
  });

  it("treats a 200 with an empty or malformed body as a failure", async () => {
    for (const body of [{}, { platform: "youtube", title: "x", items: [] }, "not json"]) {
      const fetchImpl = vi.fn(() => res(200, body));
      await expect(extractMedia({ baseUrl: "https://api.test", fetchImpl }, "https://youtu.be/x")).rejects.toMatchObject({ code: "invalid_response" });
    }
  });

  it("maps network failures and HTTP 429", async () => {
    await expect(extractMedia({ baseUrl: "https://api.test", fetchImpl: vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))) }, "u")).rejects.toMatchObject({ code: "network" });
    await expect(extractMedia({ baseUrl: "https://api.test", fetchImpl: vi.fn(() => res(429, {})) }, "u")).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("only treats a finished job with a download URL as ready", async () => {
    const fetchImpl = vi.fn(() => res(200, { id: "j1", status: "done" }));
    const job = await createJob({ baseUrl: "https://api.test", fetchImpl }, "u", 0, "f");
    expect(jobReady(job)).toBe(false);
    expect(jobReady({ id: "j", status: "failed", downloadUrl: "https://x" })).toBe(false);
    expect(jobReady({ id: "j", status: "done", downloadUrl: "https://api.test/v1/jobs/j/file" })).toBe(true);
  });

  it("parses a well-formed extract result", async () => {
    const body = { platform: "youtube", title: "Clip", items: [{ index: 0, kind: "video", formats: [{ id: "18", label: "360p MP4", ext: "mp4", kind: "video" }] }] };
    const r = await extractMedia({ baseUrl: "https://api.test", fetchImpl: vi.fn(() => res(200, body)) }, "https://youtu.be/x");
    expect(r.items[0].formats[0].id).toBe("18");
  });
});

describe("download URL resolution", () => {
  it("prefixes relative paths with the API base", async () => {
    const { resolveDownloadUrl } = await import("@/lib/downloader/client");
    expect(resolveDownloadUrl("/api", "/v1/jobs/abc/file")).toBe("/api/v1/jobs/abc/file");
    expect(resolveDownloadUrl("https://dl.example", "/v1/jobs/abc/file")).toBe("https://dl.example/v1/jobs/abc/file");
    expect(resolveDownloadUrl("/api", "https://cdn.example/x.mp4")).toBe("https://cdn.example/x.mp4");
  });
});

describe("platforms added after live verification", () => {
  it.each([
    ["https://www.dailymotion.com/video/x5kesuj", "dailymotion", "Video"],
    ["https://dai.ly/x5kesuj", "dailymotion", "Video"],
    ["https://clips.twitch.tv/FaintLightGullWholeWheat", "twitch", "Clip"],
    ["https://www.twitch.tv/chan/clip/FaintLightGullWholeWheat-AbC12", "twitch", "Clip"],
    ["https://soundcloud.com/ethmusic/lostin-powers-she-so-heavy", "soundcloud", "Track"],
    ["https://bsky.app/profile/bsky.app/post/3l3vgf77uco2g", "bluesky", "Post"],
    ["https://streamable.com/moo", "streamable", "Video"],
  ])("%s", (u, id, type) => expect(ok(u)).toEqual([id, type]));

  it.each(["https://www.twitch.tv/somechannel", "https://soundcloud.com/a/sets/b", "https://soundcloud.com/a", "https://bsky.app/profile/x.bsky.social"])("rejects %s", (u) => {
    const d = detectUrl(u);
    expect(d.ok).toBe(false);
  });

  it("does not claim Snapchat (failed live verification)", () => {
    const d = detectUrl("https://www.snapchat.com/spotlight/abc");
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("unsupported-platform");
  });
});

describe("platforms that can't work from our servers", () => {
  it.each(["https://www.reddit.com/r/videos/comments/abc123/some_title/", "https://v.redd.it/abc123", "https://vimeo.com/76979871"])("refuses %s with the reason, before any request", (u) => {
    const d = detectUrl(u);
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.reason).toBe("unsupported-content");
      expect(d.message).toMatch(/aren't available/);
    }
  });
  it("doesn't list them as supported", () => {
    const d = detectUrl("https://example.com/x");
    expect(!d.ok && d.message).not.toMatch(/Reddit|Vimeo/);
  });
});

describe("platforms added in the media expansion (live-verified)", () => {
  it.each([
    ["https://9gag.com/gag/ae5Ag7B", "9gag", "Post"],
    ["https://kick.com/spreen/clips/clip_01J8RGZRKHXHXXKJEHGRM932A5", "kick", "Clip"],
    ["https://www.linkedin.com/posts/mishalkhawaja_sendinblueviews-toronto-digitalmarketing-ugcPost-6850898786781339649-mM20", "linkedin", "Post video"],
    ["https://medal.tv/games/valorant/clips/jTBFnLKdLy15K", "medal", "Clip"],
    ["https://www.mixcloud.com/dholbach/cryptkeeper/", "mixcloud", "Show (audio)"],
    ["https://imgur.com/a/iX265HX", "imgur", "Album"],
  ])("%s", (u, id, type) => expect(ok(u)).toEqual([id, type]));
});
