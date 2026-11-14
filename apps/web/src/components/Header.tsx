"use client";
import { ChevronDown, Download, Grid2x2, House, BookOpen, LifeBuoy, Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { InstallMenuItem } from "./InstallPrompt";
import { Logo } from "./Logo";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageSelector, type LanguageOption } from "./LanguageSelector";
import { useT } from "@/i18n/client";

/** Compact navigation data, built at build time in the layout (names and links only). */
export interface NavCategory {
  name: string;
  href: string;
  icon: string;
  tools: Array<{ name: string; href: string }>;
}

/** Localized paths of the main navigation targets. */
export interface NavLinks {
  home: string;
  downloader: string;
  tools: string;
  guides: string;
  about: string;
  /** Path prefix of category pages ("/category/", "/es/categoria/"). */
  categoryPrefix: string;
}

function isCurrent(path: string, href: string, home: string) {
  return href === home ? path === home : path.startsWith(href);
}

export function Header({ nav, links: L, languages }: { nav: NavCategory[]; links: NavLinks; languages: LanguageOption[] }) {
  const t = useT("common");
  const [open, setOpen] = useState(false);
  const [focusSearch, setFocusSearch] = useState(false);
  const [path, setPath] = useState("");
  const drawerRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => setPath(location.pathname), []);

  const show = useCallback((withSearch = false) => {
    opener.current = document.activeElement as HTMLElement | null;
    setFocusSearch(withSearch);
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    opener.current?.focus?.();
  }, []);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.classList.add("drawer-open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && drawerRef.current) {
        // Keep keyboard focus inside the open drawer.
        const f = drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, summary, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    if (!focusSearch) drawerRef.current?.querySelector<HTMLElement>(".drawer-close")?.focus();
    return () => {
      root.classList.remove("drawer-open");
      document.removeEventListener("keydown", onKey);
    };
  }, [open, focusSearch, close]);

  const links = [
    { href: L.home, label: t("header.home") },
    { href: L.downloader, label: t("header.downloader") },
  ];
  const DOWNLOADER = L.downloader;

  return (
    <>
      <header className="site-header">
        <div className="container">
          <div className="nav">
            <button type="button" className="icon-button menu-button" aria-label={t("header.openMenu")} aria-expanded={open} aria-controls="tools-drawer" onClick={() => show(false)}>
              <Menu aria-hidden />
            </button>
            <Logo href={L.home} label={t("logo.home")} />
            <nav className="nav-links" aria-label={t("header.mainNav")}>
              {links.map((l) => (
                <a key={l.href} href={l.href} aria-current={isCurrent(path, l.href, L.home) ? "page" : undefined}>
                  {l.label}
                </a>
              ))}
              <button type="button" className="nav-explore" aria-expanded={open} aria-controls="tools-drawer" onClick={() => show(false)}>
                {t("header.explore")} <ChevronDown aria-hidden />
              </button>
              <a href={L.tools} aria-current={path.startsWith(L.tools) || path.startsWith(L.categoryPrefix) ? "page" : undefined}>
                {t("header.categories")}
              </a>
              <a href={L.guides} aria-current={path.startsWith(L.guides) ? "page" : undefined}>
                {t("header.guides")}
              </a>
              <a href={L.about} aria-current={path.startsWith(L.about) ? "page" : undefined}>
                {t("header.help")}
              </a>
            </nav>
            <div className="nav-search">
              <SearchBox shortcut />
            </div>
            <div className="nav-actions">
              <LanguageSelector languages={languages} />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {open && (
        <div className="drawer-backdrop" onClick={close}>
          <div ref={drawerRef} id="tools-drawer" className="drawer" role="dialog" aria-modal="true" aria-label={t("header.allToolsDialog")} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <Logo href={L.home} label={t("logo.home")} />
              <button type="button" className="icon-button drawer-close" aria-label={t("header.closeMenu")} onClick={close}>
                <X aria-hidden />
              </button>
            </div>
            <SearchBox size="lg" autoFocus={focusSearch} />
            <nav className="drawer-quick" aria-label={t("header.menu")}>
              <a href={L.home} aria-current={path === L.home ? "page" : undefined}><House aria-hidden /> {t("header.home")}</a>
              <a href={DOWNLOADER} aria-current={isCurrent(path, DOWNLOADER, L.home) ? "page" : undefined}><Download aria-hidden /> {t("header.downloader")}</a>
              <a href={L.tools} aria-current={path.startsWith(L.tools) ? "page" : undefined}><Grid2x2 aria-hidden /> {t("header.allTools")}</a>
              <a href={L.guides} aria-current={path.startsWith(L.guides) ? "page" : undefined}><BookOpen aria-hidden /> {t("header.guides")}</a>
              <a href={L.about} aria-current={path.startsWith(L.about) ? "page" : undefined}><LifeBuoy aria-hidden /> {t("header.help")}</a>
            </nav>
            <div className="drawer-lang">
              <LanguageSelector languages={languages} variant="drawer" />
            </div>
            <InstallMenuItem />
            <h2 className="drawer-heading">{t("header.toolCategories")}</h2>
            <div className="drawer-cats" role="list">
              {nav.map((c) => (
                <details key={c.href} className="drawer-cat" role="listitem" open={path.startsWith(c.href) || c.tools.some((t) => path === t.href)}>
                  <summary>
                    <span className="tool-icon sm"><Icon name={c.icon} /></span>
                    <span className="drawer-cat-name">{c.name}</span>
                    <span className="muted drawer-count">{c.tools.length}</span>
                    <ChevronDown aria-hidden className="chev" />
                  </summary>
                  <ul>
                    {c.tools.map((t) => (
                      <li key={t.href}>
                        <a href={t.href} aria-current={path === t.href ? "page" : undefined}>{t.name}</a>
                      </li>
                    ))}
                    <li>
                      <a href={c.href} className="drawer-all">{t("header.seeAllIn", { category: c.name })}</a>
                    </li>
                  </ul>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
