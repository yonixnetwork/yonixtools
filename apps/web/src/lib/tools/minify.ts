export type MinifyLang = "html" | "css" | "js";

export interface MinifyResult {
  output: string;
  before: number;
  after: number;
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** Minify code with the standard open-source minifiers (loaded on demand). */
export async function minify(lang: MinifyLang, input: string, opts: { mangle?: boolean; keepComments?: boolean } = {}): Promise<MinifyResult> {
  if (!input.trim()) return { output: "", before: 0, after: 0 };
  let output: string;
  if (lang === "js") {
    const { minify: terser } = await import("terser");
    const r = await terser(input, { compress: true, mangle: opts.mangle ?? true, format: { comments: opts.keepComments ? "some" : false } });
    output = r.code ?? "";
  } else if (lang === "css") {
    const { minify: csso } = await import("csso");
    output = csso(input, { comments: opts.keepComments ? "exclamation" : false }).css;
  } else {
    // Browser-ready ESM bundle (the package's main entry pulls in Node built-ins).
    // @ts-expect-error: the bundle ships without its own type declarations
    const mod = await import("html-minifier-terser/dist/htmlminifier.esm.bundle");
    output = await mod.minify(input, {
      collapseWhitespace: true,
      conservativeCollapse: true,
      removeComments: !opts.keepComments,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      useShortDoctype: true,
      minifyCSS: true,
      minifyJS: true,
    });
  }
  return { output, before: bytes(input), after: bytes(output) };
}
