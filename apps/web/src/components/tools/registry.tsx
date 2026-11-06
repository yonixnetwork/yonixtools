"use client";
import dynamic from "next/dynamic";
import { useEffect, type ComponentType } from "react";
import type { toolComponentSlugs } from "./slugs";

// Each category is its own chunk, so a tool page only downloads its own group's code.
const qr = () => import("./QrTools");
const img = () => import("./ImageTools");
const seo = () => import("./SeoTools");
const dev = () => import("./DevTools");
const text = () => import("./TextTools");
const calc = () => import("./CalcTools");

const loading = () => <div className="muted" style={{ padding: "48px 0", textAlign: "center" }}>Loading tool…</div>;
// Marks <html data-tool-ready> once the tool has hydrated and is interactive
// (used by end-to-end tests; harmless otherwise).
function withReady(C: ComponentType): ComponentType {
  return function ReadyTool() {
    useEffect(() => {
      document.documentElement.dataset.toolReady = "1";
    }, []);
    return <C />;
  };
}

const d = <M,>(load: () => Promise<M>, pick: (m: M) => ComponentType) => dynamic(() => load().then((m) => withReady(pick(m))), { loading });

export const toolComponents: Record<(typeof toolComponentSlugs)[number], ComponentType> = {
  "qr-code-generator": d(qr, (m) => m.QrCodeGenerator),
  "wifi-qr-code-generator": d(qr, (m) => m.WifiQrGenerator),
  "vcard-qr-code-generator": d(qr, (m) => m.VcardQrGenerator),
  "image-compressor": d(img, (m) => m.ImageCompressor),
  "image-resizer": d(img, (m) => m.ImageResizer),
  "image-converter": d(img, (m) => m.ImageConverter),
  "meta-tag-generator": d(seo, (m) => m.MetaTagGenerator),
  "serp-snippet-preview": d(seo, (m) => m.SerpPreview),
  "robots-txt-generator": d(seo, (m) => m.RobotsTxtGenerator),
  "url-slug-generator": d(seo, (m) => m.SlugGenerator),
  "json-formatter": d(dev, (m) => m.JsonFormatter),
  "base64-encoder-decoder": d(dev, (m) => m.Base64Tool),
  "url-encoder-decoder": d(dev, (m) => m.UrlTool),
  "uuid-generator": d(dev, (m) => m.UuidTool),
  "jwt-decoder": d(dev, (m) => m.JwtTool),
  "hash-generator": d(dev, (m) => m.HashTool),
  "regex-tester": d(dev, (m) => m.RegexTool),
  "word-counter": d(text, (m) => m.WordCounter),
  "case-converter": d(text, (m) => m.CaseConverter),
  "password-generator": d(text, (m) => m.PasswordGenerator),
  "lorem-ipsum-generator": d(text, (m) => m.LoremGenerator),
  "text-compare": d(text, (m) => m.TextCompare),
  "percentage-calculator": d(calc, (m) => m.PercentageCalculator),
  "age-calculator": d(calc, (m) => m.AgeCalculator),
  "bmi-calculator": d(calc, (m) => m.BmiCalculator),
  "loan-calculator": d(calc, (m) => m.LoanCalculator),
  "compound-interest-calculator": d(calc, (m) => m.CompoundInterestCalculator),
  "unit-converter": d(calc, (m) => m.UnitConverter),
};

export function ToolRenderer({ slug }: { slug: string }) {
  const C = toolComponents[slug as keyof typeof toolComponents];
  return C ? <C /> : null;
}
