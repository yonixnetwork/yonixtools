import { describe, expect, it } from "vitest";
import { convertCase, diffLines, lorem, slugify, textStats, countGraphemes } from "@/lib/tools/text";
import { base64Decode, base64Encode, decodeJwt, formatJson, hashText, urlDecode, urlEncode } from "@/lib/tools/encoding";
import { generatePassword, passwordEntropyBits, uuidV4, uuidV7 } from "@/lib/tools/random";
import { bmi, bmiCategory, calculateAge, compound, loan, parseDate, percentChange, percentOf, whatPercent } from "@/lib/tools/calc";
import { convertUnit, formatNumber } from "@/lib/tools/units";
import { metaTags, robotsTxt, runRegex, vcardPayload, wifiPayload } from "@/lib/tools/formats";

describe("text", () => {
  it("counts words, characters and emoji correctly", () => {
    const s = textStats("Hello world. This is YoniXTools!\n\nSecond paragraph 👍🏽");
    expect(s.words).toBe(7);
    expect(s.sentences).toBe(3);
    expect(s.paragraphs).toBe(2);
    expect(countGraphemes("👍🏽")).toBe(1);
    expect(textStats("").words).toBe(0);
  });

  it("converts case styles", () => {
    expect(convertCase("the lord of the rings", "title")).toBe("The Lord of the Rings");
    expect(convertCase("hello WORLD. how are you", "sentence")).toBe("Hello world. How are you");
    expect(convertCase("XMLHttpRequest handler", "camel")).toBe("xmlHttpRequestHandler");
    expect(convertCase("user id value", "pascal")).toBe("UserIdValue");
    expect(convertCase("userIdValue", "snake")).toBe("user_id_value");
    expect(convertCase("User ID value", "kebab")).toBe("user-id-value");
    expect(convertCase("max retry count", "constant")).toBe("MAX_RETRY_COUNT");
  });

  it("slugifies with transliteration and options", () => {
    expect(slugify("Café Crème & Straße!")).toBe("cafe-creme-and-strasse");
    expect(slugify("The Best Tools for the Web", { removeStopWords: true })).toBe("best-tools-web");
    expect(slugify("Hello World", { separator: "_" })).toBe("hello_world");
    expect(slugify("one two three four", { maxLength: 10 })).toBe("one-two");
  });

  it("generates deterministic lorem ipsum", () => {
    const p = lorem({ unit: "paragraphs", count: 3, startClassic: true, seed: 1 });
    expect(p).toHaveLength(3);
    expect(p[0].startsWith("Lorem ipsum dolor sit amet")).toBe(true);
    expect(lorem({ unit: "words", count: 5, startClassic: false, seed: 2 })[0].split(" ")).toHaveLength(5);
  });

  it("diffs lines", () => {
    const d = diffLines("a\nb\nc", "a\nB\nc\nd")!;
    expect(d.map((x) => x.type)).toEqual(["same", "add", "del", "same", "add"]);
    expect(diffLines("a\nb", "A\n b ", { ignoreCase: true, ignoreWhitespace: true })!.every((x) => x.type === "same")).toBe(true);
  });
});

describe("encoding", () => {
  it("round-trips Base64 with Unicode and URL-safe alphabet", () => {
    const s = "héllo wörld 👋 ✓";
    expect(base64Decode(base64Encode(s))).toBe(s);
    expect(base64Encode("??>", true)).toBe("Pz8-");
    expect(base64Decode("Pz8-")).toBe("??>");
    expect(base64Encode("Man")).toBe("TWFu");
    expect(() => base64Decode("not base64!")).toThrow();
  });

  it("encodes and decodes URLs", () => {
    expect(urlEncode("a b&c=d/é", "component")).toBe("a%20b%26c%3Dd%2F%C3%A9");
    expect(urlEncode("https://x.com/a b?q=1", "full")).toBe("https://x.com/a%20b?q=1");
    expect(urlDecode("a+b%20c", "component")).toBe("a b c");
    expect(() => urlDecode("100%", "component")).toThrow(/malformed/);
  });

  it("decodes a JWT and checks expiry", () => {
    const enc = (o: object) => base64Encode(JSON.stringify(o), true);
    const tok = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: "123", iat: 1700000000, exp: 1700003600 })}.sig`;
    const d = decodeJwt(tok, 1700000100 * 1000);
    expect(d.header.alg).toBe("HS256");
    expect(d.payload.sub).toBe("123");
    expect(d.expired).toBe(false);
    expect(decodeJwt(`Bearer ${tok}`, 1800000000 * 1000).expired).toBe(true);
    expect(() => decodeJwt("abc.def")).toThrow(/three/);
  });

  it("formats, minifies and locates JSON errors", () => {
    expect(formatJson('{"b":1,"a":[1,2]}', { indent: 2, sortKeys: true })).toEqual({ ok: true, output: '{\n  "a": [\n    1,\n    2\n  ],\n  "b": 1\n}' });
    expect(formatJson('{ "a": 1 }', { indent: 0 })).toEqual({ ok: true, output: '{"a":1}' });
    const bad = formatJson('{\n  "a": 1,\n}', { indent: 2 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.line).toBe(3);
  });

  it("hashes text with SHA-256", async () => {
    expect(await hashText("SHA-256", "abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("random", () => {
  it("generates passwords that honour every selected set", () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword({ length: 12, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: true });
      expect(p).toHaveLength(12);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[^a-zA-Z0-9]/);
      expect(p).not.toMatch(/[0O1lI]/);
    }
    expect(() => generatePassword({ length: 8, lower: false, upper: false, digits: false, symbols: false, excludeAmbiguous: false })).toThrow();
    expect(Math.round(passwordEntropyBits({ length: 16, lower: true, upper: true, digits: true, symbols: false, excludeAmbiguous: false }))).toBe(95);
  });

  it("generates RFC-compliant UUIDs", () => {
    expect(uuidV4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const v7 = uuidV7(0x0190_0000_0000);
    expect(v7).toMatch(/^01900000-0000-7[0-9a-f]{3}-[89ab]/);
    expect(uuidV7(1) < uuidV7(2)).toBe(true);
  });
});

describe("calculators", () => {
  it("does percentages", () => {
    expect(percentOf(15, 200)).toBe(30);
    expect(whatPercent(30, 120)).toBe(25);
    expect(percentChange(80, 100)).toBe(25);
    expect(percentChange(100, 80)).toBe(-20);
    expect(percentChange(0, 5)).toBeNaN();
  });

  it("calculates exact age including leap days", () => {
    const a = calculateAge(parseDate("1990-05-15")!, parseDate("2026-11-06")!)!;
    expect([a.years, a.months, a.days]).toEqual([36, 5, 22]);
    const leap = calculateAge(parseDate("2000-02-29")!, parseDate("2023-02-28")!)!;
    expect(leap.years).toBe(23);
    expect(leap.daysToNextBirthday).toBe(366);
    expect(calculateAge(parseDate("2030-01-01")!, parseDate("2026-01-01")!)).toBeNull();
    expect(parseDate("2023-02-30")).toBeNull();
  });

  it("computes BMI", () => {
    expect(bmi(70, 175)).toBeCloseTo(22.86, 2);
    expect(bmiCategory(22.86)).toBe("Healthy weight");
    expect(bmiCategory(31)).toBe("Obesity");
  });

  it("computes loan payments", () => {
    const l = loan(200_000, 6, 30)!;
    expect(l.monthly).toBeCloseTo(1199.1, 1);
    expect(l.schedule).toHaveLength(30);
    expect(l.schedule.at(-1)!.balance).toBeCloseTo(0, 4);
    expect(loan(1200, 0, 1)!.monthly).toBe(100);
  });

  it("computes compound interest", () => {
    const yearly = compound(1000, 10, 2, 1, 0)!;
    expect(yearly.at(-1)!.balance).toBeCloseTo(1210, 6);
    const withDeposits = compound(0, 0, 1, 12, 100)!;
    expect(withDeposits.at(-1)!.balance).toBeCloseTo(1200, 6);
  });

  it("converts units exactly", () => {
    expect(convertUnit("length", 1, "in", "cm")).toBeCloseTo(2.54, 12);
    expect(convertUnit("mass", 1, "kg", "lb")).toBeCloseTo(2.20462262, 6);
    expect(convertUnit("temperature", 100, "c", "f")).toBeCloseTo(212, 10);
    expect(convertUnit("temperature", -40, "f", "c")).toBeCloseTo(-40, 10);
    expect(convertUnit("data", 1, "gib", "mb")).toBeCloseTo(1073.741824, 9);
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
  });
});

describe("formats", () => {
  it("builds escaped Wi-Fi payloads", () => {
    expect(wifiPayload({ ssid: 'My;Net"', password: "p:a,s\\s", security: "WPA", hidden: true })).toBe('WIFI:T:WPA;S:My\\;Net\\";P:p\\:a\\,s\\\\s;H:true;;');
    expect(wifiPayload({ ssid: "Open", password: "x", security: "nopass", hidden: false })).toBe("WIFI:T:nopass;S:Open;;");
  });

  it("builds vCards with only filled fields", () => {
    const v = vcardPayload({ firstName: "Ada", lastName: "Lovelace", organization: "Analytical, Ltd", title: "", phone: "+44 1", email: "ada@example.com", website: "", address: "" });
    expect(v).toContain("FN:Ada Lovelace");
    expect(v).toContain("ORG:Analytical\\, Ltd");
    expect(v).not.toContain("TITLE");
    expect(v.split("\r\n")[0]).toBe("BEGIN:VCARD");
  });

  it("escapes meta tag values", () => {
    const html = metaTags({ title: 'A "quoted" <title>', description: "d", url: "", image: "", siteName: "", twitterHandle: "yonix", noindex: false, type: "website" });
    expect(html).toContain("<title>A &quot;quoted&quot; &lt;title&gt;</title>");
    expect(html).toContain('content="@yonix"');
    expect(html).toContain('twitter:card" content="summary"');
  });

  it("writes robots.txt", () => {
    const t = robotsTxt({ defaultPolicy: "allow", disallow: ["admin", "/private/"], rules: [], blockAi: true, sitemaps: ["https://x.com/sitemap.xml"] });
    expect(t).toContain("User-agent: *\nDisallow: /admin\nDisallow: /private/");
    expect(t).toContain("User-agent: GPTBot");
    expect(t.trim().endsWith("Sitemap: https://x.com/sitemap.xml")).toBe(true);
  });

  it("runs regexes safely", () => {
    const r = runRegex("(?<y>\\d{4})-(\\d{2})", "g", "2024-01 and 2025-12");
    expect(r.ok && r.matches.map((m) => m.named.y)).toEqual(["2024", "2025"]);
    const empty = runRegex("x*", "g", "abc");
    expect(empty.ok && empty.matches.length).toBe(4);
    expect(runRegex("(", "", "a").ok).toBe(false);
  });
});
