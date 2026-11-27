import { Logo } from "./Logo";
import { categories, downloaderTools, popularSlugs } from "@/lib/registry";
import { getT, loadNamespace } from "@/i18n/server";
import { localizeCategory, localizeTool } from "@/i18n/source";
import { getTool } from "@/lib/registry";
import { pathFor } from "@/i18n/routes";

/** Server component: rendered at build time in the page's language. */
export function Footer({ locale }: { locale: string }) {
  const t = getT(locale, "common");
  const reg = loadNamespace(locale, "registry");
  const name = (slug: string) => localizeTool(getTool(slug)!, reg).name;
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="about">
            <Logo href={pathFor(locale, { kind: "home" })} label={t("logo.home")} />
            <p>{t("footer.about")}</p>
          </div>
          <div>
            <h2>{t("footer.downloaders")}</h2>
            <ul>
              {downloaderTools()
                .slice(0, 6)
                .map((tool) => (
                  <li key={tool.slug}>
                    <a href={pathFor(locale, { kind: "tool", slug: tool.slug })}>{locale === "en" ? tool.name.replace(" Video Downloader", " Downloader") : name(tool.slug)}</a>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <h2>{t("footer.popular")}</h2>
            <ul>
              {popularSlugs.slice(0, 6).map((s) => (
                <li key={s}>
                  <a href={pathFor(locale, { kind: "tool", slug: s })}>{name(s)}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>{t("footer.categories")}</h2>
            <ul>
              {categories.map((c) => (
                <li key={c.id}>
                  <a href={pathFor(locale, { kind: "category", id: c.id })}>{localizeCategory(c, reg).name}</a>
                </li>
              ))}
              <li>
                <a href={pathFor(locale, { kind: "tools" })}>{t("footer.allTools")}</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>{t("footer.copyright", { year: String(new Date().getFullYear()) })}</span>
          <span>
            <a href={pathFor(locale, { kind: "guides" })}>{t("footer.guides")}</a> · <a href={pathFor(locale, { kind: "about" })}>{t("footer.help")}</a> ·{" "}
            <a href={pathFor(locale, { kind: "privacy" })}>{t("footer.privacy")}</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
