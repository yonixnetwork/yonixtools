import { expect, test as base, type Download, type Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { readFile } from "node:fs/promises";
import { makePng } from "./helpers";

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

async function pdf(pages: number, label = "Doc"): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) doc.addPage([300, 400]).drawText(`${label} ${i + 1}`, { x: 30, y: 300, size: 24, font });
  return Buffer.from(await doc.save());
}

async function grab(page: Page, action: () => Promise<unknown>): Promise<{ dl: Download; bytes: Buffer }> {
  const [dl] = await Promise.all([page.waitForEvent("download"), action()]);
  return { dl, bytes: await readFile((await dl.path())!) };
}

test("PDF merger combines files in order", async ({ page }) => {
  await page.goto("/pdf-merger/");
  await page.getByTestId("pdf-input").setInputFiles([
    { name: "a.pdf", mimeType: "application/pdf", buffer: await pdf(2, "A") },
    { name: "b.pdf", mimeType: "application/pdf", buffer: await pdf(3, "B") },
  ]);
  await expect(page.locator(".file-list li")).toHaveCount(2);
  await expect(page.locator(".file-list li").first()).toContainText("2 pages");
  await page.getByRole("button", { name: "Move b.pdf up" }).click();
  await expect(page.locator(".file-list li").first()).toContainText("b.pdf");
  const { dl, bytes } = await grab(page, () => page.getByRole("button", { name: /Merge 2 PDFs/ }).click());
  expect(dl.suggestedFilename()).toBe("merged.pdf");
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(5);
  await expect(page.getByText("Merged 5 pages")).toBeVisible();
});

test("PDF merger rejects non-PDFs and damaged files", async ({ page }) => {
  await page.goto("/pdf-merger/");
  await page.getByTestId("pdf-input").setInputFiles([{ name: "x.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf") }]);
  await expect(page.locator(".notice[role=alert]")).toContainText("couldn't be read as a PDF");
});

test("PDF splitter: ranges and every page", async ({ page }) => {
  await page.goto("/pdf-splitter/");
  await page.getByTestId("pdf-input").setInputFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: await pdf(5) });
  await page.locator("#split-spec").fill("1-2, 9");
  await expect(page.getByText("outside the document")).toBeVisible();
  await page.locator("#split-spec").fill("1-2, 4-");
  await page.getByRole("button", { name: "Split PDF" }).click();
  await expect(page.getByTestId("split-count")).toHaveText("2 files ready");
  const { bytes } = await grab(page, () => page.locator(".file-list li").nth(1).getByRole("button", { name: "Download" }).click());
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  await page.getByRole("button", { name: /Every page/ }).click();
  await page.getByRole("button", { name: "Split PDF" }).click();
  await expect(page.getByTestId("split-count")).toHaveText("5 files ready");
  const zip = await grab(page, () => page.getByRole("button", { name: /Download all/ }).click());
  expect(zip.dl.suggestedFilename()).toBe("doc-split.zip");
  expect(zip.bytes.subarray(0, 2).toString()).toBe("PK");
});

test("PDF compressor: lossless and strong (pdf.js) modes", async ({ page }) => {
  await page.goto("/pdf-compressor/");
  await page.getByTestId("pdf-input").setInputFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: await pdf(3) });
  await page.getByRole("button", { name: "Compress", exact: true }).click();
  await expect(page.getByTestId("pdf-result-size")).toHaveText(/kB|MB/);
  await page.getByRole("button", { name: /Strong/ }).click();
  await expect(page.getByText("text will no longer be selectable")).toBeVisible();
  await page.getByRole("button", { name: "Compress", exact: true }).click();
  await expect(page.getByTestId("pdf-result-size")).toHaveText(/kB|MB/, { timeout: 20_000 });
  const { bytes } = await grab(page, () => page.getByRole("button", { name: "Download compressed PDF" }).click());
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
});

test("PDF to image renders every page with pdf.js", async ({ page }) => {
  await page.goto("/pdf-to-image/");
  await page.getByTestId("pdf-input").setInputFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: await pdf(2) });
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  await page.getByRole("button", { name: "Convert 2 pages" }).click();
  await expect(page.getByTestId("image-count")).toHaveText("2 images", { timeout: 20_000 });
  const src = await page.getByAltText("Page 1").getAttribute("src");
  expect(src).toMatch(/^blob:/);
  const { dl } = await grab(page, () => page.getByRole("link", { name: "Page 2" }).click());
  expect(dl.suggestedFilename()).toBe("doc-page-2.png");
});

test("image to PDF builds one page per image", async ({ page }) => {
  await page.goto("/image-to-pdf/");
  await page.getByTestId("image-input").setInputFiles([
    { name: "one.png", mimeType: "image/png", buffer: makePng(400, 300) },
    { name: "two.png", mimeType: "image/png", buffer: makePng(300, 400) },
  ]);
  const { bytes } = await grab(page, () => page.getByRole("button", { name: "Create PDF" }).click());
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(2);
  expect(doc.getPage(0).getWidth()).toBeGreaterThan(doc.getPage(0).getHeight()); // landscape for a wide image
});

test("rotate PDF rotates selected pages", async ({ page }) => {
  await page.goto("/rotate-pdf/");
  await page.getByTestId("pdf-input").setInputFiles({ name: "doc.pdf", mimeType: "application/pdf", buffer: await pdf(3) });
  await page.getByRole("button", { name: "Selected pages" }).click();
  await page.locator("#rot-spec").fill("2-3");
  await page.getByRole("button", { name: "180°" }).click();
  const { bytes } = await grab(page, () => page.getByRole("button", { name: /Rotate & download/ }).click());
  expect((await PDFDocument.load(bytes)).getPages().map((p) => p.getRotation().angle)).toEqual([0, 180, 180]);
});

test("image cropper crops to a square", async ({ page }) => {
  await page.goto("/image-cropper/");
  await page.getByTestId("image-input").setInputFiles({ name: "wide.png", mimeType: "image/png", buffer: makePng(800, 400) });
  await page.getByRole("button", { name: "1:1" }).click();
  await expect(page.locator("#crop-w")).toHaveValue("400");
  await expect(page.locator("#crop-h")).toHaveValue("400");
  const box = page.getByTestId("crop-box");
  await box.scrollIntoViewIfNeeded();
  const b = (await box.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 2000, b.y + b.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator("#crop-x")).toHaveValue("0");
  const { dl } = await grab(page, () => page.getByRole("button", { name: "Download 400×400" }).click());
  expect(dl.suggestedFilename()).toBe("wide-400x400.png");
});

test("QR scanner decodes an uploaded QR image", async ({ page }) => {
  await page.goto("/qr-code-scanner/");
  const png = await QRCode.toBuffer("https://yonixtools.com/hello", { width: 300 });
  await page.getByTestId("qr-input").setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: png });
  await expect(page.getByTestId("qr-result")).toHaveText("https://yonixtools.com/hello");
  await expect(page.getByRole("link", { name: "Open link" })).toHaveAttribute("rel", "noopener noreferrer nofollow");
  await page.getByTestId("qr-input").setInputFiles({ name: "blank.png", mimeType: "image/png", buffer: makePng(200, 200) });
  await expect(page.locator(".notice[role=alert]")).toContainText("No QR code was found");
});

test("minifiers: HTML, CSS and JavaScript", async ({ page }) => {
  await page.goto("/html-minifier/");
  await page.getByRole("button", { name: "Minify HTML" }).click();
  await expect(page.getByTestId("minify-stats")).toContainText("% smaller");
  await expect(page.locator("pre[aria-label=Minified]")).not.toContainText("<!-- Page title -->");
  await page.goto("/css-minifier/");
  await page.getByRole("button", { name: "Minify CSS" }).click();
  await expect(page.locator("pre[aria-label=Minified]")).toContainText(".button{color:#fff;background-color:red;margin:0;padding:10px}");
  await page.goto("/javascript-minifier/");
  await page.locator("#min-in").fill("function broken( {");
  await page.getByRole("button", { name: "Minify JavaScript" }).click();
  await expect(page.locator(".notice[role=alert]")).toContainText("Line 1");
});

test("SEO extras: sitemap, schema, OG preview, keywords, titles", async ({ page }) => {
  await page.goto("/sitemap-generator/");
  await page.locator("#sm-urls").fill("https://a.com/\nnope\nhttps://a.com/b?x=1&y=2");
  await expect(page.locator("pre[aria-label='sitemap.xml']")).toContainText("<loc>https://a.com/b?x=1&amp;y=2</loc>");
  await expect(page.getByText("Skipped 1 invalid line")).toBeVisible();
  await page.goto("/schema-markup-generator/");
  await page.getByLabel("Schema type").selectOption("FAQPage");
  await page.locator("#faq-q-0").fill("Is it free?");
  await page.locator("#faq-a-0").fill("Yes.");
  await expect(page.locator("pre").first()).toContainText('"@type": "FAQPage"');
  await page.goto("/open-graph-preview/");
  await expect(page.getByText("Missing og:image")).toBeVisible();
  await expect(page.locator(".og-card").first()).toContainText("YoniXTools – Social Media Downloader");
  await page.goto("/keyword-idea-generator/");
  await page.locator("#kw-seed").fill("pdf merger");
  await expect(page.getByTestId("kw-count")).toHaveText("35 ideas");
  await page.goto("/seo-title-generator/");
  await expect(page.getByTestId("title-list").locator("li")).toHaveCount(8);
});
