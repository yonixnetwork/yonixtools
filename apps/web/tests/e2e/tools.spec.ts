import { expect, test as base } from "@playwright/test";

// Navigate and wait until the tool's code has hydrated, so typing reaches React.
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
import { deflateSync } from "node:zlib";

/** Build a real RGBA PNG (noisy gradient, so compression has work to do). */
function makePng(w: number, h: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  let seed = 7;
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = (x * 255) / w;
      raw[o + 1] = (y * 255) / h;
      raw[o + 2] = seed & 0xff;
      raw[o + 3] = 255;
    }
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

test("QR code generator renders a code and offers PNG/SVG", async ({ page }) => {
  await page.goto("/qr-code-generator/");
  await page.locator("#qr-text").fill("https://example.com/hello");
  await expect(page.getByAltText("Generated QR code")).toHaveAttribute("src", /^data:image\/png;base64,/);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "SVG" }).click()]);
  expect(dl.suggestedFilename()).toBe("qr-code.svg");
});

test("Wi-Fi QR code needs an SSID", async ({ page }) => {
  await page.goto("/wifi-qr-code-generator/");
  await expect(page.getByRole("button", { name: "PNG" })).toBeDisabled();
  await page.locator("#wifi-ssid").fill("Cafe Guest");
  await page.locator("#wifi-pass").fill("s3cret;pass");
  await expect(page.getByAltText("Generated QR code")).toBeVisible();
});

test("image compressor processes a real PNG locally", async ({ page }) => {
  const uploads: string[] = [];
  page.on("request", (r) => r.method() !== "GET" && uploads.push(r.url()));
  await page.goto("/image-compressor/");
  await page.getByTestId("image-input").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: makePng(400, 300) });
  await expect(page.getByText("400×300 ·")).toBeVisible();
  await expect(page.getByTestId("output-size")).toHaveText(/kB|MB/);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /^Download/ }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^photo-compressed\.(jpg|webp)$/);
  expect(uploads).toEqual([]);
});

test("image resizer keeps aspect ratio", async ({ page }) => {
  await page.goto("/image-resizer/");
  await page.getByTestId("image-input").setInputFiles({ name: "p.png", mimeType: "image/png", buffer: makePng(400, 200) });
  await page.locator("#img-w").fill("100");
  await expect(page.locator("#img-h")).toHaveValue("50");
  await expect(page.getByText("100×50", { exact: true })).toBeVisible();
});

test("image converter rejects non-images", async ({ page }) => {
  await page.goto("/image-converter/");
  await page.getByTestId("image-input").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.locator(".notice[role=alert]")).toContainText("isn't an image");
});

test("JSON formatter validates and reports error location", async ({ page }) => {
  await page.goto("/json-formatter/");
  await expect(page.getByText("Valid JSON", { exact: true })).toBeVisible();
  await page.locator("#json-in").fill('{\n  "a": 1,\n}');
  await expect(page.locator(".notice[role=alert]")).toContainText("Invalid JSON at line 3");
});

test("Base64, URL encoding, hashes", async ({ page }) => {
  await page.goto("/base64-encoder-decoder/");
  await page.locator("#b64-in").fill("Man");
  await expect(page.getByLabel("Base64", { exact: true }).last()).toHaveText("TWFu");
  await page.goto("/url-encoder-decoder/");
  await page.locator("#url-in").fill("a b&c");
  await expect(page.locator("pre[aria-label=Output]")).toHaveText("a%20b%26c");
  await page.goto("/hash-generator/");
  await page.locator("#hash-text").fill("abc");
  await expect(page.getByTestId("hash-SHA-256")).toHaveText("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  await page.locator("#hash-exp").fill("BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD");
  await expect(page.getByText("Match: SHA-256")).toBeVisible();
});

test("JWT decoder, UUIDs, regex", async ({ page }) => {
  await page.goto("/jwt-decoder/");
  await expect(page.locator("pre[aria-label=Payload]")).toContainText('"name": "Jane Doe"');
  await expect(page.getByText("Signature not verified")).toBeVisible();
  await page.goto("/uuid-generator/");
  await page.locator("#uuid-n").fill("10");
  const txt = await page.locator("pre[aria-label='10 UUIDs']").textContent();
  expect(txt!.trim().split("\n")).toHaveLength(10);
  await page.goto("/regex-tester/");
  await expect(page.getByTestId("regex-count")).toHaveText("2 matches");
  await page.locator("#re-p").fill("(");
  await expect(page.locator(".notice[role=alert]")).toBeVisible();
});

test("text tools", async ({ page }) => {
  await page.goto("/word-counter/");
  await page.locator("#wc-text").fill("One two three. Four five!");
  await expect(page.getByTestId("stat-words")).toHaveText("5");
  await expect(page.getByTestId("stat-sentences")).toHaveText("2");
  await page.goto("/case-converter/");
  await page.getByRole("button", { name: "snake_case" }).click();
  await expect(page.locator("pre[aria-label=Result]")).toHaveText("the_quick_brown_fox_jumps_over_the_lazy_dog");
  await page.goto("/password-generator/");
  await expect(page.getByTestId("password")).toHaveText(/^.{20}$/);
  const first = await page.getByTestId("password").textContent();
  await page.getByRole("button", { name: "Generate new" }).click();
  await expect(page.getByTestId("password")).not.toHaveText(first!);
  await page.goto("/text-compare/");
  await expect(page.getByTestId("diff-added")).toHaveText("+2 added");
  await expect(page.getByTestId("diff-removed")).toHaveText("−1 removed");
  await page.goto("/lorem-ipsum-generator/");
  await expect(page.locator("pre[aria-label='Placeholder text']")).toContainText("Lorem ipsum dolor sit amet");
  await page.goto("/url-slug-generator/");
  await expect(page.locator("pre[aria-label=Slugs]")).toHaveText("10-best-free-online-tools-for-createurs-and-developers-in-2026");
});

test("SEO tools", async ({ page }) => {
  await page.goto("/meta-tag-generator/");
  await page.locator("#mt-title").fill('Best "tools"');
  await expect(page.locator("pre[aria-label='HTML for your <head>']")).toContainText("<title>Best &quot;tools&quot;</title>");
  await page.goto("/serp-snippet-preview/");
  await page.locator("#serp-t").fill("W".repeat(80));
  await expect(page.getByText("will be truncated").first()).toBeVisible();
  await expect(page.getByTestId("serp-title")).toHaveText(/\.\.\.$/);
  await page.goto("/robots-txt-generator/");
  await page.getByLabel(/Block AI training crawlers/).check();
  await expect(page.locator("pre[aria-label='robots.txt']")).toContainText("User-agent: GPTBot");
});

test("calculators", async ({ page }) => {
  await page.goto("/percentage-calculator/");
  await expect(page.getByTestId("pc-result")).toHaveText("30");
  await page.goto("/age-calculator/");
  await page.locator("#age-b").fill("2000-01-01");
  await page.locator("#age-o").fill("2026-11-06");
  await expect(page.getByTestId("age-result")).toHaveText("26 years, 10 months, 5 days");
  await page.goto("/bmi-calculator/");
  await expect(page.getByTestId("bmi-result")).toHaveText("22.9");
  await page.goto("/loan-calculator/");
  await page.locator("#ln-p").fill("200000");
  await page.locator("#ln-r").fill("6");
  await page.locator("#ln-y").fill("30");
  await expect(page.getByTestId("loan-monthly")).toHaveText("1,199.10");
  await page.goto("/compound-interest-calculator/");
  await expect(page.getByTestId("ci-result")).toHaveText(/^\d{1,3}(,\d{3})*\.\d{2}$/);
  await page.goto("/unit-converter/");
  await expect(page.getByTestId("uc-out")).toHaveValue("39.37007874");
});
