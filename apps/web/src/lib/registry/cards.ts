import type { Tool } from "./types";

/** The minimum a tool card needs. Passed to client components instead of the full registry entry. */
export type ToolCardData = Pick<Tool, "slug" | "name" | "tagline" | "icon" | "platform" | "status" | "category" | "related"> & {
  /** Link to the tool page in the current locale (defaults to the English path). */
  href?: string;
};

export const toCard = ({ slug, name, tagline, icon, platform, status, category, related }: Tool, href?: string): ToolCardData => ({ slug, name, tagline, icon, platform, status, category, related, ...(href ? { href } : {}) });

export function relatedCards(slug: string, cards: ToolCardData[], limit = 4): ToolCardData[] {
  const by = new Map(cards.map((c) => [c.slug, c]));
  const t = by.get(slug);
  if (!t) return [];
  const out: ToolCardData[] = [];
  const push = (c?: ToolCardData) => c && c.slug !== slug && !out.includes(c) && out.push(c);
  t.related.forEach((s) => push(by.get(s)));
  cards.filter((c) => c.category === t.category).forEach(push);
  return out.slice(0, limit);
}
