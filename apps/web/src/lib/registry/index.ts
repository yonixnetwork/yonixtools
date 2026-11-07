import { categories } from "./categories";
import { plannedTools, tools as allTools } from "./tools";
import { isAvailable } from "./availability";
import type { Category, CategoryId, Tool } from "./types";

/** Listed tools (search, categories, sitemap, navigation). Hidden tools keep their page via allTools. */
const tools = allTools.filter((t) => !t.hidden);
export { categories, tools, allTools, plannedTools };
export type * from "./types";

const bySlug = new Map(allTools.map((t) => [t.slug, t]));
const categoryById = new Map(categories.map((c) => [c.id, c]));

export const getTool = (slug: string): Tool | undefined => bySlug.get(slug);
export const getCategory = (id: CategoryId): Category => categoryById.get(id)!;
export const getCategoryBySlug = (slug: string): Category | undefined => categories.find((c) => c.slug === slug);
export const toolsInCategory = (id: CategoryId): Tool[] => tools.filter((t) => t.category === id);
/** Usable in this build: browser tools always; backend tools only when a backend is configured. */
export { isAvailable };
export const isIndexable = (t: Tool) => isAvailable(t) && !t.hidden;

/** Explicit related tools first, then same-category tools, never the tool itself. */
export function relatedTools(slug: string, limit = 4): Tool[] {
  const tool = bySlug.get(slug);
  if (!tool) return [];
  const out: Tool[] = [];
  const push = (t?: Tool) => {
    if (t && !t.hidden && t.slug !== slug && !out.includes(t)) out.push(t);
  };
  tool.related.forEach((s) => push(bySlug.get(s)));
  toolsInCategory(tool.category).forEach(push);
  return out.slice(0, limit);
}

/** Curated, working (browser) tools for the homepage. */
export const popularSlugs = [
  "qr-code-generator",
  "image-compressor",
  "json-formatter",
  "password-generator",
  "word-counter",
  "image-converter",
  "percentage-calculator",
  "case-converter",
];

export const editorsPicks = ["wifi-qr-code-generator", "jwt-decoder", "serp-snippet-preview", "loan-calculator"];

export function recentlyAdded(limit = 4): Tool[] {
  return tools
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.status === "live")
    .sort((a, b) => b.t.addedAt.localeCompare(a.t.addedAt) || b.i - a.i)
    .slice(0, limit)
    .map(({ t }) => t);
}

export const downloaderTools = () => tools.filter((t) => t.category === "social");
