import { readFileSync } from "node:fs";
import { expect, test as base } from "@playwright/test";
import { isAdTraffic } from "./helpers";

const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, opts) => {
      const r = await goto(url, opts);
      await page.locator("html[data-tool-ready]").waitFor({ state: "attached" });
      return r;
    };
    await use(page);
  },
});

// 1.5 s VP8 + Vorbis test clip (open codecs, so Chromium can decode it).
const CLIP = { name: "clip.webm", mimeType: "video/webm", buffer: readFileSync(new URL("./fixtures/clip.webm", import.meta.url)) };

test("video info reads duration and resolution locally", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/video-info/");
  await page.getByTestId("vi-file").setInputFiles(CLIP);
  await expect(page.getByTestId("vi-res")).toHaveText("160 × 120 (4:3)");
  await expect(page.getByTestId("vi-duration")).toContainText("0:01.");
  expect(requests.filter((u) => !u.startsWith("http://localhost:4173") && !u.startsWith("blob:") && !isAdTraffic(u))).toEqual([]); // the video never leaves the device
});

test("frame extractor saves a PNG of the current frame", async ({ page }) => {
  await page.goto("/video-frame-extractor/");
  await page.getByTestId("vf-file").setInputFiles(CLIP);
  await page.locator("video").evaluate((v: HTMLVideoElement) => new Promise((r) => (v.readyState >= 2 ? r(null) : v.addEventListener("loadeddata", () => r(null), { once: true }))));
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save this frame" }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^clip-0-00-000\.png$/);
  const png = readFileSync((await dl.path())!);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(160); // IHDR width = native video width
});

test("audio extractor produces a real WAV", async ({ page }) => {
  await page.goto("/video-audio-extractor/");
  await page.getByTestId("va-file").setInputFiles(CLIP);
  await page.getByRole("button", { name: "Extract audio" }).click();
  await expect(page.getByTestId("va-result")).toContainText("WAV");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download WAV" }).click()]);
  expect(dl.suggestedFilename()).toBe("clip.wav");
  const wav = readFileSync((await dl.path())!);
  expect(wav.subarray(0, 4).toString()).toBe("RIFF");
  expect(wav.subarray(8, 12).toString()).toBe("WAVE");
  expect(wav.length).toBeGreaterThan(100_000); // ~1.5 s of 16-bit PCM
});

test("color converter", async ({ page }) => {
  await page.goto("/color-converter/");
  await page.locator("#cc-in").fill("rgb(30, 144, 255)");
  await expect(page.getByTestId("cc-hex")).toHaveText("#1E90FF");
  await expect(page.getByTestId("cc-hsl")).toHaveText("hsl(210, 100%, 56%)");
});

test("timestamp converter", async ({ page }) => {
  await page.goto("/timestamp-converter/");
  await expect(page.getByTestId("ts-now")).toHaveText(/^\d{10}$/);
  await page.locator("#ts-in").fill("1700000000");
  await expect(page.getByTestId("ts-iso")).toHaveText("2023-11-14T22:13:20.000Z");
});

test("number base converter", async ({ page }) => {
  await page.goto("/number-base-converter/");
  await page.locator("#nb-in").fill("255");
  await expect(page.getByTestId("nb-16")).toHaveText("FF");
  await expect(page.getByTestId("nb-2")).toHaveText("11111111");
});

test("time zone converter shows several zones", async ({ page }) => {
  await page.goto("/time-zone-converter/");
  await page.locator("#tz-when").fill("2026-07-15T09:00");
  await page.locator("#tz-from").selectOption("America/New_York");
  await expect(page.getByTestId("tz-results")).toContainText("15 Jul 2026, 18:30"); // Kolkata
  await expect(page.getByTestId("tz-results")).toContainText("UTC+05:30");
});

test("random number generator respects the range without repeats", async ({ page }) => {
  await page.goto("/random-number-generator/");
  await page.locator("#rn-min").fill("1");
  await page.locator("#rn-max").fill("5");
  await page.locator("#rn-count").fill("5");
  await page.getByRole("button", { name: "Generate" }).click();
  const nums = (await page.getByTestId("rn-out").innerText()).split(", ").map(Number).sort();
  expect(nums).toEqual([1, 2, 3, 4, 5]);
  await page.locator("#rn-count").fill("6");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText("Only 5 different numbers");
});

test("stopwatch runs and resets", async ({ page }) => {
  await page.goto("/stopwatch-timer/");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByTestId("sw-display")).not.toHaveText("0:00.000", { timeout: 3000 });
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByTestId("sw-display")).toHaveText("0:00.000");
});
