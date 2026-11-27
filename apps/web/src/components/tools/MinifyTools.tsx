"use client";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Notice, Output } from "./ui";
import { useT } from "@/i18n/client";
import { minify, type MinifyLang, type MinifyResult } from "@/lib/tools/minify";

const SAMPLES: Record<MinifyLang, string> = {
  html: '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <!-- Page title -->\n    <title>  My page  </title>\n    <style>\n      body { margin: 0px; color: #ff0000; }\n    </style>\n  </head>\n  <body>\n    <p class="intro">  Hello,   world!  </p>\n    <script type="text/javascript">\n      const greeting = "hi";\n      console.log(greeting);\n    </script>\n  </body>\n</html>',
  css: "/* Buttons */\n.button {\n  color: #ffffff;\n  background-color: #ff0000;\n  margin: 0px 0px 0px 0px;\n  padding: 10px 10px 10px 10px;\n}\n\n.button:hover {\n  background-color: #cc0000;\n}",
  js: "// Adds two numbers\nfunction addNumbers(firstNumber, secondNumber) {\n  const result = firstNumber + secondNumber;\n  return result;\n}\n\nconsole.log(addNumbers(2, 3));",
};
const NAMES: Record<MinifyLang, string> = { html: "HTML", css: "CSS", js: "JavaScript" };

function MinifyTool({ lang }: { lang: MinifyLang }) {
  const t = useT("tools-minify");
  const [input, setInput] = useState(SAMPLES[lang]);
  const [mangle, setMangle] = useState(true);
  const [keepComments, setKeepComments] = useState(false);
  const [res, setRes] = useState<MinifyResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      setRes(await minify(lang, input, { mangle, keepComments }));
    } catch (e) {
      const err = e as { message?: string; line?: number; col?: number };
      setRes(null);
      // The parser's own message is technical detail and stays as the minifier reports it.
      const detail = err.message || t("minify.failed");
      setError(err.line ? t("minify.errorAt", { line: err.line, column: (err.col ?? 0) + 1, message: detail }) : detail);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="field">
        <label htmlFor="min-in">{t("minify.input", { lang: NAMES[lang] })}</label>
        <textarea id="min-in" className="textarea mono" value={input} onChange={(e) => (setInput(e.target.value), setRes(null))} spellCheck={false} style={{ minHeight: 220 }} />
      </div>
      <div className="row">
        {lang === "js" && <label className="check"><input type="checkbox" checked={mangle} onChange={(e) => setMangle(e.target.checked)} /> {t("minify.mangle")}</label>}
        <label className="check"><input type="checkbox" checked={keepComments} onChange={(e) => setKeepComments(e.target.checked)} /> {t(lang === "html" ? "minify.keepComments" : "minify.keepLicenceComments")}</label>
        <button type="button" className="btn btn-primary" onClick={run} disabled={busy || !input.trim()}>{busy && <LoaderCircle className="spin" aria-hidden />} {t("minify.button", { lang: NAMES[lang] })}</button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {res && (
        <>
          <p className="muted" data-testid="minify-stats">
            {t("minify.stats", { before: res.before, after: res.after, percent: res.before ? Math.round((1 - res.after / res.before) * 100) : 0 })}
          </p>
          <Output label={t("minify.output")} text={res.output} filename={`minified.${lang === "js" ? "js" : lang}`} />
        </>
      )}
    </div>
  );
}

export const HtmlMinifier = () => <MinifyTool lang="html" />;
export const CssMinifier = () => <MinifyTool lang="css" />;
export const JsMinifier = () => <MinifyTool lang="js" />;
