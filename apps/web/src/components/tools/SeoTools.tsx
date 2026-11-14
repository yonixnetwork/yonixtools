"use client";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Field, Output, Segmented } from "./ui";
import { metaTags, robotsTxt, type MetaInput, type RobotsRule } from "@/lib/tools/formats";
import { slugify } from "@/lib/tools/text";
import { useT } from "@/i18n/client";

function LengthHint({ n, min, max }: { n: number; min: number; max: number }) {
  const t = useT("tools-seo");
  const color = n === 0 ? "var(--muted)" : n < min || n > max ? "var(--warning)" : "var(--success)";
  return (
    <span style={{ color }}>
      {t("meta.lengthHint", { count: n, min, max })}
    </span>
  );
}

export function MetaTagGenerator() {
  const t = useT("tools-seo");
  const [m, setM] = useState<MetaInput>({ title: "", description: "", url: "", image: "", siteName: "", twitterHandle: "", noindex: false, type: "website" });
  const set = (k: keyof MetaInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setM({ ...m, [k]: e.target.value });
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label={t("meta.pageTitle")} htmlFor="mt-title" hint={<LengthHint n={m.title.length} min={30} max={60} />}>
        <input id="mt-title" className="input" value={m.title} onChange={set("title")} placeholder={t("meta.titlePlaceholder")} />
      </Field>
      <Field label={t("meta.description")} htmlFor="mt-desc" hint={<LengthHint n={m.description.length} min={70} max={160} />}>
        <textarea id="mt-desc" className="textarea" style={{ minHeight: 90 }} value={m.description} onChange={set("description")} placeholder={t("meta.descriptionPlaceholder")} />
      </Field>
      <div className="form-grid cols-2">
        <Field label={t("meta.canonicalUrl")} htmlFor="mt-url">
          <input id="mt-url" className="input" type="url" value={m.url} onChange={set("url")} placeholder="https://example.com/page" />
        </Field>
        <Field label={t("meta.imageUrl")} htmlFor="mt-img" hint={t("meta.imageHint")}>
          <input id="mt-img" className="input" type="url" value={m.image} onChange={set("image")} placeholder="https://example.com/og.png" />
        </Field>
        <Field label={t("meta.siteName")} htmlFor="mt-site">
          <input id="mt-site" className="input" value={m.siteName} onChange={set("siteName")} />
        </Field>
        <Field label={t("meta.twitterHandle")} htmlFor="mt-tw">
          <input id="mt-tw" className="input" value={m.twitterHandle} onChange={set("twitterHandle")} placeholder="@yourbrand" />
        </Field>
      </div>
      <div className="row">
        <Segmented label={t("meta.contentType")} value={m.type} onChange={(type) => setM({ ...m, type })} options={[{ value: "website", label: t("meta.website") }, { value: "article", label: t("meta.article") }]} />
        <label className="check">
          <input type="checkbox" checked={m.noindex} onChange={(e) => setM({ ...m, noindex: e.target.checked })} /> {t("meta.noindex")}
        </label>
      </div>
      <Output label={t("meta.output", { tag: "<head>" })} text={metaTags(m)} filename="meta-tags.html" />
    </div>
  );
}

// Google renders titles in 20px Arial and descriptions in 14px Arial (desktop).
const TITLE_PX = 600;
const DESC_PX = 920;

function useMeasure() {
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  useEffect(() => setCtx(document.createElement("canvas").getContext("2d")), []);
  return (text: string, font: string) => {
    if (!ctx) return text.length * 8;
    ctx.font = font;
    return ctx.measureText(text).width;
  };
}

function truncate(text: string, maxPx: number, measure: (t: string) => number) {
  if (measure(text) <= maxPx) return { text, cut: false };
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(text.slice(0, mid) + " ...") <= maxPx) lo = mid;
    else hi = mid - 1;
  }
  const s = text.slice(0, lo);
  const sp = s.lastIndexOf(" ");
  return { text: (sp > lo * 0.6 ? s.slice(0, sp) : s).trimEnd() + " ...", cut: true };
}

export function SerpPreview() {
  const tr = useT("tools-seo");
  const [title, setTitle] = useState("Free QR Code Generator – PNG & SVG, No Sign-Up | YoniXTools");
  const [url, setUrl] = useState("https://yonixtools.com/qr-code-generator/");
  const [desc, setDesc] = useState("Create a QR code for any URL or text. Choose size, colours and error correction, then download PNG or scalable SVG. Free and no expiry.");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const measure = useMeasure();
  const titleFont = device === "desktop" ? "20px Arial" : "18px Arial";
  const tw = measure(title, titleFont);
  const t = truncate(title, device === "desktop" ? TITLE_PX : 520, (s) => measure(s, titleFont));
  const d = truncate(desc, device === "desktop" ? DESC_PX : 680, (s) => measure(s, "14px Arial"));
  let host = "example.com";
  let crumbs = "";
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, "");
    crumbs = u.pathname.split("/").filter(Boolean).join(" › ");
  } catch {
    /* keep defaults */
  }
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label={tr("serp.title")} htmlFor="serp-t" hint={<span style={{ color: t.cut ? "var(--warning)" : "var(--success)" }}>{tr(t.cut ? "serp.titleWidthTruncated" : "serp.titleWidth", { width: Math.round(tw), limit: device === "desktop" ? TITLE_PX : 520 })}</span>}>
        <input id="serp-t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={tr("serp.url")} htmlFor="serp-u">
        <input id="serp-u" className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <Field label={tr("serp.description")} htmlFor="serp-d" hint={<span style={{ color: d.cut ? "var(--warning)" : "var(--success)" }}>{tr(d.cut ? "serp.descLengthTruncated" : "serp.descLength", { count: desc.length })}</span>}>
        <textarea id="serp-d" className="textarea" style={{ minHeight: 90 }} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </Field>
      <Segmented label={tr("serp.device")} value={device} onChange={setDevice} options={[{ value: "desktop", label: tr("serp.desktop") }, { value: "mobile", label: tr("serp.mobile") }]} />
      <div className={`serp${device === "mobile" ? " mobile" : ""}`} aria-label={tr("serp.previewAria")}>
        <div className="site">
          <span className="fav" aria-hidden>{host.charAt(0).toUpperCase()}</span>
          <span>
            <span style={{ display: "block" }}>{host}</span>
            <span className="crumb">https://{host}{crumbs ? ` › ${crumbs}` : ""}</span>
          </span>
        </div>
        <div className="t" data-testid="serp-title">{t.text}</div>
        <div className="d">{d.text}</div>
      </div>
      <p className="muted" style={{ fontSize: "0.85rem" }}>{tr("serp.note")}</p>
    </div>
  );
}

export function RobotsTxtGenerator() {
  const t = useT("tools-seo");
  const [policy, setPolicy] = useState<"allow" | "block">("allow");
  const [disallow, setDisallow] = useState("/admin/\n/cart/\n/search");
  const [sitemap, setSitemap] = useState("https://example.com/sitemap.xml");
  const [blockAi, setBlockAi] = useState(false);
  const [rules, setRules] = useState<RobotsRule[]>([]);
  const txt = useMemo(
    () => robotsTxt({ defaultPolicy: policy, disallow: disallow.split("\n"), rules, blockAi, sitemaps: sitemap.split("\n") }),
    [policy, disallow, rules, blockAi, sitemap],
  );
  const update = (i: number, patch: Partial<RobotsRule>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label={t("robots.allCrawlers")}>
        <Segmented label={t("robots.defaultPolicy")} value={policy} onChange={setPolicy} options={[{ value: "allow", label: t("robots.allowExcept") }, { value: "block", label: t("robots.blockAll") }]} />
      </Field>
      {policy === "allow" && (
        <Field label={t("robots.disallowedPaths")} htmlFor="rb-dis">
          <textarea id="rb-dis" className="textarea mono" style={{ minHeight: 100 }} value={disallow} onChange={(e) => setDisallow(e.target.value)} />
        </Field>
      )}
      {rules.map((r, i) => (
        <div key={i} className="card card-pad stack" style={{ gap: 12, boxShadow: "none" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{t("robots.ruleTitle")}</strong>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRules(rules.filter((_, j) => j !== i))}>
              <Trash2 aria-hidden /> {t("robots.remove")}
            </button>
          </div>
          <Field label={t("robots.userAgent")} htmlFor={`rb-ua-${i}`}>
            <input id={`rb-ua-${i}`} className="input" value={r.userAgent} onChange={(e) => update(i, { userAgent: e.target.value })} placeholder="Googlebot" />
          </Field>
          <div className="form-grid cols-2">
            <Field label={t("robots.allow")} htmlFor={`rb-a-${i}`}>
              <textarea id={`rb-a-${i}`} className="textarea mono" style={{ minHeight: 80 }} value={r.allow.join("\n")} onChange={(e) => update(i, { allow: e.target.value.split("\n") })} />
            </Field>
            <Field label={t("robots.disallow")} htmlFor={`rb-d-${i}`}>
              <textarea id={`rb-d-${i}`} className="textarea mono" style={{ minHeight: 80 }} value={r.disallow.join("\n")} onChange={(e) => update(i, { disallow: e.target.value.split("\n") })} />
            </Field>
          </div>
        </div>
      ))}
      <div className="row">
        <button type="button" className="btn btn-sm" onClick={() => setRules([...rules, { userAgent: "", allow: [], disallow: [] }])}>
          <Plus aria-hidden /> {t("robots.addRule")}
        </button>
        <label className="check">
          <input type="checkbox" checked={blockAi} onChange={(e) => setBlockAi(e.target.checked)} /> {t("robots.blockAi")}
        </label>
      </div>
      <Field label={t("robots.sitemaps")} htmlFor="rb-sm">
        <textarea id="rb-sm" className="textarea mono" style={{ minHeight: 60 }} value={sitemap} onChange={(e) => setSitemap(e.target.value)} />
      </Field>
      <Output label={t("robots.output")} text={txt} filename="robots.txt" />
    </div>
  );
}

export function SlugGenerator() {
  const t = useT("tools-seo");
  const [text, setText] = useState("10 Best Free Online Tools for Créateurs & Developers in 2026!");
  const [sep, setSep] = useState<"-" | "_">("-");
  const [stop, setStop] = useState(false);
  const [max, setMax] = useState("");
  const out = text
    .split("\n")
    .map((l) => slugify(l, { separator: sep, removeStopWords: stop, maxLength: Number(max) > 0 ? Number(max) : undefined }))
    .join("\n");
  return (
    <div className="stack" style={{ gap: 16 }}>
      <Field label={t("slug.titles")} htmlFor="slug-in">
        <textarea id="slug-in" className="textarea" value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <Field label={t("slug.separator")}>
          <Segmented label={t("slug.separator")} value={sep} onChange={setSep} options={[{ value: "-", label: t("slug.hyphen") }, { value: "_", label: t("slug.underscore") }]} />
        </Field>
        <Field label={t("slug.maxLength")} htmlFor="slug-max">
          <input id="slug-max" className="input" type="number" min={0} value={max} onChange={(e) => setMax(e.target.value)} placeholder={t("slug.none")} style={{ width: 110 }} />
        </Field>
        <label className="check" style={{ height: 44 }}>
          <input type="checkbox" checked={stop} onChange={(e) => setStop(e.target.checked)} /> {t("slug.removeStopWords")}
        </label>
      </div>
      <Output label={t("slug.output")} text={out} />
    </div>
  );
}
