"use client";
import { ArrowRight, Clock, Search } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ToolIcon } from "./Icon";
import { getRecent } from "@/lib/recent";
import type { Tool } from "@/lib/registry";
import { isAvailable } from "@/lib/registry/availability";
import type { SearchResponse } from "@/lib/search";
import { useT } from "@/i18n/client";
import { useToolIndex } from "@/i18n/tool-index";

type SearchModule = typeof import("@/lib/search-client");
let modPromise: Promise<SearchModule> | null = null;
const loadSearch = () => (modPromise ??= import("@/lib/search-client"));

/** Localized popular searches (English pages use lib/search popularSearches). */
const POPULAR_KEYS = ["search.popular.0", "search.popular.1", "search.popular.2", "search.popular.3", "search.popular.4", "search.popular.5"];

type Option = { id: string; href: string; tool?: Tool; label?: string };

export function SearchBox({ size, autoFocus, placeholder, shortcut }: { size?: "lg"; autoFocus?: boolean; placeholder?: string; shortcut?: boolean }) {
  const t = useT("common");
  const ix = useToolIndex();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [mod, setMod] = useState<SearchModule | null>(null);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const ensure = useCallback(() => {
    loadSearch().then(setMod);
    setRecent(getRecent());
  }, []);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const response: SearchResponse | null = useMemo(() => (mod && q.trim() ? mod.searchTools(q, { limit: 6, localized: ix.text }) : null), [mod, q, ix.text]);

  const options: Option[] = useMemo(() => {
    if (!mod) return [];
    if (!q.trim()) {
      return recent
        .map((s) => mod.getTool(s))
        .filter((t): t is Tool => !!t)
        .slice(0, 5)
        .map((t) => ({ id: `r-${t.slug}`, href: ix.hrefOf(t.slug), tool: ix.textOf(t) }));
    }
    const opts: Option[] = (response?.results ?? []).map((r) => ({ id: `t-${r.tool.slug}`, href: ix.hrefOf(r.tool.slug), tool: r.tool }));
    opts.push({ id: "all", href: `${ix.toolsPath}?q=${encodeURIComponent(q.trim())}`, label: t("search.seeAll", { query: q.trim() }) });
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mod, q, recent, response, ix.text]);

  useEffect(() => setActive(0), [q]);

  const go = (o?: Option) => {
    if (o) window.location.href = o.href;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[active]) go(options[active]);
      else if (q.trim()) go({ id: "all", href: `${ix.toolsPath}?q=${encodeURIComponent(q.trim())}` });
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showPanel = open && mod;
  const optionId = (o: Option) => `${listId}-${o.id}`;

  return (
    <div className={`search-box${size ? ` ${size}` : ""}`} ref={boxRef} role="search">
      <Search aria-hidden />
      <input
        ref={inputRef}
        className="input"
        type="search"
        value={q}
        placeholder={placeholder ?? t("search.placeholder")}
        aria-label={t("search.aria")}
        role="combobox"
        aria-expanded={!!showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && options[active] ? optionId(options[active]) : undefined}
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        onFocus={() => {
          ensure();
          setOpen(true);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {shortcut && !q && <kbd aria-hidden>/</kbd>}
      {showPanel && (
        <div className="suggest" id={listId} role="listbox" aria-label={t("search.suggestions")}>
          {!q.trim() && options.length > 0 && <div className="suggest-label">{t("search.recent")}</div>}
          {q.trim() && response?.partial && <div className="suggest-label">{t("search.partial")}</div>}
          {options.map((o, i) => (
            <div
              key={o.id}
              id={optionId(o)}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                go(o);
              }}
            >
              {o.tool ? (
                <>
                  <ToolIcon tool={o.tool} />
                  <span className="s-text">
                    <span className="s-name">{o.tool.name}</span>
                    <span className="s-tag" style={{ display: "block" }}>
                      {!isAvailable(o.tool) ? `${t("card.comingSoon")} · ` : ""}
                      {o.tool.tagline}
                    </span>
                  </span>
                  {o.id.startsWith("r-") && <Clock aria-hidden style={{ width: 15, height: 15, color: "var(--muted)" }} />}
                </>
              ) : (
                <>
                  <span className="s-text s-name" style={{ color: "var(--accent)" }}>
                    {o.label}
                  </span>
                  <ArrowRight aria-hidden style={{ width: 16, height: 16, color: "var(--accent)" }} />
                </>
              )}
            </div>
          ))}
          {q.trim() && response && response.planned.length > 0 && (
            <div className="suggest-label" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>
              {t("search.planned", { count: response.planned.length, names: response.planned.map((p) => p.name).join(", ") })}
            </div>
          )}
          {!q.trim() && (
            <>
              <div className="suggest-label">{t("search.popular")}</div>
              <div className="row" style={{ gap: 6, padding: "4px 8px 8px" }}>
                {(ix.text ? POPULAR_KEYS.map((k) => t(k)) : mod.popularSearches).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="chip"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setQ(s);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
