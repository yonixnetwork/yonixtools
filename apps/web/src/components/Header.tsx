"use client";
import { ChevronDown, Download, Grid2x2, House, BookOpen, LifeBuoy, Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { InstallMenuItem } from "./InstallPrompt";
import { Logo } from "./Logo";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";

/** Compact navigation data, built at build time in the layout (names and links only). */
export interface NavCategory {
  name: string;
  href: string;
  icon: string;
  tools: Array<{ name: string; href: string }>;
}

const DOWNLOADER = "/social-media-downloader/";

function isCurrent(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function Header({ nav }: { nav: NavCategory[] }) {
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
    { href: "/", label: "Home" },
    { href: DOWNLOADER, label: "Downloader" },
  ];

  return (
    <>
      <header className="site-header">
        <div className="container">
          <div className="nav">
            <button type="button" className="icon-button menu-button" aria-label="Open menu" aria-expanded={open} aria-controls="tools-drawer" onClick={() => show(false)}>
              <Menu aria-hidden />
            </button>
            <Logo />
            <nav className="nav-links" aria-label="Main">
              {links.map((l) => (
                <a key={l.href} href={l.href} aria-current={isCurrent(path, l.href) ? "page" : undefined}>
                  {l.label}
                </a>
              ))}
              <button type="button" className="nav-explore" aria-expanded={open} aria-controls="tools-drawer" onClick={() => show(false)}>
                Explore tools <ChevronDown aria-hidden />
              </button>
              <a href="/tools/" aria-current={path.startsWith("/tools/") || path.startsWith("/category/") ? "page" : undefined}>
                Categories
              </a>
              <a href="/guides/" aria-current={path.startsWith("/guides/") ? "page" : undefined}>
                Guides
              </a>
              <a href="/about/" aria-current={path.startsWith("/about/") ? "page" : undefined}>
                Help
              </a>
            </nav>
            <div className="nav-search">
              <SearchBox shortcut />
            </div>
            <div className="nav-actions">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {open && (
        <div className="drawer-backdrop" onClick={close}>
          <div ref={drawerRef} id="tools-drawer" className="drawer" role="dialog" aria-modal="true" aria-label="All tools" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <Logo />
              <button type="button" className="icon-button drawer-close" aria-label="Close menu" onClick={close}>
                <X aria-hidden />
              </button>
            </div>
            <SearchBox size="lg" autoFocus={focusSearch} />
            <nav className="drawer-quick" aria-label="Menu">
              <a href="/" aria-current={path === "/" ? "page" : undefined}><House aria-hidden /> Home</a>
              <a href={DOWNLOADER} aria-current={isCurrent(path, DOWNLOADER) ? "page" : undefined}><Download aria-hidden /> Downloader</a>
              <a href="/tools/" aria-current={path.startsWith("/tools/") ? "page" : undefined}><Grid2x2 aria-hidden /> All tools</a>
              <a href="/guides/" aria-current={path.startsWith("/guides/") ? "page" : undefined}><BookOpen aria-hidden /> Guides</a>
              <a href="/about/" aria-current={path.startsWith("/about/") ? "page" : undefined}><LifeBuoy aria-hidden /> Help</a>
            </nav>
            <InstallMenuItem />
            <h2 className="drawer-heading">Tool categories</h2>
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
                      <a href={c.href} className="drawer-all">See all in {c.name} →</a>
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
