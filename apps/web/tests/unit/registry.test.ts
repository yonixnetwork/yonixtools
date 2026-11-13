import { describe, expect, it } from "vitest";
import { categories, plannedTools, relatedTools, tools, getTool, recentlyAdded, popularSlugs, editorsPicks } from "@/lib/registry";
import { toolComponentSlugs } from "@/components/tools/slugs";

describe("tool registry", () => {
  it("has unique slugs that are URL-safe", () => {
    const slugs = tools.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    slugs.forEach((s) => expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
  });

  it("has unique SEO titles and descriptions within search-friendly lengths", () => {
    expect(new Set(tools.map((t) => t.seo.title)).size).toBe(tools.length);
    expect(new Set(tools.map((t) => t.seo.description)).size).toBe(tools.length);
    for (const t of tools) {
      expect(t.seo.title.length, t.slug).toBeLessThanOrEqual(60);
      expect(t.seo.description.length, t.slug).toBeGreaterThanOrEqual(90);
      expect(t.seo.description.length, t.slug).toBeLessThanOrEqual(170);
    }
  });

  it("gives every tool keywords, synonyms, steps, features and FAQs", () => {
    for (const t of tools) {
      expect(t.keywords.length, t.slug).toBeGreaterThanOrEqual(3);
      expect(t.synonyms.length, t.slug).toBeGreaterThanOrEqual(2);
      expect(t.content.steps.length, t.slug).toBeGreaterThanOrEqual(3);
      expect(t.content.features.length, t.slug).toBeGreaterThanOrEqual(2);
      expect(t.content.faqs.length, t.slug).toBeGreaterThanOrEqual(1);
    }
  });

  it("only references existing tools and categories", () => {
    const ids = new Set(categories.map((c) => c.id));
    for (const t of tools) {
      expect(ids.has(t.category), t.slug).toBe(true);
      t.related.forEach((r) => expect(getTool(r), `${t.slug} → ${r}`).toBeDefined());
      expect(t.related).not.toContain(t.slug);
    }
    [...popularSlugs, ...editorsPicks].forEach((s) => expect(getTool(s)?.status, s).toBe("live"));
  });

  it("has a real UI component for every live tool (no placeholder pages)", () => {
    for (const t of tools.filter((x) => x.status === "live")) expect(toolComponentSlugs, t.slug).toContain(t.slug);
  });

  it("marks every server-side tool as awaiting backend until Phase 2", () => {
    tools.filter((t) => t.runsIn === "server").forEach((t) => expect(t.status).toBe("awaiting-backend"));
    tools.filter((t) => t.runsIn === "browser").forEach((t) => expect(t.status).toBe("live"));
  });

  it("does not give planned tools a page", () => {
    const names = new Set(tools.map((t) => t.name.toLowerCase()));
    plannedTools.forEach((p) => expect(names.has(p.name.toLowerCase())).toBe(false));
  });

  it("returns related tools without the tool itself", () => {
    const r = relatedTools("qr-code-generator");
    expect(r.length).toBeGreaterThanOrEqual(3);
    expect(r.map((t) => t.slug)).not.toContain("qr-code-generator");
    expect(r[0].slug).toBe("wifi-qr-code-generator");
  });

  it("lists recently added working tools", () => {
    const r = recentlyAdded(4);
    expect(r).toHaveLength(4);
    r.forEach((t) => expect(t.status).toBe("live"));
  });
});
