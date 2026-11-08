"use client";
import { useEffect, useId, useRef, useState } from "react";
import { AD_ISOLATION, AD_ORIGIN, AD_UNITS, ADS_ENABLED, adFrameUrl, FILL_TIMEOUT_MS, NATIVE_RESERVE_PX, SANDBOX, type AdDiag, type AdIsolation, type AdUnitId } from "@/lib/ads/config";

/**
 * One advertising placement.
 *
 * - `unit` picks a fixed unit; `responsive="leaderboard"` picks 728×90 on wide
 *   screens and 320×50 on phones (never a stretched banner).
 * - Loads only when the slot comes near the viewport, inside its own iframe.
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
  isolation?: AdIsolation;
  /** Diagnostics page only: show unit/state, never collapse, allow the same unit twice. */
  debug?: boolean;
  /** Diagnostics page only: receives each state/diagnostic report from the frame. */
  onReport?: (r: { unit: AdUnitId; isolation: AdIsolation; state: string; height?: number; diag?: AdDiag }) => void;
};

const mounted = new Set<AdUnitId>(); // unit ids currently on the page

function pick(unit: AdUnitId | undefined, responsive: Props["responsive"]): AdUnitId | null {
  if (unit) return unit;
  if (responsive === "leaderboard") return window.matchMedia("(min-width: 768px)").matches ? "banner728x90" : "banner320x50";
  return null;
}

export function AdSlot({ unit, responsive, className, isolation = AD_ISOLATION, debug, onReport }: Props) {
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
    if (debug) return setChosen(u);
    if (mounted.has(u)) return setDropped(true); // already shown on this page: never duplicate a unit
    mounted.add(u);
    setChosen(u);
    return () => {
      mounted.delete(u);
    };
  }, [unit, responsive, debug]);

  // Lazy: start loading when the slot is within ~300px of the viewport.
  useEffect(() => {
    if (!chosen || !ref.current) return;
    if (!("IntersectionObserver" in window)) return setNear(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (setNear(true), io.disconnect()), { rootMargin: "300px 0px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [chosen]);

  // Messages from this slot's own frame only (checked by window and origin).
  const report = useRef(onReport);
  report.current = onReport;
  useEffect(() => {
    if (!near || !chosen) return;
    setState("loading");
    const expected = isolation === "sandboxed" ? "null" : AD_ORIGIN || location.origin;
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { ytxAd?: string; state?: string; height?: number; diag?: AdDiag };
      if (!d || d.ytxAd !== slotId || e.source !== frame.current?.contentWindow || e.origin !== expected) return;
      report.current?.({ unit: chosen, isolation, state: d.state ?? "", height: d.height, diag: d.diag });
      if (d.state === "filled") {
        setState("filled");
        if (chosen === "native" && typeof d.height === "number" && d.height > 0) setHeight(Math.min(Math.max(d.height, 60), 1200));
      } else if (d.state === "empty") setState((s) => (s === "filled" ? s : "empty"));
    };
    window.addEventListener("message", onMsg);
    // Safety net: a frame that never reports (failed to load) must not hold space.
    const t = window.setTimeout(() => setState((s) => (s === "filled" ? s : "empty")), FILL_TIMEOUT_MS);
    return () => {
      window.removeEventListener("message", onMsg);
      window.clearTimeout(t);
    };
  }, [near, slotId, chosen, isolation]);

  // An empty slot collapses without moving what the visitor is looking at: right away when
  // it's off screen, otherwise once it scrolls out of view or on the next tap/key press
  // (layout changes right after input don't count as layout shift). Until then it's blank, unlabeled.
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (state !== "empty" || debug || !ref.current) return;
    const el = ref.current;
    const collapse = () => setGone(true);
    const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.every((e) => !e.isIntersecting) && collapse()) : null;
    if (io) io.observe(el);
    else collapse();
    const opts = { capture: true, passive: true } as const;
    window.addEventListener("pointerdown", collapse, opts);
    window.addEventListener("keydown", collapse, opts);
    return () => {
      io?.disconnect();
      window.removeEventListener("pointerdown", collapse, opts);
      window.removeEventListener("keydown", collapse, opts);
    };
  }, [state, debug]);

  if (!ADS_ENABLED || dropped || gone) return null;
  if (!chosen) {
    // Server render and first paint: reserve the slot's size in the HTML (label hidden until an ad renders).
    const fixed = unit ? AD_UNITS[unit] : null;
    return (
      <aside ref={ref} className={`ad-slot ad-reserve${responsive ? " ad-leaderboard" : ""}${unit ? ` ad-${unit}` : ""}${className ? ` ${className}` : ""}`} aria-hidden="true">
        <span className="ad-label">Advertisement</span>
        <div className="ad-box" style={fixed ? { width: unit === "native" ? "100%" : fixed.width, maxWidth: "100%", height: unit === "native" ? NATIVE_RESERVE_PX : fixed.height } : undefined} />
      </aside>
    );
  }
  const u = AD_UNITS[chosen];
  const isNative = chosen === "native";
  const h = isNative ? (height ?? NATIVE_RESERVE_PX) : u.height;
  return (
    <aside ref={ref} className={`ad-slot ad-${chosen}${debug ? " ad-debug" : ""}${className ? ` ${className}` : ""}`} aria-label="Advertisement" data-ad-unit={chosen} data-ad-state={state}>
      <span className="ad-label">{debug ? `${u.label} · ${isolation} · ${state}` : "Advertisement"}</span>
      <div className="ad-box" style={{ width: isNative ? "100%" : u.width, maxWidth: "100%", height: h }}>
        {near && (
          <iframe
            ref={frame}
            title="Advertisement"
            className="ad-frame"
            width={isNative ? "100%" : u.width}
            height={h}
            sandbox={SANDBOX[isolation]}
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
