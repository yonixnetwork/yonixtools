/**
 * Translation namespaces = catalogue files: src/i18n/messages/<locale>/<namespace>.json.
 *
 * English is the source. `registry` and `guides` are GENERATED from the English tool registry
 * and guides (src/lib/registry, src/lib/guides.ts) by `npm run i18n:sync`; every other English
 * file is edited by hand. Translators translate every namespace into each locale.
 *
 * `client`: shipped to the browser (only the current locale's file, only on pages that need it).
 */
export interface Namespace {
  id: string;
  description: string;
  client: boolean;
  generated?: boolean;
}

export const NAMESPACES: Namespace[] = [
  { id: "common", description: "Site shell: header, navigation, footer, search, language selector, install prompt, shared labels, URL segments", client: true },
  { id: "pages", description: "Page templates: home, all tools, category, tool page, guides, about, privacy, offline, not found", client: false },
  { id: "registry", description: "Categories and tools: names, taglines, SEO titles/descriptions, intros, steps, features, FAQs, localized slugs (generated from the registry)", client: false, generated: true },
  { id: "guides", description: "Guide articles (generated from src/lib/guides.ts)", client: false, generated: true },
  { id: "errors", description: "Downloader API error messages, by stable error code (and platform)", client: true },
  { id: "downloader", description: "Social media downloader UI, results, download states, platform status", client: true },
  { id: "tools-ui", description: "Shared tool UI (file picker, copy/download buttons, common labels)", client: true },
  { id: "tools-qr", description: "QR code generator, Wi-Fi QR, vCard QR", client: true },
  { id: "tools-image", description: "Image compressor, resizer, converter", client: true },
  { id: "tools-seo", description: "Meta tags, SERP preview, robots.txt, URL slug", client: true },
  { id: "tools-dev", description: "JSON, Base64, URL encoder, UUID, JWT, hash, regex", client: true },
  { id: "tools-text", description: "Word counter, case converter, password, lorem ipsum, text compare", client: true },
  { id: "tools-calc", description: "Percentage, age, BMI, loan, compound interest, unit converter", client: true },
  { id: "tools-pdf", description: "PDF merger, splitter, compressor, PDF to image, image to PDF, rotate", client: true },
  { id: "tools-crop", description: "Image cropper", client: true },
  { id: "tools-scan", description: "QR code scanner", client: true },
  { id: "tools-minify", description: "HTML, CSS, JavaScript minifiers", client: true },
  { id: "tools-seo2", description: "Sitemap, schema markup, Open Graph preview, keyword ideas, SEO titles", client: true },
  { id: "tools-video", description: "Video frame extractor, audio extractor, video info", client: true },
  { id: "tools-convert", description: "Color, timestamp, number base, time zone converters", client: true },
  { id: "tools-util", description: "Random number generator, stopwatch & timer", client: true },
];

export const NAMESPACE_IDS = NAMESPACES.map((n) => n.id);

/** Tool component group → namespace (see components/tools/registry.tsx). */
export const TOOL_NAMESPACE: Record<string, string> = {
  "qr-code-generator": "tools-qr",
  "wifi-qr-code-generator": "tools-qr",
  "vcard-qr-code-generator": "tools-qr",
  "image-compressor": "tools-image",
  "image-resizer": "tools-image",
  "image-converter": "tools-image",
  "meta-tag-generator": "tools-seo",
  "serp-snippet-preview": "tools-seo",
  "robots-txt-generator": "tools-seo",
  "url-slug-generator": "tools-seo",
  "json-formatter": "tools-dev",
  "base64-encoder-decoder": "tools-dev",
  "url-encoder-decoder": "tools-dev",
  "uuid-generator": "tools-dev",
  "jwt-decoder": "tools-dev",
  "hash-generator": "tools-dev",
  "regex-tester": "tools-dev",
  "word-counter": "tools-text",
  "case-converter": "tools-text",
  "password-generator": "tools-text",
  "lorem-ipsum-generator": "tools-text",
  "text-compare": "tools-text",
  "percentage-calculator": "tools-calc",
  "age-calculator": "tools-calc",
  "bmi-calculator": "tools-calc",
  "loan-calculator": "tools-calc",
  "compound-interest-calculator": "tools-calc",
  "unit-converter": "tools-calc",
  "pdf-merger": "tools-pdf",
  "pdf-splitter": "tools-pdf",
  "pdf-compressor": "tools-pdf",
  "pdf-to-image": "tools-pdf",
  "image-to-pdf": "tools-pdf",
  "rotate-pdf": "tools-pdf",
  "image-cropper": "tools-crop",
  "qr-code-scanner": "tools-scan",
  "html-minifier": "tools-minify",
  "css-minifier": "tools-minify",
  "javascript-minifier": "tools-minify",
  "sitemap-generator": "tools-seo2",
  "schema-markup-generator": "tools-seo2",
  "open-graph-preview": "tools-seo2",
  "keyword-idea-generator": "tools-seo2",
  "seo-title-generator": "tools-seo2",
  "video-frame-extractor": "tools-video",
  "video-audio-extractor": "tools-video",
  "video-info": "tools-video",
  "color-converter": "tools-convert",
  "timestamp-converter": "tools-convert",
  "number-base-converter": "tools-convert",
  "time-zone-converter": "tools-convert",
  "random-number-generator": "tools-util",
  "stopwatch-timer": "tools-util",
};
