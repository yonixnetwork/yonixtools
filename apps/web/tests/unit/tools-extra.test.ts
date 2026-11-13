import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { extractPages, imagesToPdf, loadPdf, mergePdfs, optimizePdf, parseRanges, rotatePdf, splitPdf } from "@/lib/tools/pdf";
import { centeredAspect, clampRect, resizeFromCorner } from "@/lib/tools/crop";
import { keywordIdeas, parseSocialMeta, parseUrlList, schemaJsonLd, sitemapXml, titleIdeas, jsonLdScript } from "@/lib/tools/seo-extra";
import { minify } from "@/lib/tools/minify";

async function makePdf(pages: number, label = "Doc"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) doc.addPage([300, 400]).drawText(`${label} page ${i + 1}`, { x: 20, y: 350, size: 14, font });
  return doc.save();
}

// 1×1 PNG
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

describe("PDF tools", () => {
  it("parses page ranges", () => {
    expect(parseRanges("1-3, 5", 10)).toEqual([[0, 1, 2], [4]]);
    expect(parseRanges("8-", 10)).toEqual([[7, 8, 9]]);
    expect(parseRanges("-2", 10)).toEqual([[0, 1]]);
    expect(() => parseRanges("0", 10)).toThrow(/outside/);
    expect(() => parseRanges("11", 10)).toThrow(/outside/);
    expect(() => parseRanges("5-2", 10)).toThrow(/backwards/);
    expect(() => parseRanges("abc", 10)).toThrow(/valid/);
    expect(() => parseRanges(" ", 10)).toThrow();
  });

  it("merges PDFs in order", async () => {
    const out = await loadPdf(await mergePdfs([await makePdf(2, "A"), await makePdf(3, "B")]));
    expect(out.getPageCount()).toBe(5);
    await expect(mergePdfs([await makePdf(1)])).rejects.toThrow(/two/);
  });

  it("splits by every page and by ranges", async () => {
    const src = await makePdf(5);
    const every = await splitPdf(src, { kind: "every" });
    expect(every.map((f) => f.name)).toEqual(["page-1.pdf", "page-2.pdf", "page-3.pdf", "page-4.pdf", "page-5.pdf"]);
    const ranged = await splitPdf(src, { kind: "ranges", spec: "1-2,4-5" });
    expect(ranged.map((f) => f.name)).toEqual(["pages-1-2.pdf", "pages-4-5.pdf"]);
    expect((await loadPdf(ranged[1].bytes)).getPageCount()).toBe(2);
    expect((await loadPdf(await extractPages(src, [4, 0]))).getPageCount()).toBe(2);
  });

  it("rotates selected pages", async () => {
    const out = await loadPdf(await rotatePdf(await makePdf(3), 90, [1]));
    expect(out.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90, 0]);
    const all = await loadPdf(await rotatePdf(await makePdf(2), 270, "all"));
    expect(all.getPages().map((p) => p.getRotation().angle)).toEqual([270, 270]);
  });

  it("optimizes losslessly and keeps every page", async () => {
    const src = await makePdf(4);
    expect((await loadPdf(await optimizePdf(src))).getPageCount()).toBe(4);
  });

  it("builds a PDF from images on A4 pages", async () => {
    const out = await loadPdf(await imagesToPdf([{ bytes: PNG, type: "png", width: 1, height: 1 }, { bytes: PNG, type: "png", width: 1, height: 1 }], { pageSize: "a4", margin: 20 }));
    expect(out.getPageCount()).toBe(2);
    expect(Math.round(out.getPage(0).getWidth())).toBe(595);
  });

  it("rejects non-PDF input clearly", async () => {
    await expect(loadPdf(new TextEncoder().encode("hello"))).rejects.toThrow(/couldn't be read as a PDF/);
  });
});

describe("QR decoding", () => {
  it("decodes a generated QR code with jsQR", () => {
    const text = "https://yonixtools.com/qr-code-scanner/";
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const scale = 6;
    const margin = 4;
    const n = qr.modules.size;
    const size = (n + margin * 2) * scale;
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        if (qr.modules.get(y, x))
          for (let dy = 0; dy < scale; dy++)
            for (let dx = 0; dx < scale; dx++) {
              const o = (((y + margin) * scale + dy) * size + (x + margin) * scale + dx) * 4;
              data[o] = data[o + 1] = data[o + 2] = 0;
            }
    expect(jsQR(data, size, size)?.data).toBe(text);
  });
});

describe("crop math", () => {
  it("clamps and centres", () => {
    expect(clampRect({ x: -10, y: 5, w: 5000, h: 50 }, 800, 600)).toEqual({ x: 0, y: 5, w: 800, h: 50 });
    expect(centeredAspect(800, 600, 1)).toEqual({ x: 100, y: 0, w: 600, h: 600 });
    expect(centeredAspect(800, 600, 16 / 9)).toEqual({ x: 0, y: 75, w: 800, h: 450 });
  });

  it("resizes from a corner keeping aspect and bounds", () => {
    const r = resizeFromCorner({ x: 100, y: 100, w: 200, h: 200 }, 50, 10, "se", 1, 800, 600);
    expect(r.w).toBe(r.h);
    const big = resizeFromCorner({ x: 100, y: 100, w: 200, h: 200 }, 5000, 5000, "se", null, 800, 600);
    expect(big.x + big.w).toBeLessThanOrEqual(800);
    expect(big.y + big.h).toBeLessThanOrEqual(600);
  });
});

describe("SEO extras", () => {
  it("builds a sitemap from a URL list", () => {
    const { urls, invalid } = parseUrlList("https://a.com/\nhttps://a.com/x?a=1&b=2\nnot a url\nhttps://a.com/\nftp://x.com/");
    expect(urls).toEqual(["https://a.com/", "https://a.com/x?a=1&b=2"]);
    expect(invalid).toEqual(["not a url", "ftp://x.com/"]);
    const xml = sitemapXml(urls, { lastmod: "2026-11-06", changefreq: "weekly", priority: "0.8" });
    expect(xml).toContain("<loc>https://a.com/x?a=1&amp;b=2</loc>");
    expect(xml).toContain("<changefreq>weekly</changefreq>");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it("builds JSON-LD without empty fields", () => {
    const org = schemaJsonLd("Organization", { name: "YoniXTools", url: "https://yonixtools.com", logo: "", sameAs: "https://x.com/a\n\nhttps://github.com/b" });
    expect(org).toEqual({ "@context": "https://schema.org", "@type": "Organization", name: "YoniXTools", url: "https://yonixtools.com", sameAs: ["https://x.com/a", "https://github.com/b"] });
    const faq = schemaJsonLd("FAQPage", {}, [{ q: "Q1", a: "A1" }, { q: "", a: "x" }]);
    expect((faq.mainEntity as unknown[]).length).toBe(1);
    expect(jsonLdScript({ a: "</script><b>" })).not.toContain("</script><b>");
  });

  it("reads social meta tags from HTML", () => {
    const m = parseSocialMeta(`<head><title>T &amp; Co</title><meta property="og:title" content="OG &quot;Title&quot;"><meta name='description' content='Desc'><meta content="https://x/i.png" property="og:image"></head>`);
    expect(m.title).toBe('OG "Title"');
    expect(m.description).toBe("Desc");
    expect(m.image).toBe("https://x/i.png");
    expect(m.warnings.some((w) => w.includes("og:url"))).toBe(true);
  });

  it("generates keyword and title ideas", () => {
    const k = keywordIdeas("  QR Code ");
    expect(k.questions[0]).toBe("how to qr code");
    expect(k.longTail).toContain("qr code for free");
    expect(titleIdeas("pdf merger", "YoniXTools", 2026)[0]).toBe("Pdf Merger: The Complete Guide (2026) | YoniXTools");
    expect(keywordIdeas("").questions).toEqual([]);
  });
});

describe("minifiers", () => {
  it("minifies JavaScript with terser", async () => {
    const r = await minify("js", "function add(first, second) {\n  // sum\n  return first + second;\n}\nconsole.log(add(1, 2));");
    expect(r.output).not.toContain("// sum");
    expect(r.after).toBeLessThan(r.before);
    await expect(minify("js", "function (")).rejects.toThrow();
  });

  it("minifies CSS with csso", async () => {
    const r = await minify("css", ".a {\n  color: #ff0000;\n  margin: 0px 0px 0px 0px;\n}\n/* note */");
    expect(r.output).toBe(".a{color:red;margin:0}");
  });

  // HTML minification uses the browser bundle; it is tested in a real browser (tests/e2e/tools-extra.spec.ts).
});
