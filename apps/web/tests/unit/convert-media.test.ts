import { describe, expect, it } from "vitest";
import { contrast, convertBase, formatColor, formatInZone, offsetLabel, parseColor, parseTimestamp, wallTimeToInstant, zoneOffsetMinutes } from "@/lib/tools/convert";
import { aspectRatio, encodeWav, formatBytes, formatClock, randomIntegers } from "@/lib/tools/media";

describe("colour converter", () => {
  it("parses every common notation to the same colour", () => {
    for (const s of ["#1e90ff", "1E90FF", "rgb(30, 144, 255)", "rgb(30 144 255)", "hsl(210, 100%, 56%)"]) {
      const c = parseColor(s)!;
      expect(c, s).not.toBeNull();
      expect(Math.abs(c.r - 30) + Math.abs(c.g - 144) + Math.abs(c.b - 255), s).toBeLessThanOrEqual(6);
    }
    expect(parseColor("#abc")).toEqual({ r: 170, g: 187, b: 204, a: 1 });
    expect(parseColor("#11223380")!.a).toBeCloseTo(0.502, 2);
    expect(parseColor("rgba(0,0,0,0.5)")!.a).toBe(0.5);
  });
  it("rejects nonsense", () => {
    for (const s of ["", "#12", "#ggg", "rgb(1,2)", "hsl(x, 1%, 2%)", "blue-ish"]) expect(parseColor(s), s).toBeNull();
  });
  it("formats HEX, RGB and HSL", () => {
    expect(formatColor({ r: 255, g: 0, b: 0, a: 1 })).toEqual({ hex: "#FF0000", rgb: "rgb(255, 0, 0)", hsl: "hsl(0, 100%, 50%)" });
    expect(formatColor({ r: 0, g: 0, b: 0, a: 0.5 }).rgb).toBe("rgba(0, 0, 0, 0.5)");
  });
  it("computes WCAG contrast", () => {
    expect(contrast({ r: 255, g: 255, b: 255, a: 1 }).black).toBe(21);
    expect(contrast({ r: 0, g: 0, b: 0, a: 1 }).white).toBe(21);
  });
});

describe("timestamp converter", () => {
  it("detects seconds vs milliseconds", () => {
    expect(parseTimestamp("1700000000")).toMatchObject({ unit: "seconds" });
    expect(parseTimestamp("1700000000")!.date.toISOString()).toBe("2023-11-14T22:13:20.000Z");
    expect(parseTimestamp("1700000000123")!.date.toISOString()).toBe("2023-11-14T22:13:20.123Z");
    expect(parseTimestamp("2024-02-29T12:00:00Z")).toMatchObject({ unit: "date" });
    expect(parseTimestamp("not a date")).toBeNull();
    expect(parseTimestamp("")).toBeNull();
  });
});

describe("number base converter", () => {
  it("converts arbitrary-size integers", () => {
    expect(convertBase("255", 10, 16)).toBe("FF");
    expect(convertBase("0xff", 16, 2)).toBe("11111111");
    expect(convertBase("-1010", 2, 10)).toBe("-10");
    expect(convertBase("zz", 36, 10)).toBe("1295");
    expect(convertBase("123456789012345678901234567890", 10, 16)).toBe("18EE90FF6C373E0EE4E3F0AD2");
    expect(convertBase("0", 10, 2)).toBe("0");
  });
  it("rejects digits outside the base", () => {
    expect(convertBase("102", 2, 10)).toBeNull();
    expect(convertBase("1.5", 10, 2)).toBeNull();
    expect(convertBase("", 10, 2)).toBeNull();
  });
});

describe("time zone converter", () => {
  it("knows zone offsets including DST", () => {
    expect(zoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "Europe/Paris")).toBe(60);
    expect(zoneOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "Europe/Paris")).toBe(120);
    expect(zoneOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "Asia/Kolkata")).toBe(330);
    expect(offsetLabel(330)).toBe("UTC+05:30");
    expect(offsetLabel(-300)).toBe("UTC−05:00");
  });
  it("turns a wall-clock time in one zone into the right instant", () => {
    expect(wallTimeToInstant("2026-07-15T09:00", "America/New_York")!.toISOString()).toBe("2026-07-15T13:00:00.000Z");
    expect(wallTimeToInstant("2026-01-15T09:00", "Asia/Tokyo")!.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(formatInZone(new Date("2026-01-15T00:00:00Z"), "Europe/London")).toContain("00:00");
    expect(wallTimeToInstant("bad", "UTC")).toBeNull();
  });
});

describe("media helpers", () => {
  it("writes a valid WAV header and samples", () => {
    const buf = encodeWav([new Float32Array([0, 1, -1]), new Float32Array([0, 0.5, -0.5])], 44100);
    const v = new DataView(buf);
    const str = (o: number) => String.fromCharCode(...new Uint8Array(buf, o, 4));
    expect([str(0), str(8), str(12), str(36)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint32(40, true)).toBe(12);
    expect(buf.byteLength).toBe(56);
    expect(v.getInt16(48, true)).toBe(32767);
    expect(v.getInt16(52, true)).toBe(-32768);
  });
  it("formats clocks, sizes and ratios", () => {
    expect(formatClock(3725.5, true)).toBe("1:02:05.500");
    expect(formatClock(65)).toBe("1:05");
    expect(formatBytes(1_500_000)).toBe("1.5 MB");
    expect(formatBytes(512)).toBe("512 B");
    expect(aspectRatio(1920, 1080)).toBe("16:9");
  });
  it("draws random integers within range, unique when asked", () => {
    const xs = randomIntegers(1, 10, 10, true);
    expect([...xs].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const ys = randomIntegers(-5, 5, 500, false);
    expect(ys.every((y) => y >= -5 && y <= 5)).toBe(true);
    expect(new Set(randomIntegers(0, 2 ** 31, 1000, true)).size).toBe(1000);
    expect(() => randomIntegers(1, 3, 4, true)).toThrow(/Only 3/);
    expect(() => randomIntegers(5, 1, 1, false)).toThrow();
  });
});
