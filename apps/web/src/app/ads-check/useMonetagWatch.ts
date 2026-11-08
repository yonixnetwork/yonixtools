"use client";
import { useEffect, useState } from "react";
import { MONETAG_ENABLED, MONETAG_ZONES } from "@/lib/ads/monetag";

export interface MonetagWatch {
  scripts: Record<string, string>; // zone -> "not added" | "requested" | "loaded @Nms" | "failed @Nms"
  csp: string[]; // blocked by this site's Content Security Policy
  overlays: string[]; // visible fixed/absolute elements or frames added to the page after load
}

/** Read-only observer for /ads-check/: what the Monetag zones actually did on this page. */
export function useMonetagWatch(): MonetagWatch {
  const [events, setEvents] = useState<Record<string, string>>({});
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [csp, setCsp] = useState<string[]>([]);
  const [overlays, setOverlays] = useState<string[]>([]);
  useEffect(() => {
    if (!MONETAG_ENABLED) return;
    const t0 = performance.now();
    const zones = Object.values(MONETAG_ZONES).map((z) => z.zone);
    const known = new Set(Array.from(document.body.children));
    const ms = () => Math.round(performance.now() - t0);
    const zoneOf = (el: EventTarget | null) => (el instanceof HTMLScriptElement ? el.dataset.zone : undefined);
    const onLoad = (e: Event) => {
      const z = zoneOf(e.target);
      if (z) setEvents((p) => ({ ...p, [z]: `loaded @${ms()}ms` }));
    };
    const onError = (e: Event) => {
      const z = zoneOf(e.target);
      if (z) setEvents((p) => ({ ...p, [z]: `failed @${ms()}ms (blocked: CSP, ad blocker or network)` }));
    };
    const onCsp = (e: SecurityPolicyViolationEvent) => setCsp((p) => (p.length > 20 ? p : [...p, `${e.effectiveDirective} blocked ${e.blockedURI || "inline"}`]));
    document.addEventListener("load", onLoad, true);
    document.addEventListener("error", onError, true);
    document.addEventListener("securitypolicyviolation", onCsp);
    const scan = () => {
      setPresent(Object.fromEntries(zones.map((z) => [z, !!document.querySelector(`script[data-zone="${z}"]`)])));
      const overlays: string[] = [];
      for (const root of [document.body, document.documentElement]) {
        for (const el of Array.from(root.children) as HTMLElement[]) {
          if (known.has(el) || ["SCRIPT", "STYLE", "LINK", "HEAD", "BODY"].includes(el.tagName)) continue;
          const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          const visible = cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0 && r.width * r.height > 1500;
          overlays.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} ${cs.position}${visible ? " VISIBLE" : " hidden"}`);
        }
      }
      setOverlays(overlays.slice(0, 10));
    };
    const iv = window.setInterval(scan, 1000);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener("load", onLoad, true);
      document.removeEventListener("error", onError, true);
      document.removeEventListener("securitypolicyviolation", onCsp);
    };
  }, []);
  const scripts = Object.fromEntries(Object.values(MONETAG_ZONES).map((z) => [z.zone, events[z.zone] ?? (present[z.zone] ? "requested" : "not added yet")]));
  return { scripts, csp, overlays };
}
