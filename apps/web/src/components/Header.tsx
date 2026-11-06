"use client";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";
import { SearchBox } from "./SearchBox";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/social-media-downloader/", label: "Downloader" },
  { href: "/tools/", label: "All tools" },
  { href: "/category/image-tools/", label: "Image" },
  { href: "/category/qr-code-tools/", label: "QR codes" },
  { href: "/category/developer-tools/", label: "Developer" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="container">
        <div className="nav">
          <Logo />
          <nav className="nav-links" aria-label="Main">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          <div className="nav-search">
            <SearchBox shortcut />
          </div>
          <div className="nav-actions">
            <ThemeToggle />
            <button type="button" className="icon-button menu-button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}>
              {open ? <X aria-hidden /> : <Menu aria-hidden />}
            </button>
          </div>
        </div>
        {open && (
          <div className="mobile-menu" id="mobile-menu">
            <SearchBox size="lg" autoFocus />
            <nav aria-label="Mobile">
              {LINKS.map((l) => (
                <a key={l.href} href={l.href}>
                  {l.label}
                </a>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
