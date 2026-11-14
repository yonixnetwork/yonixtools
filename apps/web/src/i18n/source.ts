/**
 * The English source messages for the generated namespaces (`registry`, `guides`), built from the
 * tool registry and guides, plus the functions that apply a locale's messages back onto those
 * objects. English pages therefore render exactly what the registry says.
 */
import type { Messages } from "./format";
import { categories, allTools, type Category, type Tool } from "@/lib/registry";
import { guides, type Guide } from "@/lib/guides";

export function registrySource(): Messages {
  const m: Messages = {};
  for (const c of categories) {
    m[`category.${c.id}.name`] = c.name;
    m[`category.${c.id}.description`] = c.description;
    m[`category.${c.id}.slug`] = c.slug;
  }
  for (const t of allTools) {
    const p = `tool.${t.slug}`;
    m[`${p}.slug`] = t.slug;
    m[`${p}.name`] = t.name;
    m[`${p}.tagline`] = t.tagline;
    m[`${p}.seoTitle`] = t.seo.title;
    m[`${p}.seoDescription`] = t.seo.description;
    m[`${p}.intro`] = t.content.intro;
    t.content.steps.forEach((s, i) => (m[`${p}.steps.${i}`] = s));
    t.content.features.forEach((s, i) => (m[`${p}.features.${i}`] = s));
    t.content.faqs.forEach((f, i) => {
      m[`${p}.faqs.${i}.q`] = f.q;
      m[`${p}.faqs.${i}.a`] = f.a;
    });
  }
  return m;
}

export function guidesSource(): Messages {
  const m: Messages = {};
  for (const g of guides) {
    const p = `guide.${g.slug}`;
    m[`${p}.slug`] = g.slug;
    m[`${p}.title`] = g.title;
    m[`${p}.h1`] = g.h1;
    m[`${p}.description`] = g.description;
    m[`${p}.intro`] = g.intro;
    g.sections.forEach((s, i) => {
      m[`${p}.s.${i}.heading`] = s.heading;
      s.paragraphs?.forEach((x, j) => (m[`${p}.s.${i}.p.${j}`] = x));
      s.steps?.forEach((x, j) => (m[`${p}.s.${i}.steps.${j}`] = x));
      s.bullets?.forEach((x, j) => (m[`${p}.s.${i}.bullets.${j}`] = x));
    });
  }
  return m;
}

const s = (m: Messages, k: string, fallback: string): string => {
  const v = m[k];
  return typeof v === "string" ? v : fallback;
};

export function localizeCategory(c: Category, m: Messages): Category {
  const p = `category.${c.id}`;
  return { ...c, name: s(m, `${p}.name`, c.name), description: s(m, `${p}.description`, c.description), slug: s(m, `${p}.slug`, c.slug) };
}

/** A tool with its text in the locale. `slug` stays the stable English id (paths come from routes). */
export function localizeTool(t: Tool, m: Messages): Tool {
  const p = `tool.${t.slug}`;
  return {
    ...t,
    name: s(m, `${p}.name`, t.name),
    tagline: s(m, `${p}.tagline`, t.tagline),
    seo: { title: s(m, `${p}.seoTitle`, t.seo.title), description: s(m, `${p}.seoDescription`, t.seo.description) },
    content: {
      intro: s(m, `${p}.intro`, t.content.intro),
      steps: t.content.steps.map((x, i) => s(m, `${p}.steps.${i}`, x)),
      features: t.content.features.map((x, i) => s(m, `${p}.features.${i}`, x)),
      faqs: t.content.faqs.map((f, i) => ({ q: s(m, `${p}.faqs.${i}.q`, f.q), a: s(m, `${p}.faqs.${i}.a`, f.a) })),
    },
  };
}

export function localizeGuide(g: Guide, m: Messages): Guide {
  const p = `guide.${g.slug}`;
  return {
    ...g,
    title: s(m, `${p}.title`, g.title),
    h1: s(m, `${p}.h1`, g.h1),
    description: s(m, `${p}.description`, g.description),
    intro: s(m, `${p}.intro`, g.intro),
    sections: g.sections.map((x, i) => ({
      heading: s(m, `${p}.s.${i}.heading`, x.heading),
      paragraphs: x.paragraphs?.map((y, j) => s(m, `${p}.s.${i}.p.${j}`, y)),
      steps: x.steps?.map((y, j) => s(m, `${p}.s.${i}.steps.${j}`, y)),
      bullets: x.bullets?.map((y, j) => s(m, `${p}.s.${i}.bullets.${j}`, y)),
    })),
  };
}
