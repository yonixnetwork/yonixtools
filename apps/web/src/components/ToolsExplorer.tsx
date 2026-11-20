"use client";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GRID_AD_AFTER, GRID_AD_MIN } from "@/lib/ads/placements";
import { ToolCard } from "./ToolCard";
import { searchTools, popularSearches } from "@/lib/search";
import { categories, tools, type CategoryId } from "@/lib/registry";
import { useT } from "@/i18n/client";
import { useToolIndex } from "@/i18n/tool-index";

/** gridAd: a full-width ad break after the first rows (long, unsearched lists only; it stays mounted while filtering, so it never reloads). */
export function ToolsExplorer({ gridAd }: { gridAd?: ReactNode } = {}) {
  const t = useT("common");
  const ix = useToolIndex();
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

  const res = useMemo(() => searchTools(q, { category: cat === "all" ? undefined : cat, limit: 100, localized: ix.text }), [q, cat, ix.text]);
  const list = (q.trim() ? res.results.map((r) => r.tool) : tools.filter((x) => cat === "all" || x.category === cat).map(ix.textOf)).map((x) => ({ ...x, href: ix.hrefOf(x.slug) }));
  const popular = ix.text ? [0, 1, 2, 3, 4, 5].map((i) => t(`search.popular.${i}`)) : popularSearches;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="search-box lg">
        <Search aria-hidden />
        <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("explorer.placeholder")} aria-label={t("search.aria")} autoComplete="off" spellCheck={false} />
      </div>
      <div className="row" style={{ gap: 6 }} role="group" aria-label={t("explorer.filter")}>
        <button type="button" className="chip" aria-pressed={cat === "all"} style={cat === "all" ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined} onClick={() => setCat("all")}>
          {t("explorer.all", { count: tools.length })}
        </button>
        {categories.map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={cat === c.id} style={cat === c.id ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined} onClick={() => setCat(c.id)}>
            {t("explorer.categoryCount", { category: ix.categoryName(c.id, c.name), count: tools.filter((x) => x.category === c.id).length })}
          </button>
        ))}
      </div>

      <p className="muted" aria-live="polite" style={{ fontSize: "0.9rem" }} data-testid="result-count">
        {q.trim() ? t(res.partial ? "explorer.resultsClosest" : "explorer.results", { count: list.length, query: q.trim() }) : t("explorer.count", { count: list.length })}
      </p>

      {q.trim() && res.planned.length > 0 && (
        <div className="notice notice-info" role="status">
          <div>
            <strong>{t("search.planned", { count: res.planned.length, names: res.planned.map((p) => p.name).join(", ") })}</strong>
            {list.length > 0 ? t("explorer.meantime") : t("explorer.checkBack")}
          </div>
        </div>
      )}

      {list.length > 0 ? (
        <div className="tool-grid">
          {list.map((x, i) => [
            <ToolCard key={x.slug} tool={x} headingLevel={2} />,
            gridAd && !q.trim() && i === GRID_AD_AFTER - 1 && list.length >= GRID_AD_MIN && <div key="ad" className="grid-break">{gridAd}</div>,
          ])}
        </div>
      ) : (
        <div className="empty card">
          <h2 style={{ fontSize: "1.2rem" }}>{t("explorer.noMatch", { query: q.trim() })}</h2>
          <p>{t("explorer.tryPopular")}</p>
          <div className="row" style={{ justifyContent: "center", marginTop: 14, gap: 6 }}>
            {popular.map((s) => (
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
