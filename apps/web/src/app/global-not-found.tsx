import "./fonts.css";
import "./globals.css";
import type { Metadata } from "next";
import { ThemeScript } from "@/components/ThemeScript";
import { builtLocales } from "@/i18n/catalogue";
import { getLocale } from "@/i18n/locales";
import { getT } from "@/i18n/server";
import { pathFor } from "@/i18n/routes";

// The single 404 page of the static export (served by nginx for any unknown URL, in any language).
// It says "not found" in English and links every language's home page in its own script.
export const metadata: Metadata = { title: "Page not found | YoniXTools", robots: { index: false, follow: true } };

export default function GlobalNotFound() {
  const t = getT("en", "pages");
  const others = builtLocales().filter((l) => l !== "en");
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <main id="main" className="container empty" style={{ padding: "80px 16px" }}>
          <h1 style={{ fontSize: "2rem" }}>{t("notFound.h1")}</h1>
          <p>{t("notFound.p")}</p>
          <p style={{ marginTop: 20 }}>
            <a href="/" className="link">{t("notFound.home")}</a>
          </p>
          {others.length > 0 && (
            <ul className="row" style={{ justifyContent: "center", gap: 8, marginTop: 24, listStyle: "none", padding: 0 }}>
              {others.map((l) => {
                const info = getLocale(l);
                return (
                  <li key={l}>
                    <a href={pathFor(l, { kind: "home" })} lang={info.code} dir={info.dir} className="chip">
                      {getT(l, "pages")("notFound.home")}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </body>
    </html>
  );
}
