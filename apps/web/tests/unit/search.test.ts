import { describe, expect, it } from "vitest";
import { editDistance, searchTools } from "@/lib/search";

const top = (q: string) => searchTools(q).results[0]?.tool.slug;

describe("tool search", () => {
  it.each([
    ["Instagram downloader", "instagram-downloader"],
    ["QR code generator", "qr-code-generator"],
    ["Image converter", "image-converter"],
    ["JSON formatter", "json-formatter"],
    ["Password generator", "password-generator"],
    ["tiktok", "tiktok-downloader"],
    ["youtube shorts", "youtube-downloader"],
    ["png to jpg", "image-converter"],
    ["wifi qr", "wifi-qr-code-generator"],
    ["robots.txt", "robots-txt-generator"],
  ])("finds %s by name or keyword", (q, slug) => expect(top(q)).toBe(slug));

  it.each([
    ["ig video saver", "instagram-downloader"],
    ["beautify json", "json-formatter"],
    ["shrink photo", "image-compressor"],
    ["yt", "youtube-downloader"],
    ["mortgage", "loan-calculator"],
    ["guid", "uuid-generator"],
    ["character count", "word-counter"],
    ["json validator", "json-formatter"],
    ["text to slug", "url-slug-generator"],
  ])("understands the synonym %s", (q, slug) => expect(top(q)).toBe(slug));

  it.each([
    ["instgram downlader", "instagram-downloader"],
    ["pasword generater", "password-generator"],
    ["jsn formater", "json-formatter"],
    ["compresor", "image-compressor"],
    ["calculater bmi", "bmi-calculator"],
  ])("tolerates the typo %s", (q, slug) => expect(top(q)).toBe(slug));

  it("suggests while typing (prefix match)", () => {
    expect(top("insta")).toBe("instagram-downloader");
    expect(top("pass")).toBe("password-generator");
    expect(top("qr")).toMatch(/qr-code/);
  });

  it("searches by category name", () => {
    const r = searchTools("calculators").results.map((x) => x.tool.category);
    expect(r.length).toBeGreaterThanOrEqual(6);
    expect(new Set(r.slice(0, 6))).toEqual(new Set(["calculators"]));
  });

  it("filters by category", () => {
    const r = searchTools("generator", { category: "qr" }).results;
    expect(r.length).toBe(3);
    r.forEach((x) => expect(x.tool.category).toBe("qr"));
  });

  it("reports planned tools honestly instead of pretending", () => {
    const r = searchTools("PDF compressor");
    expect(r.planned.map((p) => p.name)).toContain("PDF Compressor");
    expect(r.partial).toBe(true);
    expect(r.results[0].tool.slug).toBe("image-compressor");
  });

  it("returns nothing for nonsense", () => {
    const r = searchTools("zzqxv blorpt");
    expect(r.results).toHaveLength(0);
    expect(r.planned).toHaveLength(0);
  });

  it("computes edit distance with transpositions", () => {
    expect(editDistance("formatter", "formatter")).toBe(0);
    expect(editDistance("fromatter", "formatter")).toBe(1);
    expect(editDistance("kitten", "sitting", 3)).toBe(3);
  });
});
