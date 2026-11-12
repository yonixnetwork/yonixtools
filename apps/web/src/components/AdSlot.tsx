"use client";
import { useEffect, useId, useRef, useState } from "react";
import { reportAd } from "@/lib/ads/report";
import { AD_ORIGIN, AD_SANDBOX, AD_UNITS, ADS_ENABLED, adFrameUrl, FILL_TIMEOUT_MS, type AdUnitId } from "@/lib/ads/config";

/**
 * One advertising placement.
 *
 * - `unit` picks a fixed unit; `responsive="leaderboard"` picks 728×90 on wide
 *   screens and 320×50 on phones (never a stretched banner).
 * - Loads only when the slot comes near the viewport, inside its own iframe on the
 *   separate ad origin (see lib/ads/config.ts). Renders nothing if no ad origin is set.
 *   Banners reserve their exact size; native reserves a small strip and grows
 *   to the creative's height. The "Advertisement" label appears only once a
 *   real creative has rendered.
 * - Collapses when nothing renders: at once if the ad scripts fail (ad blocker,
 *   network), otherwise after about 8 s without a creative.
 * - One instance of each unit per page: a second mount of the same unit stays empty.
 */
type Props = {
  unit?: AdUnitId;
  responsive?: "leaderboard";
  className?: string;
  /** Allow a second instance of a unit (its own isolated frame). */
  duplicate?: boolean;
  /** Placement id from lib/ads/placements.ts (anonymous delivery counts). */
  placement?: string;
};

const mounted = new Set<AdUnitId>(); // unit ids currently on the page

function pick(unit: AdUnitId | undefined, responsive: Props["responsive"]): AdUnitId | null {
  if (unit) return unit;
  if (responsive === "leaderboard") return window.matchMedia("(min-width: 768px)").matches ? "banner728x90" : "banner320x50";
  return null;
}

export function AdSlot({ unit, responsive, className, duplicate, placement }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const slotId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [chosen, setChosen] = useState<AdUnitId | null>(null);
  const [near, setNear] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "filled" | "empty">("idle");
  const [height, setHeight] = useState<number | null>(null);
  const [dropped, setDropped] = useState(false); // this page already shows the unit, or ads are off

  // Decide the unit on the client (depends on screen width) and claim it for this page.
  useEffect(() => {
    if (!ADS_ENABLED) return;
    const u = pick(unit, responsive);
    if (!u) return setDropped(true);
    if (duplicate) return setChosen(u);
    if (mounted.has(u)) return setDropped(true); // already shown on this page: never duplicate a unit
    mounted.add(u);
    setChosen(u);
    return () => {
      mounted.delete(u);
    };
  }, [unit, responsive, duplicate]);

  // Lazy: start loading when the slot is within ~300px of the viewport.
  useEffect(() => {
    if (!chosen || !ref.current) return;
    if (!("IntersectionObserver" in window)) return setNear(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (setNear(true), io.disconnect()), { rootMargin: "300px 0px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [chosen]);

  // Messages from this slot's own frame only: the sending window must be this slot's
  // iframe AND the origin must be the configured ad origin. Only state and height are used.
  useEffect(() => {
    if (!near || !chosen) return;
    setState("loading");
    // One final outcome per slot for the anonymous delivery counts.
    let outcome: "filled" | "empty" | "blocked" | null = null;
    const finish = (o: "filled" | "empty" | "blocked") => { if (!outcome) { outcome = o; reportAd(placement, chosen, o); } };
    reportAd(placement, chosen, "requested");
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { ytxAd?: unknown; state?: unknown; height?: unknown; reason?: unknown };
      if (!d || typeof d !== "object" || d.ytxAd !== slotId || e.source !== frame.current?.contentWindow || e.origin !== AD_ORIGIN) return;
      if (d.state === "filled") {
        setState("filled");
        finish("filled");
        if (AD_UNITS[chosen].fluid && typeof d.height === "number" && d.height > 0) setHeight(Math.min(Math.max(Math.round(d.height), 40), 1200));
      } else if (d.state === "empty") {
        setState((s) => (s === "filled" ? s : "empty"));
        finish(d.reason === "blocked" ? "blocked" : "empty");
      }
    };
    window.addEventListener("message", onMsg);
    // Safety net: a frame that never reports (failed to load, e.g. blocked) must not hold space.
    const t = window.setTimeout(() => { setState((s) => (s === "filled" ? s : "empty")); finish("blocked"); }, FILL_TIMEOUT_MS);
    return () => {
      window.removeEventListener("message", onMsg);
      window.clearTimeout(t);
    };
  }, [near, slotId, chosen, placement]);

  // An empty slot collapses without moving what the visitor is looking at: right away when
  // it's off screen, otherwise once it scrolls out of view or after the next tap/key press
  // (layout changes right after input don't count as layout shift). Until then it's blank, unlabeled.
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (state !== "empty" || !ref.current) return;
    const el = ref.current;
    const collapse = () => setGone(true);
    const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.every((e) => !e.isIntersecting) && collapse()) : null;
    if (io) io.observe(el);
    else collapse();
    // Only once a tap/click has FINISHED (after its click event): collapsing on pointerdown would
    // move the controls under the pointer mid-click when the slot sits above a tool.
    let t: number | undefined;
    const later = () => { window.clearTimeout(t); t = window.setTimeout(collapse, 0); };
    const onKey = (e: KeyboardEvent) => { // never shift a field the visitor is typing in
      const f = document.activeElement;
      if (!f || f === document.body || !(el.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING) || e.key === "Tab") later();
    };
    const opts = { capture: true, passive: true } as const;
    window.addEventListener("pointerup", later, opts);
    window.addEventListener("keyup", onKey, opts);
    return () => {
      io?.disconnect();
      window.clearTimeout(t);
      window.removeEventListener("pointerup", later, opts);
      window.removeEventListener("keyup", onKey, opts);
    };
  }, [state]);

  if (!ADS_ENABLED || dropped || gone) return null;
  if (!chosen) {
    // Server render and first paint: reserve the slot's size in the HTML (label hidden until an ad renders).
    const fixed = unit ? AD_UNITS[unit] : null;
    return (
      <aside ref={ref} className={`ad-slot ad-reserve${responsive ? " ad-leaderboard" : ""}${unit ? ` ad-${unit}` : ""}${className ? ` ${className}` : ""}`} aria-hidden="true">
        <span className="ad-label">Advertisement</span>
        <div className="ad-box" style={fixed ? { width: fixed.fluid ? "100%" : fixed.width, maxWidth: "100%", height: fixed.height } : undefined} />
      </aside>
    );
  }
  const u = AD_UNITS[chosen];
  const fluid = u.fluid;
  const h = fluid ? (height ?? u.height) : u.height;
  return (
    <aside ref={ref} className={`ad-slot ad-${chosen}${className ? ` ${className}` : ""}`} aria-label="Advertisement" data-ad-unit={chosen} data-ad-state={state} data-ad-placement={placement}>
      <span className="ad-label">Advertisement</span>
      <div className="ad-box" style={{ width: fluid ? "100%" : u.width, maxWidth: "100%", height: h }}>
        {near && (
          <iframe
            ref={frame}
            title="Advertisement"
            className="ad-frame"
            width={fluid ? "100%" : u.width}
            height={h}
            sandbox={AD_SANDBOX}
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
            scrolling="no"
            src={adFrameUrl(chosen, slotId)}
          />
        )}
      </div>
    </aside>
  );
}
