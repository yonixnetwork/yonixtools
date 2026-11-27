"use client";
import { Moon, Sun } from "lucide-react";
import { useT } from "@/i18n/client";

export function ThemeToggle() {
  const t = useT("common");
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
    <button type="button" className="icon-button" onClick={toggle} aria-label={t("theme.toggle")} title={t("theme.title")}>
      <Sun className="theme-sun" aria-hidden />
      <Moon className="theme-moon" aria-hidden />
    </button>
  );
}
