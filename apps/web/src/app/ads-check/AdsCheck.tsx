"use client";
import { useCallback, useEffect, useState } from "react";
import { AdSlot } from "@/components/AdSlot";
import { AD_ISOLATION, type AdDiag, type AdIsolation, type AdUnitId } from "@/lib/ads/config";

const UNITS: AdUnitId[] = ["banner320x50", "banner300x250", "banner728x90", "native"];
type Row = { state: string; height?: number; diag?: AdDiag; firstFilledMs?: number };

/** Turns one unit's frame report into a plain-language line for the copied report. */
function verdict(r: Row | undefined): string {
  if (!r) return "not started (scroll down to it)";
  const scripts = Object.values(r.diag?.scripts ?? {});
  if (r.state === "filled") return `AD RENDERED (after ${r.firstFilledMs ?? r.diag?.ms ?? "?"} ms)`;
  if (r.state === "loading") return "loading…";
  if (scripts.length && scripts.every((s) => s.state === "failed")) return "EMPTY: ad script blocked or unreachable (ad blocker, network, DNS)";
  if (r.diag?.errors.length) return "EMPTY: script ran but threw errors (integration problem, see errors)";
  if (scripts.some((s) => s.state === "loaded")) return "EMPTY: script loaded and ran without errors, no creative returned (likely no fill / unit not approved yet)";
  return "EMPTY: no script activity recorded";
}

export function AdsCheck() {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [copied, setCopied] = useState(false);
  const [env, setEnv] = useState({ ua: "", href: "", at: "" });
  useEffect(() => setEnv({ ua: navigator.userAgent, href: location.href, at: new Date().toISOString() }), []);

  const onReport = useCallback((r: { unit: AdUnitId; isolation: AdIsolation; state: string; height?: number; diag?: AdDiag }) => {
    setRows((prev) => {
      const k = `${r.isolation}/${r.unit}`;
      const old = prev[k];
      const firstFilledMs = old?.firstFilledMs ?? (r.state === "filled" ? r.diag?.ms : undefined);
      return { ...prev, [k]: { state: old?.state === "filled" ? "filled" : r.state, height: r.height, diag: r.diag ?? old?.diag, firstFilledMs } };
    });
  }, []);

  const modes: AdIsolation[] = AD_ISOLATION === "same-origin" ? ["same-origin", "sandboxed"] : ["sandboxed", "same-origin"];
  const text = [
    `YoniXTools ad check — ${env.at}`,
    `Page: ${env.href}`,
    `Browser: ${env.ua}`,
    `Site mode: ${AD_ISOLATION}`,
    "",
    ...modes.flatMap((m) => [
      `== ${m}${m === AD_ISOLATION ? " (used by the site)" : " (comparison only)"} ==`,
      ...UNITS.flatMap((u) => {
        const r = rows[`${m}/${u}`];
        const d = r?.diag;
        return [
          `${u}: ${verdict(r)}`,
          ...(d
            ? [
                `  scripts: ${Object.entries(d.scripts).map(([s, v]) => `${s.replace(/^https?:\/\//, "")} ${v.state} @${v.ms}ms`).join("; ") || "none recorded"}`,
                `  frame access: origin=${d.access.origin} cookies=${d.access.cookies} storage=${d.access.storage} top=${d.access.top}`,
                `  errors: ${d.errors.join(" | ") || "none"}`,
                `  dom: ${d.nodes.join(", ") || "empty"}`,
              ]
            : []),
        ];
      }),
      "",
    ]),
  ].join("\n");

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "16px 0" }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => setCopied(false))}
        >
          Copy report
        </button>
        {copied && <span className="muted">Copied</span>}
      </div>
      <pre data-testid="ads-report" style={{ whiteSpace: "pre-wrap", fontSize: "0.75rem", background: "var(--surface-2)", padding: 12, borderRadius: 8, maxHeight: 320, overflow: "auto" }}>{text}</pre>
      {modes.map((mode) => (
        <section key={mode} style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: "1.15rem" }}>
            Mode: {mode} {mode === AD_ISOLATION ? "(used by the site)" : "(comparison only)"}
          </h2>
          {UNITS.map((u) => (
            <AdSlot key={u + mode} unit={u} isolation={mode} debug onReport={onReport} className={u === "native" ? "ad-native" : undefined} />
          ))}
        </section>
      ))}
    </>
  );
}
