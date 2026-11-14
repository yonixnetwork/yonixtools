"use client";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CopyButton, Field, Notice, Output, Segmented } from "./ui";
import { useFormat, useT } from "@/i18n/client";
import { isUserError } from "@/i18n/errors";
import { jsonLdScript, keywordIdeas, parseSocialMeta, parseUrlList, schemaJsonLd, sitemapXml, titleIdeas, type SchemaType, type SitemapOptions } from "@/lib/tools/seo-extra";

// ── Sitemap ─────────────────────────────────────────────────────────────────

export function SitemapGenerator() {
  const t = useT("tools-seo2");
  const [text, setText] = useState("https://example.com/\nhttps://example.com/about/\nhttps://example.com/blog/first-post/");
  const [o, setO] = useState<SitemapOptions>({ lastmod: "", changefreq: "", priority: "" });
  const { urls, invalid } = useMemo(() => parseUrlList(text), [text]);
  let xml = "";
  let err = "";
  try {
    xml = urls.length ? sitemapXml(urls, o) : "";
  } catch (e) {
    err = isUserError(e) ? t(e.key, e.vars) : t("sitemap.error");
  }
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label={t("sitemap.urls")} htmlFor="sm-urls" hint={t("sitemap.validCount", { count: urls.length })}>
        <textarea id="sm-urls" className="textarea mono" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} style={{ minHeight: 180 }} />
      </Field>
      <div className="form-grid cols-3">
        <Field label={t("sitemap.lastmod")} htmlFor="sm-lm"><input id="sm-lm" className="input" type="date" value={o.lastmod} onChange={(e) => setO({ ...o, lastmod: e.target.value })} /></Field>
        <Field label={t("sitemap.changefreq")} htmlFor="sm-cf">
          <select id="sm-cf" className="select" value={o.changefreq} onChange={(e) => setO({ ...o, changefreq: e.target.value as SitemapOptions["changefreq"] })}>
            {["", "daily", "weekly", "monthly", "yearly"].map((v) => <option key={v} value={v}>{t(v ? `sitemap.freq.${v}` : "sitemap.notSet")}</option>)}
          </select>
        </Field>
        <Field label={t("sitemap.priority")} htmlFor="sm-pr">
          <select id="sm-pr" className="select" value={o.priority} onChange={(e) => setO({ ...o, priority: e.target.value })}>
            {["", "1.0", "0.8", "0.5", "0.3"].map((v) => <option key={v} value={v}>{v || t("sitemap.notSet")}</option>)}
          </select>
        </Field>
      </div>
      {invalid.length > 0 && <Notice kind="warn">{t("sitemap.skipped", { count: invalid.length, lines: invalid.slice(0, 3).join(", ") + (invalid.length > 3 ? "…" : "") })}</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      <Output label={t("sitemap.output")} text={xml} filename="sitemap.xml" />
    </div>
  );
}

// ── Schema ──────────────────────────────────────────────────────────────────

const SCHEMA_FIELDS: Record<SchemaType, Array<[string, string, ("text" | "textarea" | "date" | "url")?]>> = {
  Organization: [["name", "schema.field.name"], ["url", "schema.field.website", "url"], ["logo", "schema.field.logoURL", "url"], ["description", "schema.field.description", "textarea"], ["email", "schema.field.email"], ["telephone", "schema.field.phone"], ["sameAs", "schema.field.socialProfiles", "textarea"]],
  LocalBusiness: [["name", "schema.field.businessName"], ["url", "schema.field.website", "url"], ["image", "schema.field.imageURL", "url"], ["telephone", "schema.field.phone"], ["priceRange", "schema.field.priceRange"], ["street", "schema.field.streetAddress"], ["city", "schema.field.city"], ["region", "schema.field.stateRegion"], ["postalCode", "schema.field.postalCode"], ["country", "schema.field.countryCode"], ["openingHours", "schema.field.openingHours", "textarea"]],
  Article: [["headline", "schema.field.headline"], ["description", "schema.field.description", "textarea"], ["image", "schema.field.imageUrlsLines", "textarea"], ["datePublished", "schema.field.published", "date"], ["dateModified", "schema.field.modified", "date"], ["author", "schema.field.authorName"], ["authorUrl", "schema.field.authorURL", "url"], ["publisher", "schema.field.publisher"], ["publisherLogo", "schema.field.publisherLogoURL", "url"]],
  Product: [["name", "schema.field.productName"], ["description", "schema.field.description", "textarea"], ["image", "schema.field.imageUrlsLines", "textarea"], ["brand", "schema.field.brand"], ["sku", "schema.field.sku"], ["price", "schema.field.price"], ["currency", "schema.field.currency"], ["availability", "schema.field.availability"], ["url", "schema.field.productURL", "url"]],
  FAQPage: [],
  Event: [["name", "schema.field.eventName"], ["description", "schema.field.description", "textarea"], ["startDate", "schema.field.startDate", "date"], ["endDate", "schema.field.endDate", "date"], ["online", "schema.field.onlineEvent"], ["venue", "schema.field.venueName"], ["address", "schema.field.venueAddress"], ["locationUrl", "schema.field.onlineEventURL", "url"], ["image", "schema.field.imageUrls", "textarea"], ["organizer", "schema.field.organizer"]],
  Person: [["name", "schema.field.name"], ["jobTitle", "schema.field.jobTitle"], ["worksFor", "schema.field.worksFor"], ["url", "schema.field.website", "url"], ["image", "schema.field.photoURL", "url"], ["sameAs", "schema.field.socialProfiles", "textarea"]],
};

export function SchemaGenerator() {
  const t = useT("tools-seo2");
  const [type, setType] = useState<SchemaType>("Organization");
  const [fields, setFields] = useState<Record<string, string>>({ name: "YoniXTools", url: "https://yonixtools.com" });
  const [faqs, setFaqs] = useState([{ q: "", a: "" }]);
  const json = useMemo(() => schemaJsonLd(type, fields, faqs), [type, fields, faqs]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label={t("schema.type")}>
        <select className="select" value={type} onChange={(e) => setType(e.target.value as SchemaType)} aria-label={t("schema.type")}>
          {(Object.keys(SCHEMA_FIELDS) as SchemaType[]).map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
      </Field>
      {type === "FAQPage" ? (
        <div className="stack">
          {faqs.map((f, i) => (
            <div key={i} className="form-grid cols-2" style={{ alignItems: "end" }}>
              <Field label={t("schema.question", { n: i + 1 })} htmlFor={`faq-q-${i}`}><input id={`faq-q-${i}`} className="input" value={f.q} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} /></Field>
              <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-end" }}>
                <Field label={t("schema.answer")} htmlFor={`faq-a-${i}`}><input id={`faq-a-${i}`} className="input" value={f.a} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} /></Field>
                <button type="button" className="icon-button" aria-label={t("schema.removeQuestion", { n: i + 1 })} onClick={() => setFaqs(faqs.filter((_, j) => j !== i))} disabled={faqs.length === 1}><Trash2 aria-hidden /></button>
              </div>
            </div>
          ))}
          <div><button type="button" className="btn btn-sm" onClick={() => setFaqs([...faqs, { q: "", a: "" }])}><Plus aria-hidden /> {t("schema.addQuestion")}</button></div>
        </div>
      ) : (
        <div className="form-grid cols-2">
          {SCHEMA_FIELDS[type].map(([k, label, kind]) => (
            <Field key={`${type}-${k}`} label={t(label)} htmlFor={`sc-${k}`}>
              {kind === "textarea" ? (
                <textarea id={`sc-${k}`} className="textarea" style={{ minHeight: 80 }} value={fields[k] ?? ""} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} />
              ) : (
                <input id={`sc-${k}`} className="input" type={kind === "date" ? "date" : kind === "url" ? "url" : "text"} value={fields[k] ?? ""} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} />
              )}
            </Field>
          ))}
        </div>
      )}
      <Output label={t("schema.output")} text={jsonLdScript(json)} />
      <p className="muted" style={{ fontSize: "0.85rem" }}>{t("schema.note")}</p>
    </div>
  );
}

// ── Open Graph preview ──────────────────────────────────────────────────────

const SAMPLE_HEAD = `<title>YoniXTools – Free Online Tools</title>
<meta property="og:title" content="YoniXTools – Social Media Downloader & Free Tools">
<meta property="og:description" content="Download public videos with one link, plus free QR, image, PDF and developer tools.">
<meta property="og:url" content="https://yonixtools.com/">
<meta property="og:site_name" content="YoniXTools">`;

export function OgPreview() {
  const t = useT("tools-seo2");
  const [html, setHtml] = useState(SAMPLE_HEAD);
  const [imgOk, setImgOk] = useState(true);
  const m = useMemo(() => parseSocialMeta(html), [html]);
  useEffect(() => setImgOk(true), [m.image]);
  let host = "example.com";
  try {
    host = new URL(m.url).hostname.replace(/^www\./, "");
  } catch {
    /* keep default */
  }
  const card = (variant: string, label: string) => (
    <figure style={{ margin: 0 }} className="stack">
      <figcaption className="field-label">{label}</figcaption>
      <div className={`og-card ${variant}`}>
        <div className="img" style={m.image && imgOk ? { backgroundImage: `url("${m.image.replace(/"/g, "%22")}")` } : undefined}>
          {!m.image ? t("og.noImage") : !imgOk ? t("og.imageFailed") : null}
          {m.image && <img src={m.image} alt="" referrerPolicy="no-referrer" style={{ display: "none" }} onError={() => setImgOk(false)} />}
        </div>
        <div className="body">
          <div className="host">{host}</div>
          <div className="t">{m.title || t("og.noTitle")}</div>
          {variant !== "li" && <div className="d">{m.description}</div>}
        </div>
      </div>
    </figure>
  );
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label={t("og.input", { tag: "<head>" })} htmlFor="og-html" hint={t("og.inputHint")}>
        <textarea id="og-html" className="textarea mono" value={html} onChange={(e) => setHtml(e.target.value)} spellCheck={false} style={{ minHeight: 160 }} />
      </Field>
      {m.warnings.length > 0 && (
        <div className="notice notice-warn" role="status">
          <div>
            <strong>{t("og.issues", { count: m.warnings.length })}</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: "1.1rem" }}>{m.warnings.map((w) => <li key={w}>{t(w, { tag: "<title>" })}</li>)}</ul>
          </div>
        </div>
      )}
      <div className="form-grid cols-2">{card("fb", "Facebook")}{card("x", "X (Twitter)")}{card("li", "LinkedIn")}</div>
    </div>
  );
}

// ── Keyword ideas ───────────────────────────────────────────────────────────

export function KeywordIdeaGenerator() {
  const t = useT("tools-seo2");
  const f = useFormat();
  const [seed, setSeed] = useState("qr code generator");
  const ideas = useMemo(() => keywordIdeas(seed), [seed]);
  const groups: Array<[string, string[]]> = [["keywords.questions", ideas.questions], ["keywords.modifiers", ideas.modifiers], ["keywords.longTail", ideas.longTail], ["keywords.prepositions", ideas.prepositions]];
  const all = groups.flatMap(([, g]) => g).join("\n");
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label={t("keywords.seed")} htmlFor="kw-seed"><input id="kw-seed" className="input" value={seed} onChange={(e) => setSeed(e.target.value)} /></Field>
      <Notice kind="info">{t("keywords.note")}</Notice>
      {/* The suggestion patterns are English; say so on translated pages. */}
      {!f.locale.startsWith("en") && <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>{t("keywords.englishNote")}</p>}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong data-testid="kw-count">{t("keywords.count", { count: all ? all.split("\n").length : 0 })}</strong>
        <CopyButton text={all} label={t("keywords.copyAll")} />
      </div>
      <div className="form-grid cols-2">
        {groups.map(([name, list]) => (
          <div key={name} className="card card-pad" style={{ boxShadow: "none", padding: 16 }}>
            <h3 style={{ marginBottom: 8 }}>{t(name)}</h3>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: 4, color: "var(--text-2)" }}>{list.map((k) => <li key={k}>{k}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Title generator ─────────────────────────────────────────────────────────

export function SeoTitleGenerator() {
  const t = useT("tools-seo2");
  const f = useFormat();
  const [keyword, setKeyword] = useState("pdf merger");
  const [brand, setBrand] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  useEffect(() => setCtx(document.createElement("canvas").getContext("2d")), []);
  const limit = device === "desktop" ? 600 : 520;
  const measure = (s: string) => {
    if (!ctx) return s.length * 9;
    ctx.font = device === "desktop" ? "20px Arial" : "18px Arial";
    return ctx.measureText(s).width;
  };
  const titles = titleIdeas(keyword, brand);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="form-grid cols-2">
        <Field label={t("titles.keyword")} htmlFor="tg-k"><input id="tg-k" className="input" value={keyword} onChange={(e) => setKeyword(e.target.value)} /></Field>
        <Field label={t("titles.brand")} htmlFor="tg-b"><input id="tg-b" className="input" value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
      </div>
      <Segmented label={t("titles.device")} value={device} onChange={setDevice} options={[{ value: "desktop", label: t("titles.desktop", { px: 600 }) }, { value: "mobile", label: t("titles.mobile", { px: 520 }) }]} />
      {/* The title templates are English; say so on translated pages. */}
      {!f.locale.startsWith("en") && <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>{t("titles.englishNote")}</p>}
      <ul className="file-list" data-testid="title-list">
        {titles.map((title) => {
          const w = Math.round(measure(title));
          return (
            <li key={title}>
              <span className="file-name" style={{ whiteSpace: "normal" }}>
                {title}
                <span className="muted" style={{ display: "block", fontSize: "0.8rem", color: w > limit ? "var(--warning)" : "var(--success)" }}>
                  {t(w > limit ? "titles.statsTruncated" : "titles.statsFits", { count: title.length, width: w })}
                </span>
              </span>
              <CopyButton text={title} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
