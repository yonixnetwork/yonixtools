import type { Metadata } from "next";
import { coverage } from "@/i18n/report";

// Administrators only: /admin/ is password-protected by nginx (deploy/nginx/web.conf) and kept out
// of search engines (robots.txt, X-Robots-Tag, noindex). Rendered at build time from the catalogues.
export const metadata: Metadata = { title: "Translation status (admin)", robots: { index: false, follow: false } };

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "—");

export default function TranslationStatus() {
  const rows = coverage();
  const shown = rows.filter((r) => r.priority || r.hasCatalogue);
  const rest = rows.filter((r) => !r.priority && !r.hasCatalogue);
  return (
    <div className="container" style={{ padding: "24px 16px" }}>
      <h1 style={{ fontSize: "1.6rem" }}>Translation status</h1>
      <p className="muted">
        Generated at build time. “Machine” = translated automatically (including AI), not reviewed by a person. A page is indexed only when every key it shows
        is human-reviewed against the current English text (record reviews with <code>npm run i18n:review</code>).
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="data" data-testid="translation-status">
          <thead>
            <tr>
              <th>Locale</th><th>Language</th><th>Status</th><th>Built</th><th>Keys</th><th>Completed</th><th>Missing</th><th>Invalid</th><th>Untranslated</th><th>Machine</th><th>Human-reviewed</th><th>Stale</th><th>Reviewers</th><th>Pages indexable</th><th>Pages blocked</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.code} data-locale={r.code}>
                <td><code>{r.code}</code></td>
                <td lang={r.code} dir={r.dir}>{r.native}</td>
                <td>{r.status}</td>
                <td>{r.built ? "yes" : "no"}</td>
                <td>{r.total}</td>
                <td>{r.code === "en" ? r.total : r.completed} ({pct(r.code === "en" ? r.total : r.completed, r.total)})</td>
                <td>{r.code === "en" ? 0 : r.counts.missing}</td>
                <td>{r.counts.invalid}</td>
                <td>{r.counts.untranslated}</td>
                <td>{r.counts.machine}</td>
                <td>{r.code === "en" ? "source" : r.counts.reviewed}</td>
                <td>{r.counts.stale}</td>
                <td>{r.reviewers.join(", ") || "—"}</td>
                <td>{r.pagesIndexable}</td>
                <td>{r.pagesBlocked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 style={{ fontSize: "1.1rem", marginTop: 24 }}>Registered, not started ({rest.length})</h2>
      <p>{rest.map((r) => `${r.code} ${r.native}`).join(" · ")}</p>
    </div>
  );
}
