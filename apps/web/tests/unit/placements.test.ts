import { describe, expect, it } from "vitest";
import { LIMITS, PLACEMENTS, type Device, type PageType } from "@/lib/ads/placements";

// The central placement table keeps the owner's rules (12 Nov 2026).
const PAGES: PageType[] = ["home", "tool", "downloader", "listing"];
const DEVICES: Device[] = ["mobile", "desktop"];
const on = PLACEMENTS.filter((p) => p.enabled);
const units = (page: PageType, d: Device) => on.filter((p) => p.page === page && p.devices.includes(d)).map((p) => (p.format === "leaderboard" ? (d === "mobile" ? "banner320x50" : "banner728x90") : p.format));

describe("central ad placements", () => {
  it("ids are unique and well formed", () => {
    const ids = PLACEMENTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PLACEMENTS) expect(p.id, p.id).toMatch(new RegExp(`^${p.page}\\.[a-z0-9-]+$`));
  });

  for (const page of PAGES)
    for (const d of DEVICES)
      it(`${page} / ${d}: no repeated zone, at most one native, within the per-page limit`, () => {
        const u = units(page, d);
        expect(new Set(u).size, u.join(", ")).toBe(u.length);
        expect(u.filter((x) => x === "native").length).toBeLessThanOrEqual(LIMITS.nativePerPage);
        const adsterra = on.filter((p) => p.page === page && p.devices.includes(d) && p.network === "adsterra");
        expect(adsterra.length, adsterra.map((p) => p.id).join(", ")).toBeLessThanOrEqual(LIMITS.adsterraPerPage);
      });

  it("never Monetag on the homepage or downloader pages, and the download panel has no ad", () => {
    expect(on.filter((p) => p.network === "monetag" && (p.page === "home" || p.page === "downloader"))).toEqual([]);
    expect(on.filter((p) => p.position === "download-panel")).toEqual([]);
  });

  it("the native unit is never shown on phones (it stacks into one tall column)", () => {
    expect(on.filter((p) => p.format === "native" && p.devices.includes("mobile"))).toEqual([]);
  });

  it("no ad above the URL box on downloader pages", () => {
    expect(on.filter((p) => p.page === "downloader" && p.position === "before-tool")).toEqual([]);
  });
});
