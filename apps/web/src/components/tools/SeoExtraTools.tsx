"use client";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CopyButton, Field, Notice, Output, Segmented } from "./ui";
import { jsonLdScript, keywordIdeas, parseSocialMeta, parseUrlList, schemaJsonLd, sitemapXml, titleIdeas, type SchemaType, type SitemapOptions } from "@/lib/tools/seo-extra";

// ── Sitemap ─────────────────────────────────────────────────────────────────

export function SitemapGenerator() {
  const [text, setText] = useState("https://example.com/\nhttps://example.com/about/\nhttps://example.com/blog/first-post/");
  const [o, setO] = useState<SitemapOptions>({ lastmod: "", changefreq: "", priority: "" });
  const { urls, invalid } = useMemo(() => parseUrlList(text), [text]);
  let xml = "";
  let err = "";
  try {
    xml = urls.length ? sitemapXml(urls, o) : "";
  } catch (e) {
    err = (e as Error).message;
  }
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label="Page URLs (one per line)" htmlFor="sm-urls" hint={`${urls.length} valid URL${urls.length === 1 ? "" : "s"}`}>
        <textarea id="sm-urls" className="textarea mono" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} style={{ minHeight: 180 }} />
      </Field>
      <div className="form-grid cols-3">
        <Field label="Last modified (optional)" htmlFor="sm-lm"><input id="sm-lm" className="input" type="date" value={o.lastmod} onChange={(e) => setO({ ...o, lastmod: e.target.value })} /></Field>
        <Field label="Change frequency" htmlFor="sm-cf">
          <select id="sm-cf" className="select" value={o.changefreq} onChange={(e) => setO({ ...o, changefreq: e.target.value as SitemapOptions["changefreq"] })}>
            {["", "daily", "weekly", "monthly", "yearly"].map((v) => <option key={v} value={v}>{v || "Not set"}</option>)}
          </select>
        </Field>
        <Field label="Priority" htmlFor="sm-pr">
          <select id="sm-pr" className="select" value={o.priority} onChange={(e) => setO({ ...o, priority: e.target.value })}>
            {["", "1.0", "0.8", "0.5", "0.3"].map((v) => <option key={v} value={v}>{v || "Not set"}</option>)}
          </select>
        </Field>
      </div>
      {invalid.length > 0 && <Notice kind="warn">Skipped {invalid.length} invalid line{invalid.length === 1 ? "" : "s"}: {invalid.slice(0, 3).join(", ")}{invalid.length > 3 ? "…" : ""}</Notice>}
      {err && <Notice kind="error">{err}</Notice>}
      <Output label="sitemap.xml" text={xml} filename="sitemap.xml" />
    </div>
  );
}

// ── Schema ──────────────────────────────────────────────────────────────────

const SCHEMA_FIELDS: Record<SchemaType, Array<[string, string, ("text" | "textarea" | "date" | "url")?]>> = {
  Organization: [["name", "Name"], ["url", "Website", "url"], ["logo", "Logo URL", "url"], ["description", "Description", "textarea"], ["email", "Email"], ["telephone", "Phone"], ["sameAs", "Social profiles (one per line)", "textarea"]],
  LocalBusiness: [["name", "Business name"], ["url", "Website", "url"], ["image", "Image URL", "url"], ["telephone", "Phone"], ["priceRange", "Price range (e.g. $$)"], ["street", "Street address"], ["city", "City"], ["region", "State / region"], ["postalCode", "Postal code"], ["country", "Country code (e.g. NG, US)"], ["openingHours", "Opening hours, one per line (e.g. Mo-Fr 09:00-17:00)", "textarea"]],
  Article: [["headline", "Headline"], ["description", "Description", "textarea"], ["image", "Image URL(s), one per line", "textarea"], ["datePublished", "Published", "date"], ["dateModified", "Modified", "date"], ["author", "Author name"], ["authorUrl", "Author URL", "url"], ["publisher", "Publisher"], ["publisherLogo", "Publisher logo URL", "url"]],
  Product: [["name", "Product name"], ["description", "Description", "textarea"], ["image", "Image URL(s), one per line", "textarea"], ["brand", "Brand"], ["sku", "SKU"], ["price", "Price (e.g. 19.99)"], ["currency", "Currency (e.g. USD)"], ["availability", "Availability (InStock, OutOfStock, PreOrder)"], ["url", "Product URL", "url"]],
  FAQPage: [],
  Event: [["name", "Event name"], ["description", "Description", "textarea"], ["startDate", "Start date", "date"], ["endDate", "End date", "date"], ["online", "Online event? (yes/no)"], ["venue", "Venue name"], ["address", "Venue address"], ["locationUrl", "Online event URL", "url"], ["image", "Image URL(s)", "textarea"], ["organizer", "Organizer"]],
  Person: [["name", "Name"], ["jobTitle", "Job title"], ["worksFor", "Works for"], ["url", "Website", "url"], ["image", "Photo URL", "url"], ["sameAs", "Social profiles (one per line)", "textarea"]],
};

export function SchemaGenerator() {
  const [type, setType] = useState<SchemaType>("Organization");
  const [fields, setFields] = useState<Record<string, string>>({ name: "YoniXTools", url: "https://yonixtools.com" });
  const [faqs, setFaqs] = useState([{ q: "", a: "" }]);
  const json = useMemo(() => schemaJsonLd(type, fields, faqs), [type, fields, faqs]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label="Schema type">
        <select className="select" value={type} onChange={(e) => setType(e.target.value as SchemaType)} aria-label="Schema type">
          {(Object.keys(SCHEMA_FIELDS) as SchemaType[]).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      {type === "FAQPage" ? (
        <div className="stack">
          {faqs.map((f, i) => (
            <div key={i} className="form-grid cols-2" style={{ alignItems: "end" }}>
              <Field label={`Question ${i + 1}`} htmlFor={`faq-q-${i}`}><input id={`faq-q-${i}`} className="input" value={f.q} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} /></Field>
              <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-end" }}>
                <Field label="Answer" htmlFor={`faq-a-${i}`}><input id={`faq-a-${i}`} className="input" value={f.a} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} /></Field>
                <button type="button" className="icon-button" aria-label={`Remove question ${i + 1}`} onClick={() => setFaqs(faqs.filter((_, j) => j !== i))} disabled={faqs.length === 1}><Trash2 aria-hidden /></button>
              </div>
            </div>
          ))}
          <div><button type="button" className="btn btn-sm" onClick={() => setFaqs([...faqs, { q: "", a: "" }])}><Plus aria-hidden /> Add question</button></div>
        </div>
      ) : (
        <div className="form-grid cols-2">
          {SCHEMA_FIELDS[type].map(([k, label, kind]) => (
            <Field key={`${type}-${k}`} label={label} htmlFor={`sc-${k}`}>
              {kind === "textarea" ? (
                <textarea id={`sc-${k}`} className="textarea" style={{ minHeight: 80 }} value={fields[k] ?? ""} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} />
              ) : (
                <input id={`sc-${k}`} className="input" type={kind === "date" ? "date" : kind === "url" ? "url" : "text"} value={fields[k] ?? ""} onChange={(e) => setFields({ ...fields, [k]: e.target.value })} />
              )}
            </Field>
          ))}
        </div>
      )}
      <Output label="JSON-LD (paste into your page)" text={jsonLdScript(json)} />
      <p className="muted" style={{ fontSize: "0.85rem" }}>Validate the result with Google&apos;s Rich Results Test before publishing. The markup must match what&apos;s visible on the page.</p>
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
          {!m.image ? "No og:image" : !imgOk ? "Image could not be loaded" : null}
          {m.image && <img src={m.image} alt="" referrerPolicy="no-referrer" style={{ display: "none" }} onError={() => setImgOk(false)} />}
        </div>
        <div className="body">
          <div className="host">{host}</div>
          <div className="t">{m.title || "No title"}</div>
          {variant !== "li" && <div className="d">{m.description}</div>}
        </div>
      </div>
    </figure>
  );
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label="Page HTML (or just the <head>)" htmlFor="og-html" hint="Nothing is fetched: tags are read from what you paste.">
        <textarea id="og-html" className="textarea mono" value={html} onChange={(e) => setHtml(e.target.value)} spellCheck={false} style={{ minHeight: 160 }} />
      </Field>
      {m.warnings.length > 0 && (
        <div className="notice notice-warn" role="status">
          <div>
            <strong>{m.warnings.length} issue{m.warnings.length === 1 ? "" : "s"} found</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: "1.1rem" }}>{m.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        </div>
      )}
      <div className="form-grid cols-2">{card("fb", "Facebook")}{card("x", "X (Twitter)")}{card("li", "LinkedIn")}</div>
    </div>
  );
}

// ── Keyword ideas ───────────────────────────────────────────────────────────

export function KeywordIdeaGenerator() {
  const [seed, setSeed] = useState("qr code generator");
  const ideas = useMemo(() => keywordIdeas(seed), [seed]);
  const groups: Array<[string, string[]]> = [["Questions", ideas.questions], ["Modifiers", ideas.modifiers], ["Long-tail", ideas.longTail], ["Prepositions", ideas.prepositions]];
  const all = groups.flatMap(([, g]) => g).join("\n");
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label="Seed keyword" htmlFor="kw-seed"><input id="kw-seed" className="input" value={seed} onChange={(e) => setSeed(e.target.value)} /></Field>
      <Notice kind="info">Ideas are generated from common search patterns. They include no search-volume data, so check demand before you build content around them.</Notice>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong data-testid="kw-count">{all ? all.split("\n").length : 0} ideas</strong>
        <CopyButton text={all} label="Copy all" />
      </div>
      <div className="form-grid cols-2">
        {groups.map(([name, list]) => (
          <div key={name} className="card card-pad" style={{ boxShadow: "none", padding: 16 }}>
            <h3 style={{ marginBottom: 8 }}>{name}</h3>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: 4, color: "var(--text-2)" }}>{list.map((k) => <li key={k}>{k}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Title generator ─────────────────────────────────────────────────────────

export function SeoTitleGenerator() {
  const [keyword, setKeyword] = useState("pdf merger");
  const [brand, setBrand] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  useEffect(() => setCtx(document.createElement("canvas").getContext("2d")), []);
  const limit = device === "desktop" ? 600 : 520;
  const measure = (t: string) => {
    if (!ctx) return t.length * 9;
    ctx.font = device === "desktop" ? "20px Arial" : "18px Arial";
    return ctx.measureText(t).width;
  };
  const titles = titleIdeas(keyword, brand);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="form-grid cols-2">
        <Field label="Main keyword" htmlFor="tg-k"><input id="tg-k" className="input" value={keyword} onChange={(e) => setKeyword(e.target.value)} /></Field>
        <Field label="Brand (optional)" htmlFor="tg-b"><input id="tg-b" className="input" value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
      </div>
      <Segmented label="Device" value={device} onChange={setDevice} options={[{ value: "desktop", label: "Desktop (600px)" }, { value: "mobile", label: "Mobile (520px)" }]} />
      <ul className="file-list" data-testid="title-list">
        {titles.map((t) => {
          const w = Math.round(measure(t));
          return (
            <li key={t}>
              <span className="file-name" style={{ whiteSpace: "normal" }}>
                {t}
                <span className="muted" style={{ display: "block", fontSize: "0.8rem", color: w > limit ? "var(--warning)" : "var(--success)" }}>
                  {t.length} characters · {w}px {w > limit ? "· will be truncated" : "· fits"}
                </span>
              </span>
              <CopyButton text={t} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
