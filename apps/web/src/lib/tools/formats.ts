// ── Wi-Fi QR payload (ZXing "WIFI:" format) ─────────────────────────────────

export type WifiSecurity = "WPA" | "WEP" | "nopass";

const escapeWifi = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");

export function wifiPayload(o: { ssid: string; password: string; security: WifiSecurity; hidden: boolean }): string {
  const parts = [`T:${o.security}`, `S:${escapeWifi(o.ssid)}`];
  if (o.security !== "nopass") parts.push(`P:${escapeWifi(o.password)}`);
  if (o.hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}

// ── vCard 3.0 ───────────────────────────────────────────────────────────────

export interface Contact {
  firstName: string;
  lastName: string;
  organization: string;
  title: string;
  phone: string;
  email: string;
  website: string;
  address: string;
}

const escapeVcard = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export function vcardPayload(c: Contact): string {
  const v = (s: string) => escapeVcard(s.trim());
  const full = [c.firstName, c.lastName].map((x) => x.trim()).filter(Boolean).join(" ");
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${v(c.lastName)};${v(c.firstName)};;;`, `FN:${escapeVcard(full || c.organization.trim())}`];
  if (c.organization.trim()) lines.push(`ORG:${v(c.organization)}`);
  if (c.title.trim()) lines.push(`TITLE:${v(c.title)}`);
  if (c.phone.trim()) lines.push(`TEL;TYPE=CELL:${v(c.phone)}`);
  if (c.email.trim()) lines.push(`EMAIL:${v(c.email)}`);
  if (c.website.trim()) lines.push(`URL:${v(c.website)}`);
  if (c.address.trim()) lines.push(`ADR;TYPE=WORK:;;${v(c.address)};;;;`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

// ── HTML meta tags ──────────────────────────────────────────────────────────

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface MetaInput {
  title: string;
  description: string;
  url: string;
  image: string;
  siteName: string;
  twitterHandle: string;
  noindex: boolean;
  type: "website" | "article";
}

export function metaTags(m: MetaInput): string {
  const out: string[] = [];
  const add = (cond: unknown, line: string) => cond && out.push(line);
  const e = (s: string) => escapeHtml(s.trim());
  add(m.title.trim(), `<title>${e(m.title)}</title>`);
  add(m.description.trim(), `<meta name="description" content="${e(m.description)}">`);
  add(m.url.trim(), `<link rel="canonical" href="${e(m.url)}">`);
  add(true, `<meta name="robots" content="${m.noindex ? "noindex, nofollow" : "index, follow"}">`);
  add(true, "");
  add(true, `<!-- Open Graph -->`);
  add(true, `<meta property="og:type" content="${m.type}">`);
  add(m.title.trim(), `<meta property="og:title" content="${e(m.title)}">`);
  add(m.description.trim(), `<meta property="og:description" content="${e(m.description)}">`);
  add(m.url.trim(), `<meta property="og:url" content="${e(m.url)}">`);
  add(m.image.trim(), `<meta property="og:image" content="${e(m.image)}">`);
  add(m.siteName.trim(), `<meta property="og:site_name" content="${e(m.siteName)}">`);
  add(true, "");
  add(true, `<!-- Twitter / X -->`);
  add(true, `<meta name="twitter:card" content="${m.image.trim() ? "summary_large_image" : "summary"}">`);
  add(m.title.trim(), `<meta name="twitter:title" content="${e(m.title)}">`);
  add(m.description.trim(), `<meta name="twitter:description" content="${e(m.description)}">`);
  add(m.image.trim(), `<meta name="twitter:image" content="${e(m.image)}">`);
  const handle = m.twitterHandle.trim().replace(/^@?/, "@");
  add(m.twitterHandle.trim(), `<meta name="twitter:site" content="${e(handle)}">`);
  return out.join("\n");
}

// ── robots.txt ──────────────────────────────────────────────────────────────

export const AI_CRAWLERS = ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "PerplexityBot", "Bytespider", "Applebot-Extended", "meta-externalagent"];

export interface RobotsRule {
  userAgent: string;
  allow: string[];
  disallow: string[];
}

export function robotsTxt(o: { defaultPolicy: "allow" | "block"; disallow: string[]; rules: RobotsRule[]; blockAi: boolean; sitemaps: string[]; crawlDelay?: number }): string {
  const blocks: string[] = [];
  const clean = (paths: string[]) => paths.map((p) => p.trim()).filter(Boolean).map((p) => (p.startsWith("/") || p.startsWith("*") ? p : `/${p}`));
  const star = ["User-agent: *"];
  if (o.defaultPolicy === "block") star.push("Disallow: /");
  else {
    const dis = clean(o.disallow);
    if (dis.length) dis.forEach((p) => star.push(`Disallow: ${p}`));
    else star.push("Allow: /");
  }
  if (o.crawlDelay && o.crawlDelay > 0) star.push(`Crawl-delay: ${o.crawlDelay}`);
  blocks.push(star.join("\n"));
  for (const r of o.rules) {
    if (!r.userAgent.trim()) continue;
    const lines = [`User-agent: ${r.userAgent.trim()}`];
    clean(r.allow).forEach((p) => lines.push(`Allow: ${p}`));
    clean(r.disallow).forEach((p) => lines.push(`Disallow: ${p}`));
    if (lines.length === 1) lines.push("Allow: /");
    blocks.push(lines.join("\n"));
  }
  if (o.blockAi) blocks.push(AI_CRAWLERS.map((b) => `User-agent: ${b}`).join("\n") + "\nDisallow: /");
  const maps = o.sitemaps.map((s) => s.trim()).filter(Boolean);
  let txt = blocks.join("\n\n");
  if (maps.length) txt += "\n\n" + maps.map((s) => `Sitemap: ${s}`).join("\n");
  return txt + "\n";
}

// ── Regex ───────────────────────────────────────────────────────────────────

export interface RegexMatch {
  index: number;
  end: number;
  text: string;
  groups: Array<string | undefined>;
  named: Record<string, string | undefined>;
}

export const REGEX_MAX_MATCHES = 1000;

export function runRegex(pattern: string, flags: string, text: string): { ok: true; matches: RegexMatch[]; truncated: boolean } | { ok: false; error: string } {
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
  } catch (e) {
    return { ok: false, error: (e as Error).message.replace(/^Invalid regular expression: /, "") };
  }
  const matches: RegexMatch[] = [];
  if (!pattern) return { ok: true, matches, truncated: false };
  const single = !flags.includes("g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    matches.push({ index: m.index, end: m.index + m[0].length, text: m[0], groups: m.slice(1), named: { ...(m.groups || {}) } });
    if (m[0] === "") re.lastIndex += 1;
    if (single || matches.length >= REGEX_MAX_MATCHES) break;
  }
  return { ok: true, matches, truncated: matches.length >= REGEX_MAX_MATCHES };
}
