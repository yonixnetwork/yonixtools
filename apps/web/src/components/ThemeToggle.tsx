"use client";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("yt-theme", next);
    } catch {
      /* storage unavailable: theme still applies for this page view */
    }
  };
  return (
    <button type="button" className="icon-button" onClick={toggle} aria-label="Toggle light or dark theme" title="Toggle theme">
      <Sun className="theme-sun" aria-hidden />
      <Moon className="theme-moon" aria-hidden />
    </button>
  );
}
