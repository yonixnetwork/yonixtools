"use client";
/**
 * Language selector: a button showing the current language that opens a searchable list of every
 * built language, in its own script. Choosing one remembers the choice (localStorage) and opens the
 * same page in that language (paths registered by <PageAlternates> on each page); if the page has no
 * equivalent, the language's home page opens with a short notice. Never automatic: IP addresses are
 * not used, and the browser language is only ever a suggestion (<LanguageSuggest>).
 */
import { Check, ChevronDown, Globe, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useT } from "@/i18n/client";
import { getAlternates, subscribeAlternates } from "@/i18n/alternates";

export interface LanguageOption {
  code: string;
  native: string;
  /** English name, for searching ("German" finds Deutsch). */
  name: string;
  dir: "ltr" | "rtl";
  home: string;
  /** "reviewed": every key human-reviewed; "machine": machine translation, not reviewed yet. */
  status: "reviewed" | "machine" | "source";
}

export const LOCALE_PREF_KEY = "ytx-locale";

export function rememberLocale(code: string) {
  try {
    localStorage.setItem(LOCALE_PREF_KEY, code);
  } catch {
    /* storage unavailable: the choice still applies to this navigation */
  }
}

export function targetFor(lang: LanguageOption, alternates: Record<string, string>): string {
  const p = alternates[lang.code];
  return p ?? `${lang.home}?lang-fallback=1`;
}

export function LanguageSelector({ languages, variant }: { languages: LanguageOption[]; variant?: "drawer" }) {
  const t = useT("common");
  const current = useLocale();
  const alternates = useSyncExternalStore(subscribeAlternates, getAlternates, () => ({}));
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return languages;
    return languages.filter((l) => l.native.toLowerCase().includes(n) || l.name.toLowerCase().includes(n) || l.code.toLowerCase().startsWith(n));
  }, [languages, q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (l: LanguageOption) => {
    rememberLocale(l.code);
    if (l.code === current.code) return setOpen(false);
    window.location.href = targetFor(l, alternates);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(list.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (list[active]) choose(list[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  if (languages.length < 2) return null;
  const optionId = (code: string) => `${listId}-${code}`;
  return (
    <div className={`lang-select${variant === "drawer" ? " lang-select-drawer" : ""}`} ref={boxRef} data-testid={variant === "drawer" ? "lang-select-drawer" : "lang-select"}>
      <button
        ref={buttonRef}
        type="button"
        className={variant === "drawer" ? "btn btn-ghost lang-button" : "icon-button lang-button"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("lang.button", { language: current.native })}
        onClick={() => setOpen((o) => !o)}
      >
        <Globe aria-hidden />
        <span className="lang-current" lang={current.code} dir={current.dir}>
          {variant === "drawer" ? current.native : current.code.split("-")[0].toUpperCase()}
        </span>
        <ChevronDown aria-hidden className="chev" />
      </button>
      {open && (
        <div className="lang-panel" role="dialog" aria-label={t("lang.choose")}>
          <div className="search-box lang-search">
            <Search aria-hidden />
            <input
              ref={inputRef}
              className="input"
              type="search"
              value={q}
              placeholder={t("lang.search")}
              aria-label={t("lang.search")}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={list[active] ? optionId(list[active].code) : undefined}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
            />
          </div>
          <ul id={listId} role="listbox" aria-label={t("lang.choose")} className="lang-list">
            {list.map((l, i) => {
              const selected = l.code === current.code;
              return (
                <li
                  key={l.code}
                  id={optionId(l.code)}
                  role="option"
                  aria-selected={selected}
                  className={`${i === active ? "active" : ""}${selected ? " selected" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(l);
                  }}
                  data-lang={l.code}
                >
                  <span className="lang-native" lang={l.code} dir={l.dir}>
                    {l.native}
                  </span>
                  {l.status === "machine" && <span className="lang-badge">{t("lang.machineShort")}</span>}
                  {selected && (
                    <>
                      <Check aria-hidden className="lang-check" />
                      <span className="sr-only">{t("lang.current")}</span>
                    </>
                  )}
                </li>
              );
            })}
            {list.length === 0 && <li className="muted lang-empty">{t("lang.noMatch")}</li>}
          </ul>
          {languages.some((l) => l.status === "machine") && <p className="lang-note muted">{t("lang.machineNote")}</p>}
        </div>
      )}
    </div>
  );
}
