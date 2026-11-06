import { Logo } from "./Logo";
import { categories, getTool, popularSlugs, downloaderTools } from "@/lib/registry";
import { categoryPath, toolPath } from "@/lib/site";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="about">
            <Logo />
            <p>A universal social media downloader and free, private browser tools for everyday tasks. No sign-up required.</p>
          </div>
          <div>
            <h2>Downloaders</h2>
            <ul>
              {downloaderTools().slice(0, 6).map((t) => (
                <li key={t.slug}>
                  <a href={toolPath(t.slug)}>{t.name.replace(" Video Downloader", " Downloader")}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Popular tools</h2>
            <ul>
              {popularSlugs.slice(0, 6).map((s) => {
                const t = getTool(s)!;
                return (
                  <li key={s}>
                    <a href={toolPath(s)}>{t.name}</a>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h2>Categories</h2>
            <ul>
              {categories.map((c) => (
                <li key={c.id}>
                  <a href={categoryPath(c.slug)}>{c.name}</a>
                </li>
              ))}
              <li>
                <a href="/tools/">All tools</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} YoniXTools. Download only content you have the right to save.</span>
          <span>
            <a href="/privacy/">Privacy</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
