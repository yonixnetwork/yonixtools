import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en/errors.json";
import enDownloader from "@/i18n/messages/en/downloader.json";
import { makeTranslator } from "@/i18n/translator";
import type { Messages } from "@/i18n/format";
import { errorMessage, errorMessageKey } from "@/lib/downloader/error-message";
import { DownloaderError, describeMediaText, extractMedia, type MediaItem } from "@/lib/downloader/client";
import { CONTENT_TYPES, DETECT_MESSAGES, detectUrl, unavailableMessage, unavailableMessageKey } from "@/lib/downloader/detect";
import { ACTIVE_PHASES, phaseLabel, phaseText, type Phase } from "@/lib/downloader/phases";
import { PLATFORM_STATUS, STATE_LABEL, STATE_LABEL_KEY, platformStatusText } from "@/lib/downloader/platform-status";

const catalogue = en as Record<string, string>;
const errorsPy = readFileSync(fileURLToPath(new URL("../../../../services/downloader/app/errors.py", import.meta.url)), "utf8");

/** The body of a top-level `NAME: type = { ... }` dict literal. */
function dictBody(name: string): string {
  const m = errorsPy.match(new RegExp(`^${name}:[^=]*=\\s*\\{([\\s\\S]*?)^\\}`, "m"));
  if (!m) throw new Error(`${name} not found in errors.py`);
  return m[1];
}
/** Python string literal(s), adjacent ones concatenated ("a" "b" -> "ab"). */
const pyStrings = (s: string) => [...s.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => JSON.parse(`"${x[1]}"`) as string).join("");

const statusCodes = [...dictBody("ERROR_STATUS").matchAll(/^\s*"(\w+)":\s*\d+,/gm)].map((m) => m[1]);
const defaults = [...dictBody("DEFAULT_MESSAGES").matchAll(/^\s*"(\w+)":\s*((?:"(?:[^"\\]|\\.)*"\s*)+),/gm)].map((m) => [m[1], pyStrings(m[2])] as const);
const platform = [...dictBody("PLATFORM_MESSAGES").matchAll(/^\s*\("(\w+)",\s*"(\w+)"\):\s*((?:"(?:[^"\\]|\\.)*"\s*)+),/gm)].map((m) => [m[1], m[2], pyStrings(m[3])] as const);

describe("downloader error messages come from the catalogue, by code", () => {
  it("parses errors.py", () => {
    expect(statusCodes.length).toBeGreaterThan(20);
    expect(defaults.map(([c]) => c).sort()).toEqual([...statusCodes].sort());
    expect(platform.length).toBeGreaterThan(5);
  });

  it.each(defaults)("code.%s has the backend's English text", (code, text) => {
    expect(catalogue[`code.${code}`]).toBe(text);
  });

  it.each(platform)("platform.%s.%s has the backend's English text", (p, code, text) => {
    expect(catalogue[`platform.${p}.${code}`]).toBe(text);
  });

  const t = makeTranslator("en", "errors", catalogue as Messages);

  it("picks client key, then platform + code, then code, then server_error", () => {
    expect(errorMessageKey(t, new DownloaderError("timeout", "x", undefined, "client.timeout"))).toBe("client.timeout");
    expect(errorMessageKey(t, new DownloaderError("platform_blocked", "x", "youtube"))).toBe("platform.youtube.platform_blocked");
    expect(errorMessageKey(t, new DownloaderError("platform_blocked", "x", "tiktok"))).toBe("code.platform_blocked");
    expect(errorMessageKey(t, { code: "something_new" })).toBe("code.server_error");
    expect(errorMessageKey(t, null)).toBe("code.server_error");
  });

  it("ignores the server's English text", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ error: { code: "private", message: "Server wording", platform: "instagram" } }), { status: 422 })) as unknown as typeof fetch;
    const err = await extractMedia({ baseUrl: "https://api.test", fetchImpl }, "https://www.instagram.com/p/abc/").catch((e) => e);
    expect(err).toBeInstanceOf(DownloaderError);
    expect(errorMessage(t, err)).toBe(DEFAULT_TEXT("private"));
  });

  it("keeps the client wording for client-side failures", async () => {
    const fetchImpl = (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
    const err = await extractMedia({ baseUrl: "https://api.test", fetchImpl }, "https://x.com/a/status/1").catch((e) => e);
    expect(errorMessage(t, err)).toBe("Couldn't reach the download service. Check your connection and try again.");
    const none = await extractMedia({ baseUrl: "" }, "https://x.com/a/status/1").catch((e) => e);
    expect(errorMessage(t, none)).toBe("The downloader service is not connected yet.");
  });
});

const DEFAULT_TEXT = (code: string) => defaults.find(([c]) => c === code)![1];

describe("downloader English catalogue matches the English module text", () => {
  const msgs = enDownloader as Messages;
  const t = makeTranslator("en", "downloader", msgs);

  it("detection messages and content types", () => {
    for (const [id, text] of Object.entries(DETECT_MESSAGES)) expect(msgs[`detect.${id}`]).toBe(text);
    for (const [id, text] of Object.entries(CONTENT_TYPES)) expect(msgs[`contentType.${id}`]).toBe(text);
    for (const id of ["youtube", "reddit", "vimeo", "tiktok"]) {
      const key = unavailableMessageKey(id);
      expect(key ? t(key) : undefined).toBe(unavailableMessage(id));
    }
    for (const u of ["https://example.com/x", "https://www.instagram.com/someone/", "https://youtu.be/abc", "", "https://www.instagram.com/reel/abc/"]) {
      const d = detectUrl(u);
      if (d.ok) expect(t(d.contentTypeKey)).toBe(d.contentType);
      else expect(t(d.key, d.vars)).toBe(d.message);
    }
  });

  it("platform status", () => {
    for (const p of PLATFORM_STATUS) expect(platformStatusText(t, p)).toEqual({ state: STATE_LABEL[p.state], content: p.content, note: p.note });
    for (const s of Object.keys(STATE_LABEL) as Array<keyof typeof STATE_LABEL>) expect(t(STATE_LABEL_KEY[s])).toBe(STATE_LABEL[s]);
  });

  it("phases and media descriptions", () => {
    const phases: Phase[] = [...ACTIVE_PHASES, "started", "requested", "failed", "cancelled"];
    for (const phase of phases) expect(phaseLabel(t, { phase })).toBe(phaseText({ phase }));
    expect(phaseLabel(t, { phase: "downloading", progress: 41.6 })).toBe("Downloading 42%");
    const items = (...kinds: MediaItem["kind"][]) => ({ items: kinds.map((kind, index) => ({ index, kind, formats: [] })) });
    expect(describeMediaText(t, items("video"))).toBe("Video");
    expect(describeMediaText(t, items("image", "image", "image"))).toBe("3 images");
    expect(describeMediaText(t, items("video", "image", "image"))).toBe("Mixed: 1 video, 2 images");
    expect(describeMediaText(t, items("audio", "audio"))).toBe("2 audio tracks");
  });
});
