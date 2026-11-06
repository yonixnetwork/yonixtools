"use client";
import { ArrowRight, Clock, Search } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ToolIcon } from "./Icon";
import { getRecent } from "@/lib/recent";
import { toolPath } from "@/lib/site";
import type { Tool } from "@/lib/registry";
import type { SearchResponse } from "@/lib/search";

type SearchModule = typeof import("@/lib/search-client");
let modPromise: Promise<SearchModule> | null = null;
const loadSearch = () => (modPromise ??= import("@/lib/search-client"));

type Option = { id: string; href: string; tool?: Tool; label?: string };

export function SearchBox({ size, autoFocus, placeholder = "Search tools", shortcut }: { size?: "lg"; autoFocus?: boolean; placeholder?: string; shortcut?: boolean }) {
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

  const response: SearchResponse | null = useMemo(() => (mod && q.trim() ? mod.searchTools(q, { limit: 6 }) : null), [mod, q]);

  const options: Option[] = useMemo(() => {
    if (!mod) return [];
    if (!q.trim()) {
      return recent
        .map((s) => mod.getTool(s))
        .filter((t): t is Tool => !!t)
        .slice(0, 5)
        .map((t) => ({ id: `r-${t.slug}`, href: toolPath(t.slug), tool: t }));
    }
    const opts: Option[] = (response?.results ?? []).map((r) => ({ id: `t-${r.tool.slug}`, href: toolPath(r.tool.slug), tool: r.tool }));
    opts.push({ id: "all", href: `/tools/?q=${encodeURIComponent(q.trim())}`, label: `See all results for “${q.trim()}”` });
    return opts;
  }, [mod, q, recent, response]);

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
      else if (q.trim()) go({ id: "all", href: `/tools/?q=${encodeURIComponent(q.trim())}` });
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
        placeholder={placeholder}
        aria-label="Search tools"
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
        <div className="suggest" id={listId} role="listbox" aria-label="Search suggestions">
          {!q.trim() && options.length > 0 && <div className="suggest-label">Recently used</div>}
          {q.trim() && response?.partial && <div className="suggest-label">No exact match: related tools</div>}
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
                      {o.tool.status === "awaiting-backend" ? "Backend coming soon · " : ""}
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
              {response.planned.map((p) => p.name).join(", ")} {response.planned.length > 1 ? "are" : "is"} planned but not available yet.
            </div>
          )}
          {!q.trim() && (
            <>
              <div className="suggest-label">Popular searches</div>
              <div className="row" style={{ gap: 6, padding: "4px 8px 8px" }}>
                {mod.popularSearches.map((s) => (
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
