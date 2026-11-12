"use client";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GRID_AD_AFTER, GRID_AD_MIN } from "@/lib/ads/placements";
import { ToolCard } from "./ToolCard";
import { searchTools, popularSearches } from "@/lib/search";
import { categories, tools, type CategoryId } from "@/lib/registry";

/** gridAd: a full-width ad break after the first rows (long, unsearched lists only; it stays mounted while filtering, so it never reloads). */
export function ToolsExplorer({ gridAd }: { gridAd?: ReactNode } = {}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<CategoryId | "all">("all");

  // Read ?q= / ?category= on the client (the page itself is static).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ(p.get("q") ?? "");
    const c = p.get("category");
    if (c && categories.some((x) => x.id === c)) setCat(c as CategoryId);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (cat !== "all") p.set("category", cat);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [q, cat]);

  const res = useMemo(() => searchTools(q, { category: cat === "all" ? undefined : cat, limit: 100 }), [q, cat]);
  const list = q.trim() ? res.results.map((r) => r.tool) : tools.filter((t) => cat === "all" || t.category === cat);

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="search-box lg">
        <Search aria-hidden />
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, task or keyword, e.g. “compress photo” or “ig reels”" aria-label="Search tools" autoComplete="off" spellCheck={false} />
      </div>
      <div className="row" style={{ gap: 6 }} role="group" aria-label="Filter by category">
        <button type="button" className="chip" aria-pressed={cat === "all"} style={cat === "all" ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined} onClick={() => setCat("all")}>
          All ({tools.length})
        </button>
        {categories.map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={cat === c.id} style={cat === c.id ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined} onClick={() => setCat(c.id)}>
            {c.name} ({tools.filter((t) => t.category === c.id).length})
          </button>
        ))}
      </div>

      <p className="muted" aria-live="polite" style={{ fontSize: "0.9rem" }} data-testid="result-count">
        {q.trim() ? `${list.length} result${list.length === 1 ? "" : "s"} for “${q.trim()}”${res.partial ? " (closest matches)" : ""}` : `${list.length} tools`}
      </p>

      {q.trim() && res.planned.length > 0 && (
        <div className="notice notice-info" role="status">
          <div>
            <strong>{res.planned.map((p) => p.name).join(", ")} {res.planned.length > 1 ? "are" : "is"} planned but not available yet.</strong>
            {list.length > 0 ? "In the meantime, these tools may help:" : "Check back soon."}
          </div>
        </div>
      )}

      {list.length > 0 ? (
        <div className="tool-grid">
          {list.map((t, i) => [
            <ToolCard key={t.slug} tool={t} headingLevel={2} />,
            gridAd && !q.trim() && i === GRID_AD_AFTER - 1 && list.length >= GRID_AD_MIN && <div key="ad" className="grid-break">{gridAd}</div>,
          ])}
        </div>
      ) : (
        <div className="empty card">
          <h2 style={{ fontSize: "1.2rem" }}>No tools match “{q.trim()}”</h2>
          <p>Try a different word, or one of these popular searches:</p>
          <div className="row" style={{ justifyContent: "center", marginTop: 14, gap: 6 }}>
            {popularSearches.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => (setQ(s), setCat("all"))}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
