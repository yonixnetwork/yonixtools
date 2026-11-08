import { afterEach, describe, expect, it, vi } from "vitest";
import { dismissedRecently, isIosSafari, rememberDismissal } from "@/lib/pwa";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1",
  ipadOs: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
};

describe("iOS Safari detection (Add to Home Screen guide)", () => {
  it("targets only Safari on iPhone and iPad", () => {
    expect(isIosSafari(UA.iphoneSafari, 5)).toBe(true);
    expect(isIosSafari(UA.ipadOs, 5)).toBe(true); // iPadOS reports a Mac UA, but with touch
    expect(isIosSafari(UA.iphoneChrome, 5)).toBe(false);
    expect(isIosSafari(UA.macSafari, 0)).toBe(false); // desktop Safari: no guide
    expect(isIosSafari(UA.android, 5)).toBe(false);
  });
});

describe("install invitation dismissal", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("is remembered for 30 days", () => {
    const m = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) });
    const now = Date.UTC(2026, 10, 8);
    expect(dismissedRecently(now)).toBe(false);
    rememberDismissal(now);
    expect(dismissedRecently(now + 29 * 86_400_000)).toBe(true);
    expect(dismissedRecently(now + 31 * 86_400_000)).toBe(false);
  });
});
